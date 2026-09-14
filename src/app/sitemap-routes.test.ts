import assert from 'node:assert/strict';
import test from 'node:test';

import { expandStaticRoutes } from './sitemap-routes';

test('sitemap uses recorded content dates and never invents a crawl-time date', () => {
  const entries = expandStaticRoutes(
    [
      {
        path: '/',
        changeFrequency: 'weekly',
        priority: 1,
        lastModified: '2026-09-14',
      },
      { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
    ],
    {
      locales: ['en', 'zh'],
      defaultLocale: 'en',
      siteUrl: 'https://browlens.com',
    }
  );
  assert.equal(entries[0].lastModified, '2026-09-14');
  assert.equal(entries[1].lastModified, '2026-09-14');
  assert.equal(entries[2].lastModified, undefined);
});

test('expandStaticRoutes only emits locales declared by each route', () => {
  const entries = expandStaticRoutes(
    [
      {
        path: '/pricing',
        changeFrequency: 'weekly',
        priority: 0.9,
      },
      {
        path: '/docs',
        changeFrequency: 'weekly',
        priority: 0.65,
        locales: ['en', 'zh'],
      },
    ],
    {
      defaultLocale: 'en',
      locales: ['en', 'zh', 'ja'],
      siteUrl: 'https://browlens.com/',
    }
  );

  assert.deepEqual(
    entries.map((entry) => entry.url),
    [
      'https://browlens.com/pricing',
      'https://browlens.com/zh/pricing',
      'https://browlens.com/ja/pricing',
      'https://browlens.com/docs',
      'https://browlens.com/zh/docs',
    ]
  );
});
