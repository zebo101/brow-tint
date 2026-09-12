import { browExportHandlers } from '@/shared/services/brow-export';

export const runtime = 'nodejs';
export const POST = browExportHandlers.export;
export const GET = browExportHandlers.entitlements;
