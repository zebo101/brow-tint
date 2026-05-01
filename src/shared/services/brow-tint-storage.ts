/**
 * Brow tint-specific storage service using dedicated R2 bucket
 */

import { R2Provider } from '@/extensions/storage';
import { getAllConfigs, Configs } from '@/shared/models/config';

// Use environment variable or fallback to 'brow-tints' bucket.
// NOTE: if your actual R2 bucket is still named "hairstyles" (from the prior
// deployment), set R2_BROW_TINT_BUCKET=hairstyles in your env until the bucket
// is renamed.
const BROW_TINT_BUCKET = process.env.R2_BROW_TINT_BUCKET || 'brow-tints';
const BROW_TINT_DOMAIN = process.env.R2_BROW_TINT_DOMAIN;

/**
 * Get brow tint storage service with dedicated bucket
 */
export async function getBrowTintStorageService(configs?: Configs) {
  if (!configs) {
    configs = await getAllConfigs();
  }

  // Check for required R2 credentials
  if (!configs.r2_access_key || !configs.r2_secret_key) {
    throw new Error('R2 credentials not configured');
  }

  const accountId = configs.r2_account_id || '';

  // Return R2 provider configured for brow tint bucket
  return new R2Provider({
    accountId: accountId,
    accessKeyId: configs.r2_access_key,
    secretAccessKey: configs.r2_secret_key,
    bucket: BROW_TINT_BUCKET,
    uploadPath: '', // No upload path prefix for dedicated bucket
    region: 'auto',
    endpoint: configs.r2_endpoint,
    publicDomain: BROW_TINT_DOMAIN || undefined,
  });
}
