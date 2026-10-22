import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BROW_PROVIDER_RETENTION_MS,
  withBrowStoredCopy,
  type BrowExportEntitlements,
  type BrowExportTask,
} from './brow-export';
import { createBrowResultsHandlers } from './brow-results-handlers';

type Dependencies = Parameters<typeof createBrowResultsHandlers>[0];
const now = Date.parse('2026-02-01T00:00:00.000Z');
const entitlements = { canExport: true, canCompare: true };

function task(
  id: string,
  overrides: Partial<BrowExportTask> = {}
): BrowExportTask {
  return {
    id,
    userId: 'owner',
    status: 'success',
    mediaType: 'image',
    scene: 'image-to-image',
    createdAt: new Date(now),
    options: JSON.stringify({
      __browExport: {
        styleId: id,
        styleName: `Style ${id}`,
        source: 'https://uploads.invalid/photo.png',
      },
    }),
    taskInfo: JSON.stringify({
      images: [{ imageUrl: 'https://provider.invalid/result.png' }],
    }),
    ...overrides,
  };
}

function dependencies(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    user: async () => ({ id: 'owner' }),
    entitlements: async () => entitlements,
    tasks: async () => [],
    task: async () => undefined,
    remove: async () => assert.fail('Unexpected deletion'),
    ...overrides,
  };
}

test('GET excludes deleted results and flags only expired provider-only results', async (t) => {
  t.mock.method(Date, 'now', () => now);
  const stored = task('stored', {
    createdAt: new Date(now - 90 * 24 * 60 * 60 * 1000),
    taskInfo: null,
  });
  stored.taskInfo = withBrowStoredCopy(stored, {
    provider: 'r2',
    bucket: 'private-results',
    key: 'brow-results/owner/stored.png',
    storedAt: '2025-11-03T00:00:00.000Z',
  });
  const tasks = [
    task('recent', {
      createdAt: new Date(now - BROW_PROVIDER_RETENTION_MS + 1),
    }),
    task('boundary', { createdAt: new Date(now - BROW_PROVIDER_RETENTION_MS) }),
    task('expired', {
      createdAt: new Date(now - BROW_PROVIDER_RETENTION_MS - 1),
    }),
    stored,
    task('deleted', { deletedAt: new Date(now) }),
    task('deleted-expired', {
      createdAt: new Date(now - BROW_PROVIDER_RETENTION_MS - 1),
      deletedAt: new Date(now),
    }),
    task('no-output', { taskInfo: null }),
    task('no-metadata', { options: null }),
    task('wrong-scene', { scene: 'text-to-image' }),
  ];
  const queries: Parameters<Dependencies['tasks']>[0][] = [];
  const handlers = createBrowResultsHandlers(
    dependencies({
      entitlements: async (userId) => {
        assert.equal(userId, 'owner');
        return entitlements;
      },
      tasks: async (options) => {
        queries.push(options);
        // Return deleted rows too to exercise the handler's defensive filter.
        return tasks;
      },
    })
  );

  const response = await handlers.get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(queries, [
    {
      userId: 'owner',
      mediaType: 'image',
      status: 'success',
      excludeDeleted: true,
      limit: 40,
      page: 1,
    },
  ]);
  const body: {
    entitlements: BrowExportEntitlements;
    results: { id: string; expired: boolean; previewUrl: string }[];
  } = await response.json();
  assert.deepEqual(body.entitlements, entitlements);
  assert.deepEqual(
    body.results.map(({ id, expired }) => ({ id, expired })),
    [
      { id: 'recent', expired: false },
      { id: 'boundary', expired: false },
      { id: 'expired', expired: true },
      { id: 'stored', expired: false },
    ]
  );
  for (const result of body.results) {
    assert.equal(result.previewUrl, `/api/brow/preview?taskId=${result.id}`);
  }
  assert.ok(!JSON.stringify(body).includes('provider.invalid'));
  assert.ok(!JSON.stringify(body).includes('uploads.invalid'));
  assert.ok(!JSON.stringify(body).includes('private-results'));
});

for (const location of ['query', 'body'] as const) {
  test(`DELETE by taskId in the ${location} rejects another user's result with 404`, async (t) => {
    const foreign = task('another-result', { userId: 'another-user' });
    const remove = t.mock.fn(async () => 1);
    const lookup = t.mock.fn(async (id: string) => {
      assert.equal(id, foreign.id);
      return foreign;
    });
    const handlers = createBrowResultsHandlers(
      dependencies({ task: lookup, remove })
    );
    const response = await handlers.delete(
      new Request(
        `https://app.invalid/api/brow/results${location === 'query' ? `?taskId=${foreign.id}` : ''}`,
        {
          method: 'DELETE',
          ...(location === 'body'
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: foreign.id }),
              }
            : {}),
        }
      )
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'result_not_found' });
    assert.equal(lookup.mock.callCount(), 1);
    assert.equal(remove.mock.callCount(), 0);
  });
}

test('DELETE removes an owned result once and is idempotent for deleted results', async () => {
  const saved = task('owned/result');
  const removed: string[][] = [];
  const handlers = createBrowResultsHandlers(
    dependencies({
      task: async (id) => (id === saved.id ? saved : undefined),
      remove: async (id, userId) => {
        removed.push([id, userId]);
        saved.deletedAt = new Date(now);
        return 1;
      },
    })
  );
  const request = () =>
    new Request(
      `https://app.invalid/api/brow/results?taskId=${encodeURIComponent(saved.id)}`,
      { method: 'DELETE' }
    );

  const first = await handlers.delete(request());
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true, deleted: 1 });
  const repeated = await handlers.delete(request());
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), { ok: true, deleted: 0 });
  assert.deepEqual(removed, [[saved.id, 'owner']]);
});
