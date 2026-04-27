import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  getSiteUrl,
  isIndexablePath,
} from './seo-paths';

const defaultOptions = {
  siteUrl: 'https://tintbrow.com/',
  defaultLocale: 'en',
  locales: ['en', 'zh', 'ja'],
};

test('getSiteUrl strips trailing slashes', () => {
  assert.equal(
    getSiteUrl({
      siteUrl: 'https://tintbrow.com///',
    }),
    'https://tintbrow.com'
  );
});

test('buildCanonicalUrl keeps default locale unprefixed', () => {
  assert.equal(
    buildCanonicalUrl('/pricing', 'en', defaultOptions),
    'https://tintbrow.com/pricing'
  );
});

test('buildCanonicalUrl prefixes non-default locales once', () => {
  assert.equal(
    buildCanonicalUrl('/ai-brow-tint-generator', 'zh', defaultOptions),
    'https://tintbrow.com/zh/ai-brow-tint-generator'
  );

  assert.equal(
    buildCanonicalUrl('/zh/ai-brow-tint-generator', 'zh', defaultOptions),
    'https://tintbrow.com/zh/ai-brow-tint-generator'
  );
});

test('buildCanonicalUrl removes query strings and duplicate slashes', () => {
  assert.equal(
    buildCanonicalUrl('//blog//what-is-xxx/?utm_source=google#top', 'en', defaultOptions),
    'https://tintbrow.com/blog/what-is-xxx'
  );
});

test('buildLanguageAlternates returns one canonical per locale', () => {
  assert.deepEqual(
    buildLanguageAlternates('/docs', defaultOptions),
    {
      en: 'https://tintbrow.com/docs',
      zh: 'https://tintbrow.com/zh/docs',
      ja: 'https://tintbrow.com/ja/docs',
    }
  );
});

test('isIndexablePath excludes private and low-value paths across locales', () => {
  assert.equal(isIndexablePath('/pricing', defaultOptions), true);
  assert.equal(isIndexablePath('/zh/ai-brow-tint-generator', defaultOptions), true);
  assert.equal(isIndexablePath('/api/chat', defaultOptions), false);
  assert.equal(isIndexablePath('/ja/settings/profile', defaultOptions), false);
  assert.equal(isIndexablePath('/zh/activity/ai-tasks', defaultOptions), false);
  assert.equal(isIndexablePath('/chat/123', defaultOptions), false);
  assert.equal(isIndexablePath('/privacy-policy', defaultOptions), false);
  assert.equal(isIndexablePath('/terms-of-service', defaultOptions), false);
});
