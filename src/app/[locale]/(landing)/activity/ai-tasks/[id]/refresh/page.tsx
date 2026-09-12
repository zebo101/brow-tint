import { redirect } from '@/core/i18n/navigation';
import { AITaskStatus } from '@/extensions/ai';
import { Empty } from '@/shared/blocks/common';
import { findAITaskById, updateAITaskById } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import { getAIService } from '@/shared/services/ai';
import {
  isBrowQueuedTask,
  startBrowQueueWorker,
} from '@/shared/services/brow-queue';

export default async function RefreshAITaskPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getUserInfo();
  if (!user) return <Empty message="Please sign in" />;
  const task = await findAITaskById(id);
  if (!task || task.userId !== user.id || !task.provider || !task.status) {
    return <Empty message="Task not found" />;
  }
  if (isBrowQueuedTask(task)) {
    startBrowQueueWorker();
    redirect({ href: `/activity/ai-tasks`, locale });
    return null;
  }
  if (!task.taskId) return <Empty message="Task not found" />;

  // query task
  if (
    [AITaskStatus.PENDING, AITaskStatus.PROCESSING].includes(
      task.status as AITaskStatus
    )
  ) {
    const aiService = await getAIService();
    const aiProvider = aiService.getProvider(task.provider);
    if (!aiProvider) {
      return <Empty message="Invalid AI provider" />;
    }

    const result = await aiProvider?.query?.({
      taskId: task.taskId,
      mediaType: task.mediaType,
      model: task.model,
    });

    if (result?.taskStatus) {
      await updateAITaskById(task.id, {
        status: result.taskStatus,
        creditId: task.creditId,
        taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
        taskResult: result.taskResult
          ? JSON.stringify(result.taskResult)
          : null,
      });
    }
  }

  redirect({ href: `/activity/ai-tasks`, locale });
}
