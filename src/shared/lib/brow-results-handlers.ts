import { createHash } from 'node:crypto';

import {
  BrowExportError,
  browExportMetadata,
  browResultUrl,
  hasBrowStoredCopy,
  isBrowResultExpired,
  isBrowTask,
  type BrowExportEntitlements,
  type BrowExportTask,
} from './brow-export';
import {
  browExportErrorResponse,
  readLimitedBody,
} from './brow-export-handlers';

interface BrowResultsDependencies {
  user: () => Promise<{ id: string } | null | undefined>;
  entitlements: (userId: string) => Promise<BrowExportEntitlements>;
  tasks: (options: {
    userId: string;
    mediaType: string;
    status: string;
    excludeDeleted: boolean;
    limit: number;
    page?: number;
  }) => Promise<BrowExportTask[]>;
  task: (id: string) => Promise<BrowExportTask | null | undefined>;
  remove: (
    id: string,
    userId: string,
    expectedTaskInfo?: string | null
  ) => Promise<number>;
}

const headers = { 'Cache-Control': 'private, no-store' };

export function createBrowResultsHandlers(deps: BrowResultsDependencies) {
  async function user() {
    const current = await deps.user();
    if (!current) throw new BrowExportError('sign_in_required', 401);
    return current;
  }
  const options = (userId: string, limit: number, page = 1) => ({
    userId,
    mediaType: 'image',
    status: 'success',
    excludeDeleted: true,
    limit,
    page,
  });
  return {
    async get() {
      try {
        const current = await user();
        const [entitlements, tasks] = await Promise.all([
          deps.entitlements(current.id),
          deps.tasks(options(current.id, 40)),
        ]);
        const now = Date.now();
        const results = tasks.flatMap((task) => {
          const metadata = browExportMetadata(task);
          if (
            task.deletedAt ||
            !metadata ||
            task.scene !== 'image-to-image' ||
            (!hasBrowStoredCopy(task) && !browResultUrl(task))
          )
            return [];
          return [
            {
              id: task.id,
              styleId: metadata.styleId,
              styleName: metadata.styleName,
              photoGroup: createHash('sha256')
                .update(metadata.source)
                .digest('hex'),
              previewUrl: `/api/brow/preview?taskId=${encodeURIComponent(task.id)}`,
              createdAt: task.createdAt,
              expired: isBrowResultExpired(task, now),
            },
          ];
        });
        return Response.json({ entitlements, results }, { headers });
      } catch (error) {
        return browExportErrorResponse(error);
      }
    },
    async delete(request: Request) {
      try {
        const current = await user();
        const queryId = new URL(request.url).searchParams.get('taskId');
        let body: { taskId?: unknown; expired?: unknown } | null;
        try {
          body =
            queryId !== null
              ? { taskId: queryId }
              : JSON.parse((await readLimitedBody(request, 2048)).toString());
        } catch {
          throw new BrowExportError('invalid_selection');
        }
        let deleted = 0;
        if (body?.expired === true && body.taskId === undefined) {
          // Collect before deleting so pagination cannot skip rows as they disappear.
          const expired: BrowExportTask[] = [];
          const now = Date.now();
          for (let page = 1; ; page++) {
            const tasks = await deps.tasks(options(current.id, 100, page));
            expired.push(
              ...tasks.filter(
                (task) =>
                  task.userId === current.id &&
                  !task.deletedAt &&
                  task.status === 'success' &&
                  isBrowTask(task) &&
                  isBrowResultExpired(task, now)
              )
            );
            if (tasks.length < 100) break;
          }
          for (const task of expired) {
            // A preview may have just rescued this row; don't delete newly stored results.
            deleted += await deps.remove(
              task.id,
              current.id,
              task.taskInfo ?? null
            );
          }
        } else {
          const id = body?.taskId;
          if (
            typeof id !== 'string' ||
            !id.trim() ||
            id.length > 128 ||
            body?.expired !== undefined
          )
            throw new BrowExportError('invalid_selection');
          const task = await deps.task(id);
          if (!task || task.userId !== current.id || !isBrowTask(task))
            throw new BrowExportError('result_not_found', 404);
          if (!task.deletedAt) deleted = await deps.remove(id, current.id);
        }
        return Response.json({ ok: true, deleted }, { headers });
      } catch (error) {
        return browExportErrorResponse(error);
      }
    },
  };
}
