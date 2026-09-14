// Read-only check of rendered HTML: node scripts/verify-seo-content.mjs http://localhost:3120
import assert from 'node:assert/strict';

const origin = process.argv[2] || 'http://localhost:3120';
const locales = ['en', 'zh', 'ko', 'ja', 'de', 'es', 'it', 'pt'];
const slugs = [
  'eyebrow-mapping-guide',
  'eyebrow-shapes-guide',
  'how-to-shape-eyebrows',
];
const results = [];
const attrs = (tag) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
      key.toLowerCase(),
      value,
    ])
  );
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
async function read(path) {
  const response = await fetch(`${origin}${path}`, {
    headers: { 'user-agent': 'Googlebot' },
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(response.status, 200, path);
  return response.text();
}

for (const path of [
  '/',
  '/filter',
  ...locales.flatMap((locale) =>
    slugs.map((slug) => `${locale === 'en' ? '' : `/${locale}`}/blog/${slug}`)
  ),
]) {
  const html = await read(path);
  const meta = Object.fromEntries(
    [...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => {
      const a = attrs(tag);
      return [a.property || a.name, decode(a.content || '')];
    })
  );
  const title = decode(html.match(/<title>(.*?)<\/title>/)?.[1] || '');
  const schemas = [
    ...html.matchAll(
      /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
    ),
  ].flatMap(([, json]) => JSON.parse(json));
  const links = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)];
  const unsafe = links.filter(([tag]) => {
    const a = attrs(tag.split('>')[0]);
    return a.target === '_blank' && !a.rel?.split(' ').includes('noopener');
  });
  assert.equal(unsafe.length, 0, `${path}: blank-target links need noopener`);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${path}: single H1`);
  assert.equal(
    [...html.matchAll(/<link[^>]*hrefLang=/g)].length,
    9,
    `${path}: hreflang`
  );
  if (path.includes('/blog/')) {
    assert.equal(meta['og:title'], title, `${path}: OG title`);
    assert.equal(meta['twitter:title'], title, `${path}: Twitter title`);
    assert.equal(
      meta['og:description'],
      meta.description,
      `${path}: OG description`
    );
    assert.equal(
      meta['twitter:description'],
      meta.description,
      `${path}: Twitter description`
    );
    assert.equal(
      meta['og:url'],
      `https://browlens.com${path}`,
      `${path}: OG URL`
    );
    assert.equal(meta['og:type'], 'article');
    assert.match(meta['og:image'], /^https:\/\/browlens\.com\/imgs\/cases\//);
    const article = schemas.filter((s) => s['@type'] === 'BlogPosting');
    assert.equal(article.length, 1, `${path}: article schema`);
    assert.equal(article[0].mainEntityOfPage, meta['og:url']);
    assert.equal(
      article[0].headline,
      decode(html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1] || '')
    );
    assert.equal(article[0].author.name, 'Browlens Team');
    assert.equal(article[0].datePublished, '2026-09-12T00:00:00.000Z');
    results.push({ path, article: true, ownShareMetadata: true });
  } else {
    const shell = html.split(/<div\b[^>]*\bhidden\b[^>]*\bid="S:/i)[0];
    assert.match(shell, /<button\b[^>]*\bdata-brow-upload\b/);
    const guideId = path === '/' ? 'brow-app-guide' : 'eyebrow-filter-guide';
    assert.match(
      shell,
      new RegExp(`id="${guideId}"`),
      `${path}: guide server-rendered`
    );
    const exactLinks = links.filter(
      ([tag]) =>
        tag.includes('href="/blog/eyebrow-mapping-guide"') &&
        />eyebrow mapping<\/a>/.test(tag)
    );
    assert.ok(exactLinks.length >= 1, `${path}: exact mapping anchor`);
    const body = shell
      .replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    const words = decode(body).trim().split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 1200, `${path}: ${words} words`);
    const headings = [...shell.matchAll(/<h([1-6])\b[^>]*>/g)].map((m) =>
      Number(m[1])
    );
    assert.ok(
      headings.every((level, i) => !i || level <= headings[i - 1] + 1),
      `${path}: heading levels`
    );
    const images = [...shell.matchAll(/<img\b[^>]*>/g)].map(([tag]) =>
      attrs(tag)
    );
    assert.ok(
      images.every((img) => Number(img.width) > 0 && Number(img.height) > 0),
      `${path}: image dimensions`
    );
    const faq = schemas.find((s) => s['@type'] === 'FAQPage');
    for (const question of faq.mainEntity)
      assert.ok(
        decode(body).includes(question.acceptedAnswer.text),
        `${path}: FAQ answer in HTML`
      );
    if (path === '/filter')
      assert.ok(title.length <= 60, `${path}: title length`);
    results.push({
      path,
      words,
      images: images.length,
      imagesWithDimensions: images.length,
      titleLength: title.length,
      mappingLinks: exactLinks.length,
      faqAnswers: faq.mainEntity.length,
    });
  }
}
const sitemap = await read('/sitemap.xml');
for (const locale of locales)
  for (const route of ['', '/filter', '/pricing']) {
    const path = locale === 'en' ? route || '/' : `/${locale}${route}`;
    const entry = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].find(
      ([, text]) => text.includes(`<loc>https://browlens.com${path}</loc>`)
    );
    assert.ok(entry, `sitemap ${path}`);
    assert.match(
      entry[1],
      /<lastmod>2026-09-(12|14)<\/lastmod>/,
      `sitemap ${path} lastmod`
    );
  }
console.log(
  JSON.stringify(
    {
      origin,
      checkedAt: new Date().toISOString(),
      pages: results.length,
      sitemapDatedRoutes: 24,
      results,
    },
    null,
    2
  )
);
