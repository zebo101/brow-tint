import { R2Provider, type StorageProvider } from '@/extensions/storage';
import {
  browResultUrl,
  browStoredCopy,
  hasBrowStoredCopy,
  isBrowTask,
  withBrowStoredCopy,
  type BrowExportTask,
} from '@/shared/lib/brow-export';
import {
  findAITaskById,
  setAITaskInfoForCompletedTask,
} from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';

import { MAX_BROW_IMAGE_BYTES, normalizeBrowExport } from './brow-export-image';
import { fetchBrowProviderImage } from './brow-provider-image';
import { getBrowTintStorageService } from './brow-tint-storage';

let warnedUnconfigured = false;
async function privateProvider(): Promise<StorageProvider | null> {
  const configs = await getAllConfigs();
  if (configs.r2_access_key && configs.r2_secret_key) {
    if (configs.r2_bucket_name) {
      return new R2Provider({
        accountId: configs.r2_account_id || '',
        accessKeyId: configs.r2_access_key,
        secretAccessKey: configs.r2_secret_key,
        bucket: configs.r2_bucket_name,
        uploadPath: configs.r2_upload_path,
        region: 'auto',
        endpoint: configs.r2_endpoint,
      });
    }
    return getBrowTintStorageService(configs);
  }
  if (!warnedUnconfigured) {
    console.info(
      '[brow-results] Durable storage disabled: R2 is not configured.'
    );
    warnedUnconfigured = true;
  }
  return null;
}

interface BrowResultStorageDependencies {
  provider: () => Promise<StorageProvider | null>;
  task: (id: string) => Promise<BrowExportTask | null | undefined>;
  save: (id: string, taskInfo: string) => Promise<unknown>;
  image: (url: string) => Promise<Buffer>;
  normalize: (image: Buffer) => Promise<Buffer>;
}

/** A separate instance allows isolated tests without storage, network or database access. */
export function createBrowResultStorage(deps: BrowResultStorageDependencies) {
  const pending = new Map<string, Promise<void>>();

  function persistBrowResult(
    task: BrowExportTask,
    downloaded?: Buffer
  ): Promise<void> {
    const existing = pending.get(task.id);
    if (existing) return existing;
    const operation = (async () => {
      try {
        if (
          !isBrowTask(task) ||
          task.status !== 'success' ||
          task.deletedAt ||
          hasBrowStoredCopy(task)
        )
          return;
        const provider = await deps.provider();
        if (!provider) return;
        // Reload before merging: callers may have a pre-completion or stale snapshot.
        const current = await deps.task(task.id);
        if (
          !current ||
          !isBrowTask(current) ||
          current.status !== 'success' ||
          current.deletedAt ||
          hasBrowStoredCopy(current)
        )
          return;
        const source = browResultUrl(current);
        if (!downloaded && !source) return;
        const original = downloaded ?? (await deps.image(source!));
        if (original.length > MAX_BROW_IMAGE_BYTES)
          throw new Error('image_too_large');
        const body = await deps.normalize(original);
        if (body.length > MAX_BROW_IMAGE_BYTES)
          throw new Error('image_too_large');
        const key = `brow-results/${current.userId}/${current.id}.png`;
        const uploaded = await provider.uploadFile({
          body,
          key,
          contentType: 'image/png',
        });
        if (!uploaded.success || !uploaded.bucket)
          throw new Error('storage_upload_failed');
        await deps.save(
          current.id,
          withBrowStoredCopy(current, {
            provider: 'r2',
            bucket: uploaded.bucket,
            key,
            storedAt: new Date().toISOString(),
          })
        );
      } catch {
        // No provider URLs, prompts, photographs, credentials or raw errors in logs.
        console.warn(
          '[brow-results] Could not persist result; a later preview can retry.'
        );
      }
    })();
    pending.set(task.id, operation);
    void operation.finally(() => pending.delete(task.id));
    return operation;
  }

  async function readBrowStoredImage(
    task: BrowExportTask
  ): Promise<Buffer | null> {
    const stored = browStoredCopy(task);
    if (!stored) return null;
    const provider = await deps.provider();
    if (!provider?.downloadFile) return null;
    return provider.downloadFile({ bucket: stored.bucket, key: stored.key });
  }

  return { persistBrowResult, readBrowStoredImage };
}

export const { persistBrowResult, readBrowStoredImage } =
  createBrowResultStorage({
    provider: privateProvider,
    task: findAITaskById,
    save: setAITaskInfoForCompletedTask,
    image: fetchBrowProviderImage,
    normalize: normalizeBrowExport,
  });

/** Best-effort completion hook: never block a response or propagate a DB/storage failure. */
export async function persistBrowResultById(id: string): Promise<void> {
  try {
    const task = await findAITaskById(id);
    if (task) await persistBrowResult(task);
  } catch {
    console.warn('[brow-results] Could not load completed result for storage.');
  }
}
