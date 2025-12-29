/**
 * Hairstyle-specific storage service using dedicated R2 bucket
 */

import { R2Provider } from '@/extensions/storage';
import { getAllConfigs, Configs } from '@/shared/models/config';

// Use environment variable or fallback to 'hairstyles' bucket
const HAIRSTYLES_BUCKET = process.env.R2_HAIRSTYLES_BUCKET || 'hairstyles';
const HAIRSTYLES_DOMAIN = process.env.R2_HAIRSTYLES_DOMAIN;

/**
 * Get hairstyle storage service with dedicated bucket
 */
export async function getHairstyleStorageService(configs?: Configs) {
  if (!configs) {
    configs = await getAllConfigs();
  }

  // Check for required R2 credentials
  if (!configs.r2_access_key || !configs.r2_secret_key) {
    throw new Error('R2 credentials not configured');
  }

  const accountId = configs.r2_account_id || '';

  // Return R2 provider configured for hairstyles bucket
  return new R2Provider({
    accountId: accountId,
    accessKeyId: configs.r2_access_key,
    secretAccessKey: configs.r2_secret_key,
    bucket: HAIRSTYLES_BUCKET,
    uploadPath: '', // No upload path prefix for dedicated bucket
    region: 'auto',
    endpoint: configs.r2_endpoint,
    publicDomain: HAIRSTYLES_DOMAIN || undefined,
  });
}
