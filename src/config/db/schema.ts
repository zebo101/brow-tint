/**
 * DB schema facade.
 *
 * Exports the correct Drizzle table definitions based on DATABASE_PROVIDER:
 * - postgresql -> `schema.pg.ts`
 * - sqlite/turso -> `schema.sqlite.ts`
 *
 * This prevents subtle dialect mismatches (e.g. `now()` in SQLite/libsql).
 */
import { envConfigs } from '@/config';

const isSqliteLike = ['sqlite', 'turso'].includes(envConfigs.database_provider);

// Note: `export * from` must be static; use dynamic require to preserve a single import path for callers.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const schema = isSqliteLike
  ? require('./schema.sqlite')
  : require('./schema.pg');

export const {
  user,
  session,
  account,
  verification,
  config,
  taxonomy,
  post,
  order,
  subscription,
  credit,
  apikey,
  role,
  permission,
  rolePermission,
  userRole,
  aiTask,
  chat,
  chatMessage,
  browStyle,
  browJob,
  browLookbook,
} = schema;
