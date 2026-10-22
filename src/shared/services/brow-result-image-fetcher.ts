import {
  BrowExportError,
  browResultUrl,
  type BrowExportTask,
} from '@/shared/lib/brow-export';

import { MAX_BROW_IMAGE_BYTES } from './brow-export-image';

/** Fetch a result without coupling the fallback policy to storage or DB setup. */
export function createBrowResultImageFetcher(deps: {
  stored: (task: BrowExportTask) => Promise<Buffer | null>;
  provider: (source: string) => Promise<Buffer>;
  persist: (task: BrowExportTask, downloaded?: Buffer) => Promise<void>;
}) {
  return async (task: BrowExportTask): Promise<Buffer> => {
    let storageUnavailable = false;
    let stored: Buffer | null = null;
    try {
      stored = await deps.stored(task);
    } catch {
      storageUnavailable = true;
      console.warn('[brow-results] Stored image unavailable; trying provider.');
    }
    if (stored) {
      if (stored.length > MAX_BROW_IMAGE_BYTES)
        throw new BrowExportError('image_too_large', 413);
      return stored;
    }
    const source = browResultUrl(task);
    if (!source) throw new BrowExportError('result_not_ready', 409);
    try {
      const image = await deps.provider(source);
      // Reuse the original bytes; no second provider download during backfill.
      void deps.persist(task, image);
      return image;
    } catch (error) {
      // A temporary R2 outage is not evidence that a durable image expired.
      if (
        storageUnavailable &&
        error instanceof BrowExportError &&
        error.status === 410
      )
        throw new BrowExportError('result_unavailable', 502);
      throw error;
    }
  };
}
