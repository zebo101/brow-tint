import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import {
  BrowExportError,
  browResultUrl,
  type BrowExportTask,
} from '@/shared/lib/brow-export';
import { createBrowExportHandlers } from '@/shared/lib/brow-export-handlers';
import { findAITaskById } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import { getBrowEntitlements } from '@/shared/services/brow-entitlements';
import { MAX_BROW_IMAGE_BYTES } from '@/shared/services/brow-export-image';

function publicAddress(address: string) {
  if (isIP(address) === 6) return !/^(::|fc|fd|fe[89ab]|ff)/i.test(address);
  const [a, b] = address.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export async function fetchBrowResultImage(
  task: BrowExportTask
): Promise<Buffer> {
  const source = browResultUrl(task);
  if (!source) throw new BrowExportError('result_not_ready', 409);
  const url = new URL(source);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  )
    throw new BrowExportError('invalid_result', 502);
  const addresses = await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !publicAddress(address))
  )
    throw new BrowExportError('invalid_result', 502);
  // Inputs come exclusively from the stored provider result, never the request URL.
  const response = await fetch(url, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || !response.body)
    throw new BrowExportError('result_unavailable', 502);
  if (Number(response.headers.get('content-length')) > MAX_BROW_IMAGE_BYTES)
    throw new BrowExportError('image_too_large', 413);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BROW_IMAGE_BYTES) {
      await reader.cancel();
      throw new BrowExportError('image_too_large', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export const browExportHandlers = createBrowExportHandlers({
  user: getUserInfo,
  entitlements: getBrowEntitlements,
  task: findAITaskById,
  image: fetchBrowResultImage,
});
