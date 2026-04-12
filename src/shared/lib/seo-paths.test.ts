import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  getSiteUrl,
  isIndexablePath,
} from './seo-paths';

const defaultOptions = {
  siteUrl: 'https://aibarber.net/',
  defaultLocale: 'en',
  locales: ['en', 'zh', 'ja'],
};

test('getSiteUrl strips trailing slashes', () => {
  assert.equal(
    getSiteUrl({
      siteUrl: 'https://aibarber.net///',
    }),
    'https://aibarber.net'
  );
});

test('buildCanonicalUrl keeps default locale unprefixed', () => {
  assert.equal(
    buildCanonicalUrl('/pricing', 'en', defaultOptions),
    'https://aibarber.net/pricing'
  );
});

test('buildCanonicalUrl prefixes non-default locales once', () => {
  assert.equal(
    buildCanonicalUrl('/ai-hairstyle-changer', 'zh', defaultOptions),
    'https://aibarber.net/zh/ai-hairstyle-changer'
  );

  assert.equal(
    buildCanonicalUrl('/zh/ai-hairstyle-changer', 'zh', defaultOptions),
    'https://aibarber.net/zh/ai-hairstyle-changer'
  );
});

test('buildCanonicalUrl removes query strings and duplicate slashes', () => {
  assert.equal(
    buildCanonicalUrl('//blog//what-is-xxx/?utm_source=google#top', 'en', defaultOptions),
    'https://aibarber.net/blog/what-is-xxx'
  );
});

test('buildLanguageAlternates returns one canonical per locale', () => {
  assert.deepEqual(
    buildLanguageAlternates('/docs', defaultOptions),
    {
      en: 'https://aibarber.net/docs',
      zh: 'https://aibarber.net/zh/docs',
      ja: 'https://aibarber.net/ja/docs',
    }
  );
});

test('isIndexablePath excludes private and low-value paths across locales', () => {
  assert.equal(isIndexablePath('/pricing', defaultOptions), true);
  assert.equal(isIndexablePath('/zh/ai-hairstyle-changer', defaultOptions), true);
  assert.equal(isIndexablePath('/api/chat', defaultOptions), false);
  assert.equal(isIndexablePath('/ja/settings/profile', defaultOptions), false);
  assert.equal(isIndexablePath('/zh/activity/ai-tasks', defaultOptions), false);
  assert.equal(isIndexablePath('/chat/123', defaultOptions), false);
  assert.equal(isIndexablePath('/privacy-policy', defaultOptions), false);
  assert.equal(isIndexablePath('/terms-of-service', defaultOptions), false);
});
