import type { AIGenerateParams } from '@/extensions/ai/types';

export const BROW_QUEUE_KEY = '__browQueue';
export const BROW_QUEUE_LEASE_MS = 120_000;
export const BROW_QUEUE_CALL_TIMEOUT_MS = 90_000;
export const BROW_QUEUE_POLL_MS = 5_000;
export const BROW_QUEUE_MAX_RUN_MS = 30 * 60_000;

export type BrowQueueMetadata = {
  version: 1;
  priority: 0 | 1 | 2;
  /** Database admission order, assigned under the database's queue/write lock. */
  order: string;
  phase: 'waiting' | 'submitting' | 'submitted';
  params: AIGenerateParams;
  startedAt?: number;
  nextPollAt?: number;
  leaseUntil?: number;
  claimToken?: string;
};

export type BrowQueueTask = {
  id: string;
  status: string;
  taskId: string | null;
  metadata: BrowQueueMetadata;
};

export type BrowQueueAction = {
  kind: 'submit' | 'poll' | 'fail-unknown' | 'fail-timeout';
  task: BrowQueueTask;
};

export type BrowQueueOutcome = {
  status: string;
  taskId?: string;
  taskInfo?: any;
  taskResult?: any;
  metadata?: BrowQueueMetadata;
  retryAfterMs?: number;
};

export function isTerminalBrowTask(status: string) {
  return ['success', 'failed', 'canceled'].includes(status);
}

export function readBrowQueueMetadata(
  options: string | null | undefined
): BrowQueueMetadata | undefined {
  try {
    const value = JSON.parse(options || '{}')?.[BROW_QUEUE_KEY];
    if (
      value?.version !== 1 ||
      ![0, 1, 2].includes(value.priority) ||
      !['waiting', 'submitting', 'submitted'].includes(value.phase) ||
      typeof value.order !== 'string' ||
      !value.params?.prompt
    )
      return undefined;
    return value;
  } catch {
    return undefined;
  }
}

/** Called only inside the database's globally serialized claim transaction. */
export function chooseBrowQueueAction(
  tasks: BrowQueueTask[],
  now: number
): BrowQueueAction | undefined {
  const unfinished = tasks.filter((task) => !isTerminalBrowTask(task.status));
  const active = unfinished.filter((task) => task.metadata.phase !== 'waiting');
  for (const task of active) {
    const metadata = task.metadata;
    if ((metadata.leaseUntil || 0) > now) continue;
    if (metadata.phase === 'submitting' && !task.taskId)
      return { kind: 'fail-unknown', task };
    if (
      metadata.startedAt !== undefined &&
      now - metadata.startedAt >= BROW_QUEUE_MAX_RUN_MS
    )
      return { kind: 'fail-timeout', task };
    if (task.taskId && (metadata.nextPollAt || 0) <= now)
      return { kind: 'poll', task };
  }
  // A waiting high-priority job never interrupts an active lower-priority job.
  if (active.length) return undefined;
  const next = unfinished.sort(
    (a, b) =>
      b.metadata.priority - a.metadata.priority ||
      a.metadata.order.localeCompare(b.metadata.order) ||
      a.id.localeCompare(b.id)
  )[0];
  return next ? { kind: 'submit', task: next } : undefined;
}

type QueueProvider = {
  generate: (args: { params: AIGenerateParams }) => Promise<{
    taskId: string;
    taskStatus: string;
    taskInfo?: any;
    taskResult?: any;
  }>;
  query?: (args: {
    taskId: string;
    mediaType?: string;
    model?: string;
  }) => Promise<{
    taskId?: string;
    taskStatus: string;
    taskInfo?: any;
    taskResult?: any;
  }>;
};

async function withDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('queue provider deadline')),
          BROW_QUEUE_CALL_TIMEOUT_MS
        );
        timer.unref?.();
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

function failure(code: string, message: string): BrowQueueOutcome {
  return {
    status: 'failed',
    taskInfo: { errorCode: code, errorMessage: message },
  };
}

export async function runBrowQueueAction(
  action: BrowQueueAction,
  provider: QueueProvider | undefined,
  now: number
): Promise<BrowQueueOutcome> {
  const { task, kind } = action;
  if (kind === 'fail-unknown')
    return failure(
      'queue_submission_unknown',
      'The generation submission could not be confirmed. Credits have been returned.'
    );
  if (kind === 'fail-timeout')
    return failure(
      'queue_generation_timeout',
      'The generation did not complete in time. Credits have been returned.'
    );
  if (!provider)
    return failure(
      'queue_provider_unavailable',
      'The generation service is unavailable. Credits have been returned.'
    );
  if (kind === 'submit') {
    try {
      const result = await withDeadline(
        provider.generate({ params: task.metadata.params })
      );
      if (!result?.taskId) throw new Error('missing provider task ID');
      return {
        status: result.taskStatus,
        taskId: result.taskId,
        taskInfo: result.taskInfo,
        taskResult: result.taskResult,
        metadata: {
          ...task.metadata,
          phase: 'submitted',
          leaseUntil: 0,
          nextPollAt: now + BROW_QUEUE_POLL_MS,
        },
      };
    } catch {
      // Providers expose no idempotency contract. Retrying a POST can create a
      // second billed provider job; finish/refund this local task instead.
      return failure(
        'queue_submission_unknown',
        'The generation submission could not be confirmed. Credits have been returned.'
      );
    }
  }
  try {
    if (!provider.query || !task.taskId)
      throw new Error('provider query unavailable');
    const result = await withDeadline(
      provider.query({
        taskId: task.taskId,
        mediaType: task.metadata.params.mediaType,
        model: task.metadata.params.model,
      })
    );
    if (!result?.taskStatus) throw new Error('missing provider task status');
    return {
      status: result.taskStatus,
      taskInfo: result.taskInfo,
      taskResult: result.taskResult,
      metadata: {
        ...task.metadata,
        leaseUntil: 0,
        nextPollAt: now + BROW_QUEUE_POLL_MS,
      },
    };
  } catch {
    // Re-querying an existing provider ID is safe; never re-submit it.
    return {
      status: 'processing',
      retryAfterMs: 15_000,
      metadata: { ...task.metadata, leaseUntil: 0, nextPollAt: now + 15_000 },
    };
  }
}
