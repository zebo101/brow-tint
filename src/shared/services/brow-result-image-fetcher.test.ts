import assert from 'node:assert/strict';
import test from 'node:test';

import { BrowExportError, type BrowExportTask } from '@/shared/lib/brow-export';
import { createBrowExportHandlers } from '@/shared/lib/brow-export-handlers';

import { MAX_BROW_IMAGE_BYTES } from './brow-export-image';
import { createBrowResultImageFetcher } from './brow-result-image-fetcher';

const source = 'https://provider.invalid/result.png';

function task(id = 'result'): BrowExportTask {
  return {
    id,
    userId: 'owner',
    status: 'success',
    mediaType: 'image',
    scene: 'image-to-image',
    options: JSON.stringify({
      __browExport: {
        styleId: id,
        styleName: `Style ${id}`,
        source: 'https://uploads.invalid/photo.png',
      },
    }),
    taskInfo: JSON.stringify({ images: [{ imageUrl: source }] }),
  };
}

test('stored bytes are preferred even when the provider URL is absent', async (t) => {
  const result = { ...task(), taskInfo: null };
  const image = Buffer.from('stored image');
  const stored = t.mock.fn(async (current: BrowExportTask) => {
    assert.equal(current, result);
    return image;
  });
  const provider = t.mock.fn(async () => Buffer.from('provider image'));
  const persist = t.mock.fn(async () => {});
  const fetchImage = createBrowResultImageFetcher({
    stored,
    provider,
    persist,
  });

  assert.equal(await fetchImage(result), image);
  assert.equal(stored.mock.callCount(), 1);
  assert.equal(provider.mock.callCount(), 0);
  assert.equal(persist.mock.callCount(), 0);
});

test('provider bytes are returned and the same buffer is passed to persistence once', async (t) => {
  const result = task();
  const image = Buffer.from('provider image');
  const persisted: { task: BrowExportTask; image?: Buffer }[] = [];
  const provider = t.mock.fn(async (url: string) => {
    assert.equal(url, source);
    return image;
  });
  const fetchImage = createBrowResultImageFetcher({
    stored: async () => null,
    provider,
    persist: async (current, downloaded) => {
      persisted.push({ task: current, image: downloaded });
    },
  });

  assert.equal(await fetchImage(result), image);
  assert.equal(provider.mock.callCount(), 1);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].task, result);
  assert.equal(persisted[0].image, image);
});

test('provider expiration propagates as 410 when storage has no copy', async (t) => {
  const expired = new BrowExportError('result_expired', 410);
  const persist = t.mock.fn(async () => {});
  const fetchImage = createBrowResultImageFetcher({
    stored: async () => null,
    provider: async () => {
      throw expired;
    },
    persist,
  });

  await assert.rejects(fetchImage(task()), (error) => {
    assert.equal(error, expired);
    assert.equal(expired.status, 410);
    assert.equal(expired.message, 'result_expired');
    return true;
  });
  assert.equal(persist.mock.callCount(), 0);
});

test('storage outage plus provider expiration becomes 502 result_unavailable', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const persist = t.mock.fn(async () => {});
  const fetchImage = createBrowResultImageFetcher({
    stored: async () => {
      throw new Error('storage offline');
    },
    provider: async () => {
      throw new BrowExportError('result_expired', 410);
    },
    persist,
  });

  await assert.rejects(fetchImage(task()), {
    constructor: BrowExportError,
    message: 'result_unavailable',
    status: 502,
  });
  assert.equal(persist.mock.callCount(), 0);
});

test('storage outages still fall back to provider bytes and persistence', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const result = task();
  const image = Buffer.from('recovered provider image');
  const persisted: { task: BrowExportTask; image?: Buffer }[] = [];
  const fetchImage = createBrowResultImageFetcher({
    stored: async () => {
      throw new Error('storage offline');
    },
    provider: async () => image,
    persist: async (current, downloaded) => {
      persisted.push({ task: current, image: downloaded });
    },
  });

  assert.equal(await fetchImage(result), image);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].task, result);
  assert.equal(persisted[0].image, image);
});

test('storage outages do not remap non-expiration provider errors', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const tooLarge = new BrowExportError('image_too_large', 413);
  const persist = t.mock.fn(async () => {});
  const fetchImage = createBrowResultImageFetcher({
    stored: async () => {
      throw new Error('storage offline');
    },
    provider: async () => {
      throw tooLarge;
    },
    persist,
  });

  await assert.rejects(fetchImage(task()), (error) => error === tooLarge);
  assert.equal(persist.mock.callCount(), 0);
});

test('oversized stored images are rejected without provider or persistence calls', async (t) => {
  const provider = t.mock.fn(async () => Buffer.from('provider image'));
  const persist = t.mock.fn(async () => {});
  const fetchImage = createBrowResultImageFetcher({
    stored: async () => Buffer.alloc(MAX_BROW_IMAGE_BYTES + 1),
    provider,
    persist,
  });

  await assert.rejects(fetchImage(task()), {
    message: 'image_too_large',
    status: 413,
  });
  assert.equal(provider.mock.callCount(), 0);
  assert.equal(persist.mock.callCount(), 0);
});

test('a missing stored copy and missing provider URL report result_not_ready', async (t) => {
  const provider = t.mock.fn(async () => Buffer.from('provider image'));
  const persist = t.mock.fn(async () => {});
  const fetchImage = createBrowResultImageFetcher({
    stored: async () => null,
    provider,
    persist,
  });

  await assert.rejects(fetchImage({ ...task(), taskInfo: null }), {
    message: 'result_not_ready',
    status: 409,
  });
  assert.equal(provider.mock.callCount(), 0);
  assert.equal(persist.mock.callCount(), 0);
});

test('HD and comparison exports return HTTP 410 with the result_expired code', async () => {
  const image = createBrowResultImageFetcher({
    stored: async () => null,
    provider: async () => {
      throw new BrowExportError('result_expired', 410);
    },
    persist: async () => {},
  });
  const handlers = createBrowExportHandlers({
    user: async () => ({ id: 'owner' }),
    entitlements: async () => ({ canExport: true, canCompare: true }),
    task: async (id) => task(id),
    image,
  });

  for (const taskIds of [['result'], ['result', 'another-result']]) {
    const response = await handlers.export(
      new Request('https://app.invalid/api/brow/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds }),
      })
    );
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { error: 'result_expired' });
  }
});
