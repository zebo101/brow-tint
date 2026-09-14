// Read-only acceptance check against a running development or production server.
// Run: node scripts/verify-multilingual-seo.mjs http://localhost:3012
import assert from 'node:assert/strict';

const origin = process.argv[2] || 'http://localhost:3012';
const canonicalOrigin = 'https://browlens.com';
const locales = ['en', 'zh', 'ko', 'ja', 'de', 'es', 'it', 'pt'];
const paths = [
  '/',
  '/filter',
  '/blog',
  '/pricing',
  '/showcases',
  '/updates',
  '/docs',
  '/about',
  '/blog/eyebrow-mapping-guide',
  '/blog/eyebrow-shapes-guide',
  '/blog/how-to-shape-eyebrows',
  '/privacy-policy',
  '/terms-of-service',
  '/cookie-policy',
];
const localize = (pathname, locale) =>
  locale === 'en' ? pathname : `/${locale}${pathname === '/' ? '' : pathname}`;
const failures = [];
let verified = 0;

async function checkPage(pathname, locale) {
  const localized = localize(pathname, locale);
  const response = await fetch(`${origin}${localized}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(90000),
    headers: { 'user-agent': 'Googlebot' },
  });
  assert.equal(response.status, 200, `${localized}: HTTP status`);
  const html = await response.text();
  // Check the HTML shell, before React's hidden streamed Suspense content.
  // Merely finding an H1 anywhere in the response missed an empty hero shell.
  const shell = html.split(/<div\b[^>]*\bhidden\b[^>]*\bid="S:/i)[0];
  if (pathname === '/' || pathname === '/filter') {
    assert.match(
      shell,
      /<h1\b[^>]*>[^<]+<\/h1>/,
      `${localized}: H1 in initial HTML`
    );
    assert.match(
      shell,
      /<button\b[^>]*\bdata-brow-upload\b/,
      `${localized}: upload in initial HTML`
    );
  }
  if (pathname === '/blog') {
    const headings = [...html.matchAll(/<h1\b[^>]*>[\s\S]*?<\/h1>/g)];
    assert.equal(headings.length, 1, `${localized}: one blog H1`);
    assert.doesNotMatch(
      headings[0][0],
      /sr-only/,
      `${localized}: visible blog H1`
    );
  }
  assert.doesNotMatch(
    html,
    /<meta\b[^>]*\bname="keywords"/i,
    `${localized}: no keywords meta`
  );
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) =>
    Object.fromEntries(
      [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
        key.toLowerCase(),
        value,
      ])
    )
  );
  const canonicals = links.filter((link) => link.rel === 'canonical');
  assert.equal(canonicals.length, 1, `${localized}: canonical count`);
  assert.equal(
    canonicals[0].href,
    `${canonicalOrigin}${localized}`,
    `${localized}: canonical`
  );
  const alternates = links.filter(
    (link) => link.rel === 'alternate' && link.hreflang
  );
  assert.equal(alternates.length, 9, `${localized}: hreflang count`);
  for (const target of [...locales, 'x-default']) {
    const matches = alternates.filter((link) => link.hreflang === target);
    assert.equal(matches.length, 1, `${localized}: unique ${target}`);
    assert.equal(
      matches[0].href,
      `${canonicalOrigin}${localize(pathname, target === 'x-default' ? 'en' : target)}`,
      `${localized}: ${target} must reference the same page`
    );
  }
  assert.match(
    html,
    new RegExp(`<html[^>]*lang="${locale}"`),
    `${localized}: document language`
  );
  verified++;
  if (verified % 8 === 0) {
    console.error(
      `Verified ${verified}/${paths.length * locales.length} pages`
    );
  }
}

// Low concurrency avoids overwhelming a development server compiling new routes.
const queue = paths.flatMap((pathname) =>
  locales.map((locale) => [pathname, locale])
);
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (queue.length) {
      const [pathname, locale] = queue.shift();
      try {
        await checkPage(pathname, locale);
      } catch (error) {
        failures.push({
          path: localize(pathname, locale),
          error: error.message,
        });
      }
    }
  })
);

for (const pathname of [
  '/blog/best-brow-tint-2026',
  '/zh/blog/what-is-xxx',
  '/ja/blog/brow-code-tint-review',
]) {
  try {
    const response = await fetch(`${origin}${pathname}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(
      response.status,
      404,
      `${pathname}: retired article must be missing`
    );
  } catch (error) {
    failures.push({ path: pathname, error: error.message });
  }
}

let sitemapCount = 0;
try {
  const response = await fetch(`${origin}/sitemap.xml`, {
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200);
  const xml = await response.text();
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
    (match) => match[1]
  );
  sitemapCount = entries.length;
  assert.equal(
    sitemapCount,
    96,
    'sitemap: 12 indexed page families (including About) × 8 languages'
  );
  assert.doesNotMatch(
    xml,
    /best-brow-tint|brow-code-tint|professional-brow-tint|what-is-xxx/
  );
  const sitemapLocations = entries.map(
    (entry) => entry.match(/<loc>(.*?)<\/loc>/)?.[1]
  );
  for (const locale of locales) {
    assert.ok(
      sitemapLocations.includes(
        `${canonicalOrigin}${localize('/about', locale)}`
      ),
      `sitemap: ${locale} About URL`
    );
    assert.ok(
      sitemapLocations.includes(
        `${canonicalOrigin}${localize('/filter', locale)}`
      ),
      `sitemap: ${locale} filter URL`
    );
  }
  for (const entry of entries) {
    const loc = entry.match(/<loc>(.*?)<\/loc>/)?.[1];
    assert.ok(loc?.startsWith(canonicalOrigin));
    const alternates = [
      ...entry.matchAll(/hreflang="([^"]+)"\s+href="([^"]+)"/g),
    ];
    assert.equal(alternates.length, 9, `sitemap ${loc}: alternate count`);
    assert.deepEqual(
      alternates.map((match) => match[1]).sort(),
      [...locales, 'x-default'].sort()
    );
    assert.ok(
      alternates.some((match) => match[2] === loc),
      `sitemap ${loc}: self alternate`
    );
  }
} catch (error) {
  failures.push({ path: '/sitemap.xml', error: error.message });
}

console.log(
  JSON.stringify(
    {
      origin,
      verifiedPages: verified,
      expectedPages: paths.length * locales.length,
      sitemapUrls: sitemapCount,
      failures,
    },
    null,
    2
  )
);
if (failures.length) process.exitCode = 1;
