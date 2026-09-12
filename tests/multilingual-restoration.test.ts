import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { expandStaticRoutes } from '../src/app/sitemap-routes';
import { locales } from '../src/config/locale';
import { proxy } from '../src/proxy';
import { buildAlternates } from '../src/shared/lib/seo-metadata';

const options = {
  siteUrl: 'https://browlens.com',
  defaultLocale: 'en',
  locales: ['en', 'zh', 'ja'],
};
test('each restored locale remains on its own route', async () => {
  for (const locale of ['zh', 'ko', 'ja', 'de', 'es', 'it', 'pt']) {
    const response = await proxy(
      new NextRequest(`https://browlens.com/${locale}/filter`)
    );
    assert.equal(response.headers.get('location'), null);
    assert.equal(
      response.headers.get('x-middleware-rewrite'),
      `https://browlens.com/${locale}/filter`
    );
  }
});
test('legacy tools retain locale and query; old articles are not redirected', async () => {
  const response = await proxy(
    new NextRequest(
      'https://browlens.com/ja/ai-brow-tint-generator?source=test'
    )
  );
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    'https://browlens.com/ja/filter?source=test'
  );
  const article = await proxy(
    new NextRequest('https://browlens.com/zh/blog/best-brow-tint-2026')
  );
  assert.equal(article.headers.get('location'), null);
});
test('zh-CN alias preserves translated destination', async () => {
  const response = await proxy(
    new NextRequest('https://browlens.com/zh-CN/blog?source=test')
  );
  assert.equal(
    response.headers.get('location'),
    'https://browlens.com/zh/blog?source=test'
  );
});
test('private localized pages retain sign-in locale and callback', async () => {
  const response = await proxy(
    new NextRequest('https://browlens.com/zh/settings/profile?page=2')
  );
  const target = new URL(response.headers.get('location')!);
  assert.equal(target.pathname, '/zh/sign-in');
  assert.equal(
    target.searchParams.get('callbackUrl'),
    '/zh/settings/profile?page=2'
  );
  assert.equal(response.headers.has('cache-control'), false);
});
test('article alternates include only existing translations', () => {
  assert.deepEqual(
    buildAlternates('/blog/what-is-xxx', {
      ...options,
      locale: 'zh',
      availableLocales: ['en', 'zh'],
    }),
    {
      canonical: 'https://browlens.com/zh/blog/what-is-xxx',
      languages: {
        en: 'https://browlens.com/blog/what-is-xxx',
        zh: 'https://browlens.com/zh/blog/what-is-xxx',
        'x-default': 'https://browlens.com/blog/what-is-xxx',
      },
    }
  );
});
test('sitemap uses each route translation set', () => {
  const entries = expandStaticRoutes(
    [
      { path: '/filter', changeFrequency: 'weekly', priority: 0.9 },
      {
        path: '/docs',
        changeFrequency: 'weekly',
        priority: 0.6,
        locales: ['en', 'zh'],
      },
    ],
    options
  );
  assert.equal(entries.length, 5);
  assert.equal(entries[1].url, 'https://browlens.com/zh/filter');
  assert.deepEqual(Object.keys(entries[4].alternates!.languages!), [
    'en',
    'zh',
    'x-default',
  ]);
});

test('published guide collection contains only the three guides in all eight languages', () => {
  const guideSlugs = [
    'eyebrow-mapping-guide',
    'eyebrow-shapes-guide',
    'how-to-shape-eyebrows',
  ];
  const expected = guideSlugs.flatMap((slug) =>
    locales.map((locale) => `${slug}${locale === 'en' ? '' : `.${locale}`}.mdx`)
  );
  const actual = readdirSync(path.join(process.cwd(), 'content/posts')).filter(
    (file) => file.endsWith('.mdx')
  );
  assert.equal(locales.length, 8);
  assert.deepEqual(actual.sort(), expected.sort());
});

test('public MDX page families have real translations for every advertised language', () => {
  const families = [
    ['content/docs', 'index'],
    ['content/browlens-logs', 'browlens'],
    ['content/pages', 'privacy-policy'],
    ['content/pages', 'terms-of-service'],
    ['content/pages', 'cookie-policy'],
  ];
  for (const [directory, slug] of families) {
    for (const locale of locales) {
      const file = path.join(
        process.cwd(),
        directory,
        `${slug}${locale === 'en' ? '' : `.${locale}`}.mdx`
      );
      assert.ok(existsSync(file), `Missing advertised translation: ${file}`);
    }
  }
});

test('all eight variants include themselves, reciprocal equivalents and English x-default', () => {
  for (const locale of locales) {
    const page = '/blog/eyebrow-mapping-guide';
    const actual = buildAlternates(page, {
      siteUrl: 'https://browlens.com',
      locale,
      locales,
    });
    assert.equal(Object.keys(actual.languages!).length, 9);
    assert.equal(actual.languages![locale], actual.canonical);
    for (const target of locales) {
      assert.equal(
        actual.languages![target],
        `https://browlens.com${target === 'en' ? '' : `/${target}`}${page}`
      );
    }
    assert.equal(actual.languages!['x-default'], `https://browlens.com${page}`);
  }
});
