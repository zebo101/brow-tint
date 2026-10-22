import { UpdateAITask } from '@/shared/models/ai_task';

type ProviderTask = {
  id: string;
  taskId: string | null;
  mediaType: string;
  provider: string;
  model: string;
  status: string;
  taskInfo: string | null;
  taskResult: string | null;
  creditId: string | null;
};

type QueryResult = {
  taskStatus: string;
  taskInfo?: unknown;
  taskResult?: unknown;
};

type AINotifyDeps = {
  findAITaskByProviderTaskId: ({
    provider,
    taskId,
  }: {
    provider: string;
    taskId: string;
  }) => Promise<ProviderTask | undefined>;
  getAIService: () => Promise<{
    getProvider: (provider: string) =>
      | {
          query?: ({
            taskId,
            mediaType,
            model,
          }: {
            taskId: string;
            mediaType?: string;
            model?: string;
          }) => Promise<QueryResult>;
        }
      | undefined;
  }>;
  persistBrowResult?: (id: string) => Promise<void>;
  updateAITaskById: (
    id: string,
    updateAITask: UpdateAITask
  ) => Promise<unknown>;
};

export function extractAITaskId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const value = payload as Record<string, unknown>;
  const data =
    value.data && typeof value.data === 'object'
      ? (value.data as Record<string, unknown>)
      : {};
  return [
    value.taskId,
    value.recordId,
    value.id,
    data.taskId,
    data.recordId,
  ].find((id): id is string => typeof id === 'string' && id.length > 0);
}

export async function handleAINotify({
  provider,
  payload,
  url,
  deps,
}: {
  provider: string;
  payload?: unknown;
  url?: string;
  deps: AINotifyDeps;
}) {
  if (!provider) {
    return {
      status: 400,
      body: {
        message: 'provider is required',
      },
    };
  }

  const taskId =
    extractAITaskId(payload) ||
    (url ? new URL(url).searchParams.get('taskId') || undefined : undefined);

  if (!taskId) {
    return {
      status: 200,
      body: {
        message: 'ignored: taskId not found',
        ignored: true,
      },
    };
  }

  const task = await deps.findAITaskByProviderTaskId({
    provider,
    taskId,
  });

  if (!task || !task.taskId) {
    return {
      status: 200,
      body: {
        message: 'ignored: task not found',
        ignored: true,
      },
    };
  }

  const aiService = await deps.getAIService();
  const aiProvider = aiService.getProvider(provider);
  if (!aiProvider?.query) {
    throw new Error(`ai provider not found: ${provider}`);
  }

  const result = await aiProvider.query({
    taskId: task.taskId,
    mediaType: task.mediaType,
    model: task.model,
  });

  if (!result?.taskStatus) {
    throw new Error('query ai task failed');
  }

  const updateAITask: UpdateAITask = {
    status: result.taskStatus,
    taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
    taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
    creditId: task.creditId,
  };

  if (
    updateAITask.status !== task.status ||
    updateAITask.taskInfo !== task.taskInfo ||
    updateAITask.taskResult !== task.taskResult
  ) {
    await deps.updateAITaskById(task.id, updateAITask);
  }

  if (result.taskStatus === 'success' || task.status === 'success') {
    // The hook reloads the row and checks brow/success/storage state itself.
    // Neither slow storage nor a failed copy may delay or fail the callback.
    void Promise.resolve()
      .then(() => deps.persistBrowResult?.(task.id))
      .catch(() =>
        console.warn('[brow-results] Completion storage hook failed.')
      );
  }

  return {
    status: 200,
    body: {
      message: 'success',
      taskId,
    },
  };
}
