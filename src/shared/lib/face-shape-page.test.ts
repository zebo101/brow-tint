import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import test, { type TestContext } from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { localeMessagesPaths, locales } from '@/config/locale';
import messages from '@/config/locale/messages/en/pages/face-shape.json';
import type { DynamicPage } from '@/shared/types/blocks/landing';

const require = createRequire(import.meta.url);
const pathname = '/eyebrow-shape-for-face-shape';
const url = `https://browlens.com${pathname}`;
const pageModule = '@/app/[locale]/(landing)/eyebrow-shape-for-face-shape/page';

function setup(t: TestContext) {
  let styleLoads = 0;
  let translations = 0;
  const Studio = () => null;
  const Hero = () => null;
  const Page = () => null;
  const saved = new Map<string, NodeJS.Module | undefined>();
  const replacements: Record<string, unknown> = {
    'next-intl/server': {
      setRequestLocale: () => {},
      getTranslations: async (namespace: string) => {
        translations++;
        const root = namespace.endsWith('.metadata')
          ? messages.metadata
          : messages;
        const get = (key: string) =>
          key
            .split('.')
            .reduce<unknown>(
              (value, part) => (value as Record<string, unknown>)?.[part],
              root
            );
        return Object.assign(get, {
          has: (key: string) => get(key) !== undefined,
          raw: (key: string) => structuredClone(get(key)),
        });
      },
    },
    '@/core/theme': { getThemePage: async () => Page },
    '@/core/i18n/navigation': {
      Link: (props: React.ComponentProps<'a'>) =>
        React.createElement('a', props),
    },
    '@/themes/default/blocks/hero': { Hero },
    '@/themes/default/blocks/brow-tint/studio': { BrowTintStudio: Studio },
    '@/themes/default/blocks/brow-tint/styles-loader': {
      getActiveBrowStyles: async () => {
        styleLoads++;
        return [];
      },
    },
  };
  for (const specifier of [...Object.keys(replacements), './seo', pageModule]) {
    const resolved = require.resolve(specifier);
    saved.set(resolved, require.cache[resolved]);
    if (specifier in replacements) {
      require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: replacements[specifier],
      } as NodeJS.Module;
    } else {
      delete require.cache[resolved];
    }
  }
  t.after(() => {
    for (const [resolved, cached] of saved) {
      if (cached) require.cache[resolved] = cached;
      else delete require.cache[resolved];
    }
  });
  const route =
    require('@/app/[locale]/(landing)/eyebrow-shape-for-face-shape/page') as typeof import('@/app/[locale]/(landing)/eyebrow-shape-for-face-shape/page');
  return {
    route,
    Studio,
    Hero,
    Page,
    styleLoads: () => styleLoads,
    translations: () => translations,
  };
}

test('getMetadata forwards English-only availability without changing its multilingual default', async (t) => {
  const { route } = setup(t);
  const props = { params: Promise.resolve({ locale: 'en' }) };
  const metadata = await route.generateMetadata(props);
  assert.deepEqual(metadata.alternates, {
    canonical: url,
    languages: { en: url, 'x-default': url },
  });
  assert.equal(metadata.title, messages.metadata.title);
  assert.equal(metadata.description, messages.metadata.description);
  assert.equal(metadata.openGraph?.url, url);
  assert.ok(metadata.robots && typeof metadata.robots === 'object');
  assert.equal(metadata.robots.index, true);
  const { getMetadata } = require('./seo') as typeof import('./seo');
  const existing = await getMetadata({ canonicalUrl: '/filter' })(props);
  assert.deepEqual(
    Object.keys(existing.alternates.languages!).sort(),
    [...locales, 'x-default'].sort()
  );
});

test('all non-English page and metadata requests permanently redirect before loading styles or copy', async (t) => {
  const fixture = setup(t);
  for (const locale of locales.filter((locale) => locale !== 'en')) {
    const props = { params: Promise.resolve({ locale }) };
    for (const handler of [
      fixture.route.default,
      fixture.route.generateMetadata,
    ]) {
      await assert.rejects(handler(props), {
        digest: `NEXT_REDIRECT;replace;${pathname};308;`,
      });
    }
  }
  assert.equal(fixture.styleLoads(), 0);
  assert.equal(fixture.translations(), 0);
});

test('English page embeds the filter studio with an H2 and keeps the existing dynamic guide blocks', async (t) => {
  const fixture = setup(t);
  const result = await fixture.route.default({
    params: Promise.resolve({ locale: 'en' }),
  });
  const children = React.Children.toArray(result.props.children).filter(
    React.isValidElement
  );
  assert.equal(fixture.styleLoads(), 1);
  assert.ok(children.some((element) => element.type === fixture.Hero));
  const wrapper = children.find(
    (element) => element.type === 'div'
  ) as React.ReactElement<{
    id: string;
    children: React.ReactElement<{
      mode: string;
      titleAs: string;
      title: string;
      subtitle: string;
    }>;
  }>;
  assert.equal(wrapper.props.id, 'try-on');
  assert.equal(wrapper.props.children.type, fixture.Studio);
  assert.deepEqual(wrapper.props.children.props, {
    styles: [],
    mode: 'filter',
    titleAs: 'h2',
    title: messages.page.sections.studio.title,
    subtitle: messages.page.sections.studio.description,
  });
  const dynamic = children.find(
    (element) => element.type === fixture.Page
  ) as React.ReactElement<{ page: DynamicPage }>;
  assert.deepEqual(
    dynamic.props.page.show_sections,
    messages.page.show_sections.slice(2)
  );
  assert.equal(dynamic.props.page.title, undefined); // no hidden second H1
  assert.equal(dynamic.props.page.sections?.hero, undefined);
  assert.equal(dynamic.props.page.sections?.faq.block, 'faq');
  assert.equal(dynamic.props.page.sections?.cta.block, 'cta');
});

test('the reused guide and FAQ server-render a real table, every answer, and only FAQPage schema', (t) => {
  setup(t);
  const { BrowGuide } =
    require('@/themes/default/blocks/brow-guide') as typeof import('@/themes/default/blocks/brow-guide');
  const { Faq } =
    require('@/themes/default/blocks/faq') as typeof import('@/themes/default/blocks/faq');
  const table = renderToStaticMarkup(
    React.createElement(BrowGuide, {
      section: messages.page.sections.comparison,
    })
  );
  assert.equal([...table.matchAll(/<table\b/g)].length, 1);
  assert.equal([...table.matchAll(/scope="col"/g)].length, 5);
  assert.equal([...table.matchAll(/scope="row"/g)].length, 6);
  const faq = renderToStaticMarkup(
    React.createElement(Faq, { section: messages.page.sections.faq })
  );
  const json = faq.match(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/
  )?.[1];
  assert.ok(json);
  const schema = JSON.parse(json);
  assert.equal(schema['@type'], 'FAQPage');
  assert.equal(schema.mainEntity.length, 8);
  for (const item of messages.page.sections.faq.items) {
    assert.ok(
      schema.mainEntity.some(
        (question: { name: string; acceptedAnswer: { text: string } }) =>
          question.name === item.question &&
          question.acceptedAnswer.text === item.answer
      )
    );
    const escapedAnswer = renderToStaticMarkup(
      React.createElement('p', null, item.answer)
    ).slice(3, -4);
    assert.ok(faq.includes(escapedAnswer), item.question);
  }
  assert.match(faq, /href="\/privacy-policy"/);
  assert.doesNotMatch(
    table + faq,
    /<h1\b|"@type":"(?:Product|Offer)"|aggregateRating/
  );
});

test('face-shape guide blocks render links to all three new posts', (t) => {
  setup(t);
  const { BrowGuide } =
    require('@/themes/default/blocks/brow-guide') as typeof import('@/themes/default/blocks/brow-guide');
  const markup = [
    messages.page.sections.shape_guides,
    messages.page.sections.guidelines,
  ]
    .map((section) =>
      renderToStaticMarkup(React.createElement(BrowGuide, { section }))
    )
    .join('');
  for (const slug of [
    'eyebrow-shapes-for-men',
    'eyebrow-shapes-for-women',
    'eyebrow-shapes-for-diamond-faces',
  ]) {
    assert.ok(markup.includes(`href="/blog/${slug}"`), slug);
  }
});

function blogUrls(value: unknown): string[] {
  if (typeof value === 'string') {
    return [...value.matchAll(/\/blog\/[^\s"'<>?#)]+/g)].map(([url]) => url);
  }
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(blogUrls);
}

test('every blog URL in the face-shape messages points to an existing English post', () => {
  const urls = new Set(blogUrls(messages));
  assert.ok(urls.size > 0);
  for (const url of urls) {
    const slug = url.slice('/blog/'.length);
    const file = new URL(`../../../content/posts/${slug}.mdx`, import.meta.url);
    assert.ok(
      existsSync(file),
      `${url} must resolve to content/posts/${slug}.mdx`
    );
  }
});

function visibleStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(visibleStrings);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value)
    .filter(
      ([key]) =>
        !['block', 'id', 'url', 'variant', 'show_sections'].includes(key)
    )
    .flatMap(([, child]) => visibleStrings(child));
}

function wordCount(value: unknown) {
  return visibleStrings(value)
    .join(' ')
    .replace(/<[^>]*>/g, ' ')
    .trim()
    .split(/\s+/).length;
}

test('English copy meets the length, heading, outline, and intentional internal-link contract', () => {
  assert.ok(localeMessagesPaths.includes('pages/face-shape'));
  assert.ok(
    messages.metadata.title.length >= 55 && messages.metadata.title.length <= 60
  );
  assert.ok(
    messages.metadata.description.length >= 145 &&
      messages.metadata.description.length <= 160
  );
  assert.match(messages.metadata.title, /Eyebrow Shape for Face Shape/);
  const words = wordCount(messages.page);
  assert.ok(words >= 1400 && words <= 2000, `${words} authored visible words`);
  const quickWords = wordCount(messages.page.sections.quick_answer.description);
  assert.ok(quickWords >= 40 && quickWords <= 60);
  const shapes = ['round', 'oval', 'square', 'heart', 'long', 'diamond'];
  for (const [
    index,
    item,
  ] of messages.page.sections.shape_guides.items.entries()) {
    const words = wordCount(item.paragraphs);
    assert.ok(words >= 80 && words <= 150, `${shapes[index]}: ${words} words`);
    assert.equal(
      item.paragraphs
        .join(' ')
        .split(`best eyebrow shape for a ${shapes[index]} face`).length - 1,
      1
    );
  }
  const urls = new Set(blogUrls(messages.page));
  for (const slug of [
    'eyebrow-shapes-guide',
    'eyebrow-mapping-guide',
    'how-to-shape-eyebrows',
    'eyebrow-shapes-for-round-faces',
    'eyebrow-shapes-for-square-faces',
    'eyebrow-shapes-for-heart-shaped-faces',
    'eyebrow-shapes-for-oval-faces',
    'eyebrow-shapes-for-long-faces',
    'eyebrow-shapes-for-diamond-faces',
    'eyebrow-shapes-for-men',
    'eyebrow-shapes-for-women',
  ]) {
    assert.ok(urls.has(`/blog/${slug}`), slug);
  }
  assert.equal(
    messages.page.sections.shape_guides.items[5].link.url,
    '/blog/eyebrow-shapes-for-diamond-faces'
  );
  assert.equal(messages.page.sections.hero.buttons[0].url, '#try-on');
});
