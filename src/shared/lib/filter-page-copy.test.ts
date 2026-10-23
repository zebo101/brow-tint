import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import messages from '@/config/locale/messages/en/ai/image.json';

const { metadata, page, product } = messages;
const { faq, guide } = page.sections;

test('filter metadata keeps the title and description within search limits', () => {
  assert.match(metadata.title, /^Eyebrow Filter\b/);
  assert.ok(metadata.title.length <= 60); // Includes the existing | Browlens suffix.
  assert.ok(metadata.description.length <= 160);
  assert.match(metadata.description, /eyebrow shape generator/);
  assert.match(metadata.description, /virtual eyebrow try on/);
  assert.match(
    metadata.description,
    /Outline previews are free; AI photos require sign-in and credits\./
  );
  assert.equal(product.description, metadata.description);
});

test('filter FAQ supports browser try-on intent without promising free AI photos', () => {
  assert.equal(faq.items.length, 10);
  const item = faq.items.find(
    ({ question }) =>
      question ===
      'Is there an eyebrow shape generator or app I can use to try on eyebrows?'
  );
  assert.ok(item);
  assert.match(item.answer, /browser.*eyebrow shape generator for photos/);
  assert.match(item.answer, /no download needed/);
  assert.match(
    item.answer,
    /The outline preview for virtual eyebrow try on is free to try\./
  );
  const creditNotice =
    'Generating a new AI photo uses credits and requires sign-in.';
  assert.ok(item.answer.includes(creditNotice));
  assert.match(item.answer, /eyebrow shape app/);
  assert.match(item.answer, /full brow app on the homepage/);
  assert.ok(
    guide.items.some(({ paragraphs }) =>
      paragraphs.some((paragraph) => paragraph.includes(creditNotice))
    )
  );
  assert.equal(
    faq.items.find(
      ({ question }) =>
        question === 'Can I analyze my brows for free without signing up?'
    )?.answer,
    'Yes. You can upload a photo and use the brow mapping and shape analysis tools without an account. Generating a new try-on image requires sign-in and credits; the tool shows the credit cost before you generate.'
  );
});

test('filter renders matching FAQ JSON-LD and guide links through existing slots', (t) => {
  const require = createRequire(import.meta.url);
  const modules = [
    '@/core/i18n/navigation',
    '@/themes/default/blocks/faq',
    '@/themes/default/blocks/brow-guide',
  ];
  const saved = modules.map((specifier) => {
    const path = require.resolve(specifier);
    return [path, require.cache[path]] as const;
  });
  t.after(() => {
    for (const [path, original] of saved) {
      if (original) require.cache[path] = original;
      else delete require.cache[path];
    }
  });
  for (const [path] of saved) delete require.cache[path];
  const navigationPath = saved[0][0];
  require.cache[navigationPath] = {
    id: navigationPath,
    filename: navigationPath,
    loaded: true,
    exports: {
      Link: (props: React.ComponentProps<'a'>) =>
        React.createElement('a', props),
    },
  } as NodeJS.Module;

  const { Faq } =
    require('@/themes/default/blocks/faq') as typeof import('@/themes/default/blocks/faq');
  const { BrowGuide } =
    require('@/themes/default/blocks/brow-guide') as typeof import('@/themes/default/blocks/brow-guide');
  const faqMarkup = renderToStaticMarkup(
    React.createElement(Faq, { section: faq })
  );
  const json = faqMarkup.match(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/
  )?.[1];
  assert.ok(json);
  const schema = JSON.parse(json);
  assert.equal(schema['@type'], 'FAQPage');
  assert.deepEqual(
    schema.mainEntity,
    faq.items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    }))
  );
  const visibleFaq = faqMarkup.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/g,
    ''
  );
  for (const { question, answer } of faq.items) {
    const escapedAnswer = renderToStaticMarkup(
      React.createElement('p', null, answer)
    ).slice(3, -4);
    assert.ok(visibleFaq.includes(escapedAnswer), question);
  }
  const guideMarkup = renderToStaticMarkup(
    React.createElement(BrowGuide, { section: guide })
  );
  assert.ok(guideMarkup.includes('href="/eyebrow-shape-for-face-shape"'));
  for (const url of [
    '/#brow-app',
    '/blog/eyebrow-shapes-for-men',
    '/blog/eyebrow-shapes-for-women',
  ]) {
    assert.ok(visibleFaq.includes(`href="${url}"`), url);
  }
});
