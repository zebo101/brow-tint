import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { proxy } from './proxy';

test('default URL stays English despite browser language and a stale locale cookie', async () => {
  const response = await proxy(
    new NextRequest('https://browlens.com/', {
      headers: { 'accept-language': 'zh-CN,ja', cookie: 'NEXT_LOCALE=zh' },
    })
  );
  assert.equal(
    response.headers.get('x-middleware-rewrite'),
    'https://browlens.com/en'
  );
  assert.equal(
    response.headers.get('x-middleware-request-x-next-intl-locale'),
    'en'
  );
  assert.equal(response.headers.has('link'), false);
  assert.equal(response.headers.has('set-cookie'), false);
});

test('explicit default-language URLs normalize to unprefixed English', async () => {
  const response = await proxy(
    new NextRequest('https://browlens.com/en/pricing?source=test')
  );
  assert.ok([307, 308].includes(response.status));
  assert.equal(
    response.headers.get('location'),
    'https://browlens.com/pricing?source=test'
  );
});

test('private English pages retain the sign-in redirect and callback', async () => {
  for (const route of ['/admin', '/settings/profile', '/activity']) {
    const response = await proxy(
      new NextRequest(`https://browlens.com${route}?page=2`)
    );
    const redirect = new URL(response.headers.get('location')!);
    assert.equal(redirect.pathname, '/sign-in');
    assert.equal(redirect.searchParams.get('callbackUrl'), `${route}?page=2`);
    assert.equal(response.headers.has('cache-control'), false);
  }
});
