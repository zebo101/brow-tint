import { serializeBrowTaskForClient } from '@/shared/lib/brow-export';
import { respData, respErr } from '@/shared/lib/resp';
import {
  findAITaskById,
  UpdateAITask,
  updateAITaskById,
} from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import { getAIService } from '@/shared/services/ai';
import { getBrowEntitlements } from '@/shared/services/brow-entitlements';
import {
  isBrowQueuedTask,
  startBrowQueueWorker,
} from '@/shared/services/brow-queue';

export async function POST(req: Request) {
  try {
    const { taskId } = await req.json();
    if (!taskId) {
      return respErr('invalid params');
    }

    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const task = await findAITaskById(taskId);
    if (!task) {
      return respErr('task not found');
    }

    if (task.userId !== user.id) {
      return respErr('no permission');
    }

    const entitlements = await getBrowEntitlements(user.id);
    // The server worker owns queued provider polling, including after refresh.
    // A local task ID exists before a provider task ID has been assigned.
    if (isBrowQueuedTask(task)) {
      startBrowQueueWorker();
      return respData(serializeBrowTaskForClient(task, entitlements));
    }
    if (['success', 'failed', 'canceled'].includes(task.status)) {
      return respData(serializeBrowTaskForClient(task, entitlements));
    }
    if (!task.taskId) return respErr('task not found');

    const aiService = await getAIService();
    const aiProvider = aiService.getProvider(task.provider);
    if (!aiProvider) {
      return respErr('invalid ai provider');
    }

    const result = await aiProvider?.query?.({
      taskId: task.taskId,
      mediaType: task.mediaType,
      model: task.model,
    });

    if (!result?.taskStatus) {
      return respErr('query ai task failed');
    }

    // update ai task
    const updateAITask: UpdateAITask = {
      status: result.taskStatus,
      taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
      taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
      creditId: task.creditId, // credit consumption record id
    };
    const updated = await updateAITaskById(task.id, updateAITask);
    return respData(serializeBrowTaskForClient(updated || task, entitlements));
  } catch (e: any) {
    console.log('ai query failed', e);
    return respErr(e.message);
  }
}
