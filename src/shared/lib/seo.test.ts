import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { locales } from '@/config/locale';

// Only next-intl's request context is mocked; exercise getMetadata and the real
// canonical/hreflang builders without a Next server or a full TypeScript build.
test('getMetadata forwards page availability without changing other pages', async (t) => {
  const require = createRequire(import.meta.url);
  const intlPath = require.resolve('next-intl/server');
  const seoPath = require.resolve('./seo');
  const originalIntl = require.cache[intlPath];
  const originalSeo = require.cache[seoPath];
  const requestedLocales: string[] = [];

  t.after(() => {
    for (const [path, original] of [
      [intlPath, originalIntl],
      [seoPath, originalSeo],
    ] as const) {
      if (original) require.cache[path] = original;
      else delete require.cache[path];
    }
  });

  require.cache[intlPath] = {
    id: intlPath,
    filename: intlPath,
    loaded: true,
    exports: {
      setRequestLocale: (locale: string) => requestedLocales.push(locale),
      getTranslations: async () =>
        Object.assign((key: string) => `Translated ${key}`, {
          has: () => true,
        }),
    },
  } as NodeJS.Module;
  delete require.cache[seoPath];
  const { getMetadata } = require('./seo') as typeof import('./seo');
  const params = Promise.resolve({ locale: 'en' });
  const canonicalUrl = '/eyebrow-shape-for-face-shape';
  const metadata = await getMetadata({
    canonicalUrl,
    metadataKey: 'pages.face-shape.metadata',
    availableLocales: ['en'],
  })({ params });

  assert.ok(metadata.alternates.canonical.endsWith(canonicalUrl));
  assert.deepEqual(metadata.alternates.languages, {
    en: metadata.alternates.canonical,
    'x-default': metadata.alternates.canonical,
  });
  assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
  assert.equal(metadata.openGraph.locale, 'en');
  assert.equal(metadata.robots.index, true);
  assert.equal(metadata.title, 'Translated title');
  assert.ok(requestedLocales.every((locale) => locale === 'en'));

  const multilingual = await getMetadata({ canonicalUrl: '/filter' })({
    params,
  });
  assert.deepEqual(
    Object.keys(multilingual.alternates.languages ?? {}).sort(),
    [...locales, 'x-default'].sort()
  );
  const noIndex = await getMetadata({
    canonicalUrl,
    availableLocales: ['en'],
    noIndex: true,
  })({ params });
  assert.equal(noIndex.alternates.languages, undefined);
  assert.equal(noIndex.robots.index, false);
});
