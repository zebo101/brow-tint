import { db } from '@/core/db';
import { envConfigs } from '@/config';
import type { AIGenerateParams } from '@/extensions/ai/types';
import type { NewAITask } from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';

import { getAIService } from './ai';
import { browQueueErrorDetails } from './brow-queue-diagnostics';
import { readBrowQueueMetadata, runBrowQueueAction } from './brow-queue-engine';
import { createBrowQueueStore } from './brow-queue-store';

type WorkerState = {
  database?: ReturnType<typeof db>;
  store?: ReturnType<typeof createBrowQueueStore>;
  timer?: ReturnType<typeof setInterval>;
  running?: boolean;
  lastErrorAt?: number;
};
const globalQueue = globalThis as typeof globalThis & {
  __browQueueWorker?: WorkerState;
};
const state = (globalQueue.__browQueueWorker ||= {});

function getStore() {
  return (state.store ||= createBrowQueueStore((state.database ||= db())));
}

export function isBrowQueuedTask(task: {
  mediaType: string;
  scene: string;
  options?: string | null;
}) {
  return (
    task.mediaType === 'image' &&
    task.scene === 'image-to-image' &&
    Boolean(readBrowQueueMetadata(task.options))
  );
}

export async function enqueueBrowGeneration(
  task: NewAITask,
  params: AIGenerateParams,
  priority: 0 | 1 | 2
) {
  const queued = await getStore().enqueue(task, params, priority);
  startBrowQueueWorker();
  return queued;
}

async function tick() {
  if (state.running) return;
  state.running = true;
  let stage = 'claim';
  try {
    const store = getStore();
    const action = await store.claim();
    if (!action) return;
    stage = 'configuration';
    // Recovery failures need no provider config or network access.
    const provider = action.kind.startsWith('fail-')
      ? undefined
      : (
          await getAIService(
            await getAllConfigs({ useCache: false, database: state.database })
          )
        ).getProvider(action.provider);
    stage = `provider-${action.kind}`;
    const outcome = await runBrowQueueAction(action, provider, action.now);
    stage = 'complete';
    await store.complete(action, outcome);
  } catch (error) {
    // The durable lease lets another tick/process recover after any crash.
    // Avoid logging prompts, photos, provider credentials, or DB connection data.
    if (!state.lastErrorAt || Date.now() - state.lastErrorAt >= 60_000) {
      console.error(
        '[brow-queue] Worker tick failed; durable tasks will be recovered.',
        { stage, ...browQueueErrorDetails(error) }
      );
      state.lastErrorAt = Date.now();
    }
  } finally {
    state.running = false;
  }
}

/** Persistent Node host worker: jobs continue after tab close or process restart. */
export function startBrowQueueWorker() {
  if (
    state.timer ||
    !envConfigs.database_url ||
    process.env.NEXT_PHASE === 'phase-production-build'
  )
    return;
  if (
    !['postgresql', 'sqlite', 'turso'].includes(envConfigs.database_provider)
  ) {
    if (!state.lastErrorAt)
      console.warn('[brow-queue] Unsupported database dialect.');
    state.lastErrorAt = Date.now();
    return;
  }
  state.timer = setInterval(() => void tick(), 2_000);
  state.timer.unref?.();
  console.info(
    `[brow-queue] Worker started (${envConfigs.database_provider}).`
  );
  void tick();
}
