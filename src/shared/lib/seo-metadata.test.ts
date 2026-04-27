import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAlternates } from './seo-metadata';

const baseOptions = {
  defaultLocale: 'en',
  locales: ['en', 'zh', 'ja'],
  siteUrl: 'https://tintbrow.com/',
};

test('buildAlternates omits language alternates for noindex pages', () => {
  assert.deepEqual(
    buildAlternates('/sign-in', {
      ...baseOptions,
      locale: 'zh',
      availableLocales: ['en', 'zh'],
      noIndex: true,
    }),
    {
      canonical: 'https://tintbrow.com/zh/sign-in',
    }
  );
});

test('buildAlternates limits hreflang locales to actual page availability', () => {
  assert.deepEqual(
    buildAlternates('/docs', {
      ...baseOptions,
      locale: 'zh',
      availableLocales: ['en', 'zh'],
    }),
    {
      canonical: 'https://tintbrow.com/zh/docs',
      languages: {
        en: 'https://tintbrow.com/docs',
        zh: 'https://tintbrow.com/zh/docs',
      },
    }
  );
});
