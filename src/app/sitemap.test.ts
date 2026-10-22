import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { locales } from '@/config/locale';

test('the registered face-shape route emits exactly one English sitemap entry', async (t) => {
  const require = createRequire(import.meta.url);
  const sourcePath = require.resolve('@/core/docs/source');
  const sitemapPath = require.resolve('./sitemap');
  const savedSource = require.cache[sourcePath];
  const savedSitemap = require.cache[sitemapPath];
  t.after(() => {
    for (const [path, cached] of [
      [sourcePath, savedSource],
      [sitemapPath, savedSitemap],
    ] as const) {
      if (cached) require.cache[path] = cached;
      else delete require.cache[path];
    }
  });
  // Isolate generated MDX data, but exercise the real registered static routes
  // and sitemap builder rather than only a duplicated route fixture.
  const emptySource = { getPages: () => [] };
  require.cache[sourcePath] = {
    id: sourcePath,
    filename: sourcePath,
    loaded: true,
    exports: {
      i18n: { languages: locales },
      docsSource: emptySource,
      pagesSource: emptySource,
      postsSource: emptySource,
    },
  } as NodeModule;
  delete require.cache[sitemapPath];
  const { default: sitemap } =
    require('./sitemap') as typeof import('./sitemap');
  const pathname = '/eyebrow-shape-for-face-shape';
  const url = `https://browlens.com${pathname}`;
  const entries = (await sitemap()).filter((entry) =>
    entry.url.endsWith(pathname)
  );
  assert.deepEqual(entries, [
    {
      url,
      changeFrequency: 'weekly',
      priority: 0.9,
      lastModified: '2026-10-22',
      alternates: { languages: { en: url, 'x-default': url } },
    },
  ]);
});
