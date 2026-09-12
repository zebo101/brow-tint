import { and, count, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { aiTask, credit } from '@/config/db/schema';
import { AITaskStatus } from '@/extensions/ai';
import { appendUserToResult, User } from '@/shared/models/user';

import { consumeCredits, CreditStatus } from './credit';

export type AITask = typeof aiTask.$inferSelect & {
  user?: User;
};
export type NewAITask = typeof aiTask.$inferInsert;
export type UpdateAITask = Partial<Omit<NewAITask, 'id' | 'createdAt'>>;

export async function createAITask(newAITask: NewAITask, transaction?: any) {
  const execute = async (tx: any) => {
    // 1. create task record
    const [taskResult] = await tx.insert(aiTask).values(newAITask).returning();

    if (newAITask.costCredits && newAITask.costCredits > 0) {
      // 2. consume credits
      const consumedCredit = await consumeCredits({
        userId: newAITask.userId,
        credits: newAITask.costCredits,
        scene: newAITask.scene,
        description: `generate ${newAITask.mediaType}`,
        metadata: JSON.stringify({
          type: 'ai-task',
          mediaType: taskResult.mediaType,
          taskId: taskResult.id,
        }),
        tx,
      });

      // 3. update task record with consumed credit id
      if (consumedCredit && consumedCredit.id) {
        taskResult.creditId = consumedCredit.id;
        await tx
          .update(aiTask)
          .set({ creditId: consumedCredit.id })
          .where(eq(aiTask.id, taskResult.id));
      }
    }

    return taskResult;
  };

  return transaction ? execute(transaction) : db().transaction(execute);
}

export async function findAITaskById(id: string) {
  const [result] = await db().select().from(aiTask).where(eq(aiTask.id, id));
  return result;
}

export async function findAITaskByProviderTaskId({
  provider,
  taskId,
}: {
  provider: string;
  taskId: string;
}) {
  const [result] = await db()
    .select()
    .from(aiTask)
    .where(and(eq(aiTask.provider, provider), eq(aiTask.taskId, taskId)));

  return result;
}

export async function updateAITaskById(
  id: string,
  updateAITask: UpdateAITask,
  transaction?: any
) {
  const execute = async (tx: any) => {
    const taskQuery = tx.select().from(aiTask).where(eq(aiTask.id, id));
    const [existingTask] = await (taskQuery.for
      ? taskQuery.for('update')
      : taskQuery);
    if (!existingTask) return undefined;
    // A slow poll or late callback must not overwrite a completed/refunded task.
    if (['success', 'failed', 'canceled'].includes(existingTask.status))
      return existingTask;

    // task failed, Revoke credit consumption record
    if (
      [AITaskStatus.FAILED, AITaskStatus.CANCELED].includes(
        updateAITask.status as AITaskStatus
      ) &&
      existingTask.creditId
    ) {
      // Atomically take responsibility for this refund. Concurrent callbacks
      // and worker recovery can refund the same consumption only once.
      const [consumedCredit] = await tx
        .update(credit)
        .set({ status: CreditStatus.DELETED })
        .where(
          and(
            eq(credit.id, existingTask.creditId),
            eq(credit.status, CreditStatus.ACTIVE)
          )
        )
        .returning();
      if (consumedCredit) {
        const consumedItems = JSON.parse(consumedCredit.consumedDetail || '[]');

        // console.log('consumedItems', consumedItems);

        // add back consumed credits
        for (const item of consumedItems) {
          if (item && item.creditId && item.creditsConsumed > 0) {
            await tx
              .update(credit)
              .set({
                remainingCredits: sql`${credit.remainingCredits} + ${item.creditsConsumed}`,
              })
              .where(eq(credit.id, item.creditId));
          }
        }
      }
    }

    // update task
    const [result] = await tx
      .update(aiTask)
      .set({ ...updateAITask, creditId: existingTask.creditId })
      .where(eq(aiTask.id, id))
      .returning();

    return result;
  };

  return transaction ? execute(transaction) : db().transaction(execute);
}

export async function getAITasksCount({
  userId,
  status,
  mediaType,
  provider,
}: {
  userId?: string;
  status?: string;
  mediaType?: string;
  provider?: string;
}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        provider ? eq(aiTask.provider, provider) : undefined,
        status ? eq(aiTask.status, status) : undefined
      )
    );

  return result?.count || 0;
}

export async function getAITasks({
  userId,
  status,
  mediaType,
  provider,
  page = 1,
  limit = 30,
  getUser = false,
}: {
  userId?: string;
  status?: string;
  mediaType?: string;
  provider?: string;
  page?: number;
  limit?: number;
  getUser?: boolean;
}): Promise<AITask[]> {
  const result = await db()
    .select()
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        provider ? eq(aiTask.provider, provider) : undefined,
        status ? eq(aiTask.status, status) : undefined
      )
    )
    .orderBy(desc(aiTask.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}
