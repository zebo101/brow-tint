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
      siteUrl: 'https://tintbrow.com/',
    }
  );

  assert.deepEqual(
    entries.map((entry) => entry.url),
    [
      'https://tintbrow.com/pricing',
      'https://tintbrow.com/zh/pricing',
      'https://tintbrow.com/ja/pricing',
      'https://tintbrow.com/docs',
      'https://tintbrow.com/zh/docs',
    ]
  );
});
