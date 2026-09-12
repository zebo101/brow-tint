import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBrowResultHistory } from './brow-result-history';

test('history uses a private fresh request and only authenticated preview URLs', async () => {
  const controller = new AbortController();
  const results = await loadBrowResultHistory(
    controller.signal,
    async (url, init) => {
      assert.equal(url, '/api/brow/results');
      assert.equal(init?.signal, controller.signal);
      assert.equal(init?.cache, 'no-store');
      return Response.json({
        results: [
          {
            id: 'task/a',
            styleName: 'Natural',
            previewUrl: 'https://provider.invalid/original.png',
          },
          { id: 'task/a', styleName: 'Duplicate' },
          null,
          { id: 'broken' },
          { id: 'task-b', styleName: 'Soft' },
        ],
      });
    }
  );
  assert.deepEqual(results, [
    {
      id: 'task/a',
      styleName: 'Natural',
      previewUrl: '/api/brow/preview?taskId=task%2Fa',
    },
    {
      id: 'task-b',
      styleName: 'Soft',
      previewUrl: '/api/brow/preview?taskId=task-b',
    },
  ]);
});

test('history distinguishes an empty gallery from auth, network and malformed responses', async () => {
  const signal = new AbortController().signal;
  assert.deepEqual(
    await loadBrowResultHistory(signal, async () =>
      Response.json({ results: [] })
    ),
    []
  );
  for (const response of [
    new Response(null, { status: 401 }),
    Response.json({ error: true }),
  ]) {
    await assert.rejects(
      loadBrowResultHistory(signal, async () => response),
      /history_unavailable/
    );
  }
});
