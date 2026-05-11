import assert from 'node:assert/strict';
import test from 'node:test';

import { CreemModerationProvider } from './creem';
import { ModerationError } from './index';

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  return ((url: string, init: RequestInit) =>
    Promise.resolve(handler(url, init))) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('CreemModerationProvider returns allow decision and uses sandbox base URL', async () => {
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: any = null;
  const provider = new CreemModerationProvider({
    apiKey: 'creem_test_abc',
    environment: 'sandbox',
    fetchImpl: mockFetch((url, init) => {
      capturedUrl = url;
      capturedHeaders = init.headers as Record<string, string>;
      capturedBody = JSON.parse(init.body as string);
      return jsonResponse({
        id: 'mod_1',
        decision: 'allow',
        external_id: 'user_1:gen_x',
        usage: { units: 1 },
      });
    }),
  });

  const result = await provider.moderatePrompt({
    prompt: 'apply a soft brunette brow tint',
    externalId: 'user_1:gen_x',
  });

  assert.equal(capturedUrl, 'https://test-api.creem.io/v1/moderation/prompt');
  assert.equal(capturedHeaders['x-api-key'], 'creem_test_abc');
  assert.equal(capturedBody.prompt, 'apply a soft brunette brow tint');
  assert.equal(capturedBody.external_id, 'user_1:gen_x');
  assert.equal(result.decision, 'allow');
  assert.equal(result.id, 'mod_1');
  assert.equal(result.units, 1);
});

test('CreemModerationProvider uses production base URL when configured', async () => {
  let capturedUrl = '';
  const provider = new CreemModerationProvider({
    apiKey: 'creem_live',
    environment: 'production',
    fetchImpl: mockFetch((url) => {
      capturedUrl = url;
      return jsonResponse({ decision: 'allow' });
    }),
  });
  await provider.moderatePrompt({ prompt: 'x', externalId: 'eid' });
  assert.equal(capturedUrl, 'https://api.creem.io/v1/moderation/prompt');
});

test('CreemModerationProvider surfaces flag and deny decisions verbatim', async () => {
  for (const decision of ['flag', 'deny'] as const) {
    const provider = new CreemModerationProvider({
      apiKey: 'k',
      fetchImpl: mockFetch(() => jsonResponse({ decision })),
    });
    const result = await provider.moderatePrompt({ prompt: 'x', externalId: 'e' });
    assert.equal(result.decision, decision);
  }
});

test('CreemModerationProvider throws ModerationError on 5xx', async () => {
  const provider = new CreemModerationProvider({
    apiKey: 'k',
    fetchImpl: mockFetch(() => new Response('boom', { status: 503 })),
  });
  await assert.rejects(
    provider.moderatePrompt({ prompt: 'x', externalId: 'e' }),
    (err: unknown) =>
      err instanceof ModerationError && /status 503/.test((err as Error).message)
  );
});

test('CreemModerationProvider throws ModerationError on network failure', async () => {
  const provider = new CreemModerationProvider({
    apiKey: 'k',
    fetchImpl: (() =>
      Promise.reject(new Error('ECONNRESET'))) as unknown as typeof fetch,
  });
  await assert.rejects(
    provider.moderatePrompt({ prompt: 'x', externalId: 'e' }),
    (err: unknown) =>
      err instanceof ModerationError && /ECONNRESET/.test((err as Error).message)
  );
});

test('CreemModerationProvider throws ModerationError on abort/timeout', async () => {
  const provider = new CreemModerationProvider({
    apiKey: 'k',
    timeoutMs: 10,
    fetchImpl: ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = init.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          (err as any).name = 'AbortError';
          reject(err);
        });
      })) as unknown as typeof fetch,
  });
  await assert.rejects(
    provider.moderatePrompt({ prompt: 'x', externalId: 'e' }),
    (err: unknown) =>
      err instanceof ModerationError && /timed out/.test((err as Error).message)
  );
});

test('CreemModerationProvider throws on malformed response (missing decision)', async () => {
  const provider = new CreemModerationProvider({
    apiKey: 'k',
    fetchImpl: mockFetch(() => jsonResponse({ id: 'x' })),
  });
  await assert.rejects(
    provider.moderatePrompt({ prompt: 'x', externalId: 'e' }),
    (err: unknown) =>
      err instanceof ModerationError &&
      /missing or invalid decision/.test((err as Error).message)
  );
});

test('CreemModerationProvider throws when prompt or externalId is empty', async () => {
  const provider = new CreemModerationProvider({
    apiKey: 'k',
    fetchImpl: mockFetch(() => jsonResponse({ decision: 'allow' })),
  });
  await assert.rejects(
    provider.moderatePrompt({ prompt: '', externalId: 'e' }),
    ModerationError
  );
  await assert.rejects(
    provider.moderatePrompt({ prompt: 'x', externalId: '' }),
    ModerationError
  );
});

test('CreemModerationProvider constructor requires apiKey', () => {
  assert.throws(
    () => new CreemModerationProvider({ apiKey: '' }),
    ModerationError
  );
});
