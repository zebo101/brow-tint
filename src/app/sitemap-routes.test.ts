import assert from 'node:assert/strict';
import test from 'node:test';

import { expandStaticRoutes } from './sitemap-routes';

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
