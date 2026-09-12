import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import { envConfigs } from '@/config';
import { aiTask } from '@/config/db/schema';
import type { AIGenerateParams } from '@/extensions/ai/types';
import { getUuid } from '@/shared/lib/hash';
import {
  createAITask,
  updateAITaskById,
  type NewAITask,
} from '@/shared/models/ai_task';

import {
  BROW_QUEUE_KEY,
  BROW_QUEUE_LEASE_MS,
  BROW_QUEUE_POLL_MS,
  chooseBrowQueueAction,
  isTerminalBrowTask,
  readBrowQueueMetadata,
  type BrowQueueAction,
  type BrowQueueMetadata,
  type BrowQueueOutcome,
} from './brow-queue-engine';

// Avoid local libsql connection contention between HTTP and worker operations.
// Cross-process exclusion still comes from the database write transaction.
const sqliteTransactions = new WeakMap<object, Promise<void>>();

// PostgreSQL needs a queue-wide advisory lock. Turso/libsql's write transaction
// already admits one writer, including transactions from other server processes.
async function lockQueue(tx: any, isSqlite: boolean) {
  if (isSqlite) return;
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('browlens:queue:v1'))`
  );
}

async function databaseTime(
  tx: any,
  isSqlite: boolean
): Promise<{ now: number; order: string }> {
  if (isSqlite) {
    const [row] = await tx.all(sql`select
      cast((julianday('now') - 2440587.5) * 86400000 as integer) as now,
      printf('%020d', coalesce(max(rowid), 0) + 1) as "order" from ${aiTask}`);
    // SQLite rowids advance under the same write lock as admission. Unlike its
    // millisecond clock, they keep FIFO even for simultaneous admission times.
    return { now: Number(row.now), order: row.order };
  }
  const result = await tx.execute(sql`select
    floor(extract(epoch from clock_timestamp()) * 1000)::double precision as now,
    to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') as "order"`);
  const [row] = Array.isArray(result) ? result : result.rows;
  return { now: Number(row.now), order: row.order };
}

export function createBrowQueueStore(
  database: any,
  dialect = envConfigs.database_provider
) {
  const isSqlite = ['sqlite', 'turso'].includes(dialect);
  function transaction<T>(execute: (tx: any) => Promise<T>): Promise<T> {
    if (!isSqlite) return database.transaction(execute);
    const previous = sqliteTransactions.get(database) || Promise.resolve();
    // Drizzle's libsql adapter uses client.transaction(), whose default mode is
    // "write" (BEGIN IMMEDIATE), before invoking our callback. Never retry a
    // failed/ambiguous transaction here: a successful commit may be unknown.
    const operation = previous.then(() =>
      database.transaction(execute, { behavior: 'immediate' })
    );
    sqliteTransactions.set(
      database,
      operation.then(
        () => undefined,
        () => undefined
      )
    );
    return operation;
  }
  return {
    async enqueue(
      task: NewAITask,
      params: AIGenerateParams,
      priority: 0 | 1 | 2
    ) {
      return transaction(async (tx: any) => {
        await lockQueue(tx, isSqlite);
        const { order } = await databaseTime(tx, isSqlite);
        const metadata: BrowQueueMetadata = {
          version: 1,
          priority,
          order,
          phase: 'waiting',
          params,
        };
        return createAITask(
          {
            ...task,
            status: 'pending',
            taskId: null,
            options: JSON.stringify({
              ...JSON.parse(task.options || '{}'),
              [BROW_QUEUE_KEY]: metadata,
            }),
            taskInfo: JSON.stringify({ status: 'queued' }),
          },
          tx
        );
      });
    },

    async claim(): Promise<
      (BrowQueueAction & { now: number; provider: string }) | undefined
    > {
      return transaction(async (tx: any) => {
        await lockQueue(tx, isSqlite);
        const { now } = await databaseTime(tx, isSqlite);
        const rowsQuery = tx
          .select()
          .from(aiTask)
          .where(
            and(
              eq(aiTask.mediaType, 'image'),
              eq(aiTask.scene, 'image-to-image'),
              inArray(aiTask.status, ['pending', 'processing']),
              isNull(aiTask.deletedAt)
            )
          );
        const rows = await (isSqlite ? rowsQuery : rowsQuery.for('update'));
        const tasks = rows.flatMap((row: any) => {
          const metadata = readBrowQueueMetadata(row.options);
          return metadata
            ? [{ id: row.id, status: row.status, taskId: row.taskId, metadata }]
            : [];
        });
        const action = chooseBrowQueueAction(tasks, now);
        if (!action) return undefined;
        const row = rows.find(
          (candidate: any) => candidate.id === action.task.id
        );
        const metadata: BrowQueueMetadata = {
          ...action.task.metadata,
          ...(action.kind === 'submit'
            ? { phase: 'submitting' as const, startedAt: now }
            : {}),
          leaseUntil: now + BROW_QUEUE_LEASE_MS,
          claimToken: getUuid(),
        };
        await tx
          .update(aiTask)
          .set({
            status: 'processing',
            options: JSON.stringify({
              ...JSON.parse(row.options),
              [BROW_QUEUE_KEY]: metadata,
            }),
            ...(action.kind === 'submit'
              ? { taskInfo: JSON.stringify({ status: 'submitting' }) }
              : {}),
          })
          .where(eq(aiTask.id, row.id));
        return {
          ...action,
          task: { ...action.task, metadata },
          provider: row.provider,
          now,
        };
      });
    },

    async complete(action: BrowQueueAction, outcome: BrowQueueOutcome) {
      return transaction(async (tx: any) => {
        const rowQuery = tx
          .select()
          .from(aiTask)
          .where(eq(aiTask.id, action.task.id));
        const [row] = await (isSqlite ? rowQuery : rowQuery.for('update'));
        if (!row || isTerminalBrowTask(row.status)) return row;
        const metadata = readBrowQueueMetadata(row.options);
        // An expired worker must never overwrite a recovery worker's result.
        if (
          !metadata ||
          metadata.claimToken !== action.task.metadata.claimToken
        )
          return row;
        const { now } = await databaseTime(tx, isSqlite);
        return updateAITaskById(
          row.id,
          {
            status: outcome.status,
            ...(outcome.taskId ? { taskId: outcome.taskId } : {}),
            ...(outcome.taskInfo !== undefined
              ? { taskInfo: JSON.stringify(outcome.taskInfo) }
              : {}),
            ...(outcome.taskResult !== undefined
              ? { taskResult: JSON.stringify(outcome.taskResult) }
              : {}),
            options: JSON.stringify({
              ...JSON.parse(row.options),
              [BROW_QUEUE_KEY]: {
                ...(outcome.metadata || metadata),
                leaseUntil: 0,
                // Schedule against DB time after a potentially slow provider call.
                nextPollAt: now + (outcome.retryAfterMs ?? BROW_QUEUE_POLL_MS),
              },
            }),
          },
          tx
        );
      });
    },
  };
}
