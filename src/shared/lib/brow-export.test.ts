import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BROW_PROVIDER_RETENTION_MS,
  browStoredCopy,
  hasBrowStoredCopy,
  isBrowResultExpired,
  withBrowStoredCopy,
  type BrowExportTask,
  type BrowStoredCopy,
} from './brow-export';

const copy: BrowStoredCopy = {
  provider: 'r2',
  bucket: 'private-results',
  key: 'brow-results/owner/result.png',
  storedAt: '2026-01-01T00:00:00.000Z',
};

function task(overrides: Partial<BrowExportTask> = {}): BrowExportTask {
  return {
    id: 'result',
    userId: 'owner',
    status: 'success',
    mediaType: 'image',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    taskInfo: JSON.stringify({ browStorage: copy }),
    ...overrides,
  };
}

test('stored copies must point to the exact owner and task PNG', () => {
  assert.deepEqual(browStoredCopy(task()), copy);
  assert.equal(hasBrowStoredCopy(task()), true);

  for (const key of [
    'other-results/owner/result.png',
    'brow-results/another-user/result.png',
    'brow-results/owner/another-task.png',
    'brow-results/owner/result.jpg',
    'brow-results/owner/result.png/extra',
    'brow-results/owner/result.png?download=1',
    'brow-results/owner/../owner/result.png',
    '/brow-results/owner/result.png',
    'https://storage.invalid/brow-results/owner/result.png',
  ]) {
    const result = task({
      taskInfo: JSON.stringify({ browStorage: { ...copy, key } }),
    });
    assert.equal(browStoredCopy(result), null, key);
    assert.equal(hasBrowStoredCopy(result), false, key);
  }

  for (const result of [
    task({ userId: 'another-user' }),
    task({ id: 'another-task' }),
  ]) {
    assert.equal(browStoredCopy(result), null);
    assert.equal(hasBrowStoredCopy(result), false);
  }
});

test('malformed or incomplete storage metadata is not a stored copy', () => {
  const invalidCopies = [
    null,
    [],
    { ...copy, provider: 's3' },
    { ...copy, bucket: ' ' },
    { ...copy, key: null },
    { ...copy, storedAt: 'not-a-date' },
    { ...copy, storedAt: null },
  ];
  for (const taskInfo of [
    null,
    undefined,
    'invalid json',
    'null',
    '[]',
    '{}',
    ...invalidCopies.map((browStorage) => JSON.stringify({ browStorage })),
  ]) {
    const result = task({ taskInfo });
    assert.equal(browStoredCopy(result), null);
    assert.equal(hasBrowStoredCopy(result), false);
  }
});

test('provider results expire only after the 14-day boundary', () => {
  const created = Date.parse('2026-01-01T00:00:00.000Z');
  const boundary = created + 14 * 24 * 60 * 60 * 1000;
  assert.equal(BROW_PROVIDER_RETENTION_MS, boundary - created);

  for (const createdAt of [
    new Date(created),
    new Date(created).toISOString(),
  ]) {
    const result = task({ createdAt, taskInfo: null });
    assert.equal(isBrowResultExpired(result, boundary - 1), false);
    assert.equal(isBrowResultExpired(result, boundary), false);
    assert.equal(isBrowResultExpired(result, boundary + 1), true);
  }
});

test('a valid stored copy never expires, but an invalid pointer does not rescue a result', () => {
  const now = Date.parse('2027-01-01T00:00:00.000Z');
  assert.equal(isBrowResultExpired(task(), now), false);
  assert.equal(
    isBrowResultExpired(
      task({
        taskInfo: JSON.stringify({
          browStorage: { ...copy, key: 'wrong.png' },
        }),
      }),
      now
    ),
    true
  );
});

test('missing or invalid creation dates are not treated as expired', () => {
  for (const createdAt of [undefined, 'not-a-date']) {
    assert.equal(
      isBrowResultExpired(
        task({ taskInfo: null, createdAt }),
        Date.parse('2027-01-01T00:00:00.000Z')
      ),
      false
    );
  }
});

test('withBrowStoredCopy preserves existing taskInfo fields without mutating the task', () => {
  const info = {
    images: [{ imageUrl: 'https://provider.invalid/result.png', width: 1024 }],
    progress: 100,
    providerMetadata: { requestId: 'provider-request', attempts: [1, 2] },
    errorMessage: null,
    browStorage: { provider: 'old-provider', key: 'old-key' },
  };
  const original = JSON.stringify(info);
  const result = task({ taskInfo: original });

  assert.deepEqual(JSON.parse(withBrowStoredCopy(result, copy)), {
    ...info,
    browStorage: copy,
  });
  assert.equal(result.taskInfo, original);
  assert.deepEqual(
    browStoredCopy({ ...result, taskInfo: withBrowStoredCopy(result, copy) }),
    copy
  );
});

test('withBrowStoredCopy handles absent and malformed taskInfo', () => {
  for (const taskInfo of [null, undefined, 'invalid json', 'null', '[]']) {
    assert.deepEqual(JSON.parse(withBrowStoredCopy(task({ taskInfo }), copy)), {
      browStorage: copy,
    });
  }
});
