import { createBrowResultsHandlers } from '@/shared/lib/brow-results-handlers';
import {
  findAITaskById,
  getAITasks,
  softDeleteAITaskForUser,
} from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import { getBrowEntitlements } from '@/shared/services/brow-entitlements';

export const runtime = 'nodejs';

const handlers = createBrowResultsHandlers({
  user: getUserInfo,
  entitlements: getBrowEntitlements,
  tasks: getAITasks,
  task: findAITaskById,
  remove: softDeleteAITaskForUser,
});

export const GET = handlers.get;
export const DELETE = handlers.delete;
