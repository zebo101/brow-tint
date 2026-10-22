import { createBrowExportHandlers } from '@/shared/lib/brow-export-handlers';
import { findAITaskById } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import { getBrowEntitlements } from '@/shared/services/brow-entitlements';

import { fetchBrowProviderImage } from './brow-provider-image';
import { createBrowResultImageFetcher } from './brow-result-image-fetcher';
import { persistBrowResult, readBrowStoredImage } from './brow-result-storage';

export { createBrowResultImageFetcher } from './brow-result-image-fetcher';

export const fetchBrowResultImage = createBrowResultImageFetcher({
  stored: readBrowStoredImage,
  provider: fetchBrowProviderImage,
  persist: persistBrowResult,
});

export const browExportHandlers = createBrowExportHandlers({
  user: getUserInfo,
  entitlements: getBrowEntitlements,
  task: findAITaskById,
  image: fetchBrowResultImage,
});
