import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBlogFaqSchema, buildBlogSeo } from './blog-seo';

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
  assert.equal(result.metadata.openGraph.modifiedTime, undefined);
  assert.equal(
    result.metadata.openGraph.images[0].alt,
    'Augenbrauen vermessen'
  );
  assert.equal(result.schema.author?.['@type'], 'Organization');
});

test('missing or invalid dates and authors are omitted, never invented', () => {
  const result = buildBlogSeo({
    slug: 'guide',
    locale: 'en',
    siteUrl: 'https://browlens.com',
    title: 'Guide',
    published: 'invalid',
    modified: 'invalid',
  });
  assert.equal(result.schema.datePublished, undefined);
  assert.equal(result.schema.dateModified, undefined);
  assert.equal(result.metadata.openGraph.modifiedTime, undefined);
  assert.equal(result.schema.author, undefined);
  assert.equal(
    result.metadata.openGraph.url,
    'https://browlens.com/blog/guide'
  );
});

test('updated dates and descriptive cover alt reach article schema and Open Graph', () => {
  for (const modified of ['2026-10-15', new Date('2026-10-15T00:00:00Z')]) {
    const result = buildBlogSeo({
      slug: 'guide',
      locale: 'en',
      siteUrl: 'https://browlens.com',
      title: 'Guide',
      image: '/imgs/cases/2.jpg',
      imageAlt: 'Brow mapping lines on a front-facing portrait',
      published: '2026-09-12',
      modified,
    });

    assert.equal(result.schema.datePublished, '2026-09-12T00:00:00.000Z');
    assert.equal(result.schema.dateModified, '2026-10-15T00:00:00.000Z');
    assert.equal(
      result.metadata.openGraph.modifiedTime,
      result.schema.dateModified
    );
    assert.deepEqual(result.metadata.openGraph.images, [
      {
        url: 'https://browlens.com/imgs/cases/2.jpg',
        alt: 'Brow mapping lines on a front-facing portrait',
      },
    ]);
  }
});

test('FAQ schema preserves question and answer text verbatim, including plain text markup', () => {
  const faq = [
    { question: 'Can I try it?', answer: 'Yes — compare the outline first.' },
    {
      question: '眉の形は？ & <b>tips</b>',
      answer: 'Keep **your** shape.\nNo <script>markup</script>.',
    },
  ];

  assert.deepEqual(buildBlogFaqSchema(faq), {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  });
});

test('absent and empty FAQs do not produce structured data', () => {
  assert.equal(buildBlogFaqSchema(), undefined);
  assert.equal(buildBlogFaqSchema([]), undefined);
});
