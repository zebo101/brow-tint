import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  getSiteUrl,
  isIndexablePath,
} from './seo-paths';

const defaultOptions = {
  siteUrl: 'https://browlens.com/',
  defaultLocale: 'en',
  locales: ['en', 'zh', 'ja'],
};

test('getSiteUrl strips trailing slashes', () => {
  assert.equal(
    getSiteUrl({
      siteUrl: 'https://browlens.com///',
    }),
    'https://browlens.com'
  );
});

test('buildCanonicalUrl keeps default locale unprefixed', () => {
  assert.equal(
    buildCanonicalUrl('/pricing', 'en', defaultOptions),
    'https://browlens.com/pricing'
  );
});

test('buildCanonicalUrl prefixes non-default locales once', () => {
  assert.equal(
    buildCanonicalUrl('/ai-brow-tint-generator', 'zh', defaultOptions),
    'https://browlens.com/zh/ai-brow-tint-generator'
  );

  assert.equal(
    buildCanonicalUrl('/zh/ai-brow-tint-generator', 'zh', defaultOptions),
    'https://browlens.com/zh/ai-brow-tint-generator'
  );
});

test('buildCanonicalUrl removes query strings and duplicate slashes', () => {
  assert.equal(
    buildCanonicalUrl(
      '//blog//what-is-xxx/?utm_source=google#top',
      'en',
      defaultOptions
    ),
    'https://browlens.com/blog/what-is-xxx'
  );
});

test('buildLanguageAlternates returns one canonical per locale', () => {
  assert.deepEqual(buildLanguageAlternates('/docs', defaultOptions), {
    en: 'https://browlens.com/docs',
    zh: 'https://browlens.com/zh/docs',
    ja: 'https://browlens.com/ja/docs',
    'x-default': 'https://browlens.com/docs',
  });
});

test('isIndexablePath excludes private and low-value paths across locales', () => {
  assert.equal(isIndexablePath('/pricing', defaultOptions), true);
  assert.equal(isIndexablePath('/zh/filter', defaultOptions), true);
  assert.equal(
    isIndexablePath('/zh/ai-brow-tint-generator', defaultOptions),
    false
  );
  assert.equal(
    isIndexablePath('/blog/best-brow-tint-2026', defaultOptions),
    true
  );
  assert.equal(isIndexablePath('/api/chat', defaultOptions), false);
  assert.equal(isIndexablePath('/ja/settings/profile', defaultOptions), false);
  assert.equal(isIndexablePath('/zh/activity/ai-tasks', defaultOptions), false);
  assert.equal(isIndexablePath('/chat/123', defaultOptions), false);
  assert.equal(isIndexablePath('/privacy-policy', defaultOptions), false);
  assert.equal(isIndexablePath('/terms-of-service', defaultOptions), false);
});
