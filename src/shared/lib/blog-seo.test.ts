import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBlogSeo } from './blog-seo';

test('article shares and schema use the localized article, not the homepage', () => {
  const result = buildBlogSeo({
    slug: 'eyebrow-mapping-guide',
    locale: 'de',
    siteUrl: 'https://browlens.com',
    title: 'Augenbrauen vermessen',
    description: 'A practical guide',
    image: '/imgs/cases/2.jpg',
    author: 'Browlens Team',
    published: '2026-09-12',
    availableLocales: ['en', 'de'],
  });
  const url = 'https://browlens.com/de/blog/eyebrow-mapping-guide';
  assert.equal(result.metadata.openGraph.url, url);
  assert.equal(result.metadata.openGraph.type, 'article');
  assert.equal(
    result.metadata.twitter.title,
    'Augenbrauen vermessen | Browlens'
  );
  assert.equal(
    result.metadata.twitter.images[0],
    'https://browlens.com/imgs/cases/2.jpg'
  );
  assert.equal(result.schema.mainEntityOfPage, url);
  assert.equal(result.schema['@type'], 'BlogPosting');
  assert.equal(result.schema.datePublished, '2026-09-12T00:00:00.000Z');
  assert.equal(result.schema.dateModified, undefined);
  assert.equal(result.schema.author?.['@type'], 'Organization');
});

test('missing or invalid dates and authors are omitted, never invented', () => {
  const result = buildBlogSeo({
    slug: 'guide',
    locale: 'en',
    siteUrl: 'https://browlens.com',
    title: 'Guide',
    published: 'invalid',
  });
  assert.equal(result.schema.datePublished, undefined);
  assert.equal(result.schema.author, undefined);
  assert.equal(
    result.metadata.openGraph.url,
    'https://browlens.com/blog/guide'
  );
});
