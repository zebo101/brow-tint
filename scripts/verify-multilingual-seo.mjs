// Read-only acceptance check against a running development or production server.
// Run: node scripts/verify-multilingual-seo.mjs http://localhost:3012
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const origin = process.argv[2] || 'http://localhost:3012';
const canonicalOrigin = 'https://browlens.com';
const locales = ['en', 'zh', 'ko', 'ja', 'de', 'es', 'it', 'pt'];
const faceShapePath = '/eyebrow-shape-for-face-shape';
const englishOnlyPaths = new Set([faceShapePath]);
const paths = [
  '/',
  '/filter',
  faceShapePath,
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
let verifiedRedirects = 0;

function stringList(source, label) {
  // Accept literal lists only: fail loudly if the TS configuration changes shape.
  assert.match(source, /^\s*(?:['"][^'"\r\n]+['"]\s*,?\s*)*$/, label);
  return [...source.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function mdxFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      return mdxFiles(path.join(directory, entry.name), relativePath);
    }
    return entry.isFile() && entry.name.endsWith('.mdx') ? [relativePath] : [];
  });
}

const unlocalize = (pathname) =>
  pathname.replace(new RegExp(`^/(?:${locales.join('|')}|zh-CN)(?=/|$)`), '') ||
  '/';

export function buildExpectedSitemapEntries(
  repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
) {
  const readSource = (filename) =>
    readFileSync(path.join(repositoryRoot, filename), 'utf8');
  const sitemapSource = readSource('src/app/sitemap.ts');
  const staticRoutes = sitemapSource.match(
    /const staticRoutes\b[^=]*=\s*\[([\s\S]*?)\n\];/
  )?.[1];
  assert.ok(staticRoutes, 'Cannot parse staticRoutes in src/app/sitemap.ts');

  // Mirror isIndexablePath in src/shared/lib/seo-paths.ts, reading its literal
  // exclusions and src/config/browlens-redirects.ts rather than maintaining copies.
  const seoSource = readSource('src/shared/lib/seo-paths.ts');
  const blockedSource = seoSource.match(
    /const BLOCKED_PREFIXES\s*=\s*\[([^\]]*)\]/
  )?.[1];
  const lowValueSource = seoSource.match(
    /const LOW_VALUE_PATHS\s*=\s*new Set\(\[([^\]]*)\]/
  )?.[1];
  assert.ok(blockedSource !== undefined, 'Cannot parse BLOCKED_PREFIXES');
  assert.ok(lowValueSource !== undefined, 'Cannot parse LOW_VALUE_PATHS');
  const blockedPrefixes = stringList(blockedSource, 'BLOCKED_PREFIXES');
  const excludedPaths = new Set(stringList(lowValueSource, 'LOW_VALUE_PATHS'));
  const redirects = readSource('src/config/browlens-redirects.ts').match(
    /const browlensRedirects\b[^=]*=\s*\{([^}]*)\}/
  )?.[1];
  assert.ok(redirects !== undefined, 'Cannot parse browlensRedirects');
  const redirectPattern = /['"]([^'"]+)['"]\s*:\s*['"][^'"]+['"]\s*,?/g;
  for (const [, pathname] of redirects.matchAll(redirectPattern)) {
    excludedPaths.add(pathname);
  }
  assert.equal(
    redirects.replace(redirectPattern, '').trim(),
    '',
    'browlensRedirects must contain literal paths'
  );
  const isIndexable = (pathname) => {
    const normalized = unlocalize(pathname);
    return (
      !excludedPaths.has(normalized) &&
      !blockedPrefixes.some(
        (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
      )
    );
  };

  const families = new Map();
  const addFamily = (pathname, availableLocales) => {
    const family = families.get(pathname) ?? new Set();
    for (const locale of availableLocales) {
      assert.ok(
        locales.includes(locale),
        `Unsupported sitemap locale: ${locale}`
      );
      family.add(locale);
    }
    families.set(pathname, family);
  };
  // Static routes are flat literal objects; their optional locales list overrides
  // the default, just as expandStaticRoutes in src/app/sitemap-routes.ts does.
  const routeSource = staticRoutes.replace(/\/\/[^\n]*/g, '');
  const routePattern = /\{([^{}]*)\}/g;
  assert.match(
    routeSource.replace(routePattern, ''),
    /^[\s,]*$/,
    'Cannot parse static route objects'
  );
  for (const [, route] of routeSource.matchAll(routePattern)) {
    const pathname = route.match(/\bpath:\s*['"]([^'"]+)['"]/)?.[1];
    assert.ok(pathname, 'Static route must have a literal path');
    const routeLocales = route.match(/\blocales:\s*\[([^\]]*)\]/)?.[1];
    assert.ok(
      !/\blocales\s*:/.test(route) || routeLocales !== undefined,
      'Static route locales must be a literal list'
    );
    addFamily(
      pathname,
      routeLocales === undefined ? locales : stringList(routeLocales, pathname)
    );
  }

  // src/core/docs/source.ts uses dot-suffixed locales, hidden default locale,
  // and fallbackLanguage: null. Group every file, including locale-only families.
  for (const [section, baseUrl] of [
    ['docs', '/docs'],
    ['pages', ''],
    ['posts', '/blog'],
  ]) {
    for (const filename of mdxFiles(
      path.join(repositoryRoot, 'content', section)
    )) {
      let slug = filename.slice(0, -'.mdx'.length);
      const suffix = slug.match(new RegExp(`\\.(${locales.join('|')})$`));
      const locale = suffix?.[1] ?? 'en';
      if (suffix) slug = slug.slice(0, -suffix[0].length);
      // Fumadocs getSlugs omits folder groups and a final index segment. Only
      // remove a recognized locale suffix, preserving dots elsewhere in the slug.
      const segments = slug
        .split('/')
        .filter((segment) => !/^\(.+\)$/.test(segment));
      if (segments.at(-1) === 'index') segments.pop();
      const pathname = [baseUrl, ...segments.map(encodeURI)].join('/') || '/';
      if (isIndexable(pathname)) addFamily(pathname, [locale]);
    }
  }

  /** @type {Map<string, Set<string>>} */
  const expectedSitemapEntries = new Map();
  for (const [pathname, availableLocales] of families) {
    for (const locale of availableLocales) {
      expectedSitemapEntries.set(
        `${canonicalOrigin}${localize(pathname, locale)}`,
        availableLocales
      );
    }
  }
  return expectedSitemapEntries;
}

export function checkSitemap(xml, expectedSitemapEntries) {
  const failures = [];
  const check = (pathname, assertion) => {
    try {
      assertion();
    } catch (error) {
      failures.push({ path: pathname, error: error.message });
    }
  };
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
    (match) => match[1]
  );
  const sitemapLocations = entries.map(
    (entry) => entry.match(/<loc>(.*?)<\/loc>/)?.[1]
  );
  check('/sitemap.xml', () =>
    assert.equal(
      entries.length,
      expectedSitemapEntries.size,
      'sitemap: repository-derived URL count'
    )
  );
  const actualLocations = new Set(sitemapLocations);
  const missing = [...expectedSitemapEntries.keys()].filter(
    (url) => !actualLocations.has(url)
  );
  const unexpected = [...actualLocations].filter(
    (url) => !expectedSitemapEntries.has(url)
  );
  check('/sitemap.xml', () =>
    assert.ok(
      missing.length === 0 && unexpected.length === 0,
      `sitemap: URL set mismatch; missing (${missing.length}): ${JSON.stringify(missing.slice(0, 10))}; unexpected (${unexpected.length}): ${JSON.stringify(unexpected.slice(0, 10))}`
    )
  );
  check('/sitemap.xml', () =>
    assert.doesNotMatch(
      xml,
      /best-brow-tint|brow-code-tint|professional-brow-tint|what-is-xxx/
    )
  );
  for (const locale of locales) {
    for (const pathname of ['/about', '/filter']) {
      check('/sitemap.xml', () =>
        assert.ok(
          actualLocations.has(
            `${canonicalOrigin}${localize(pathname, locale)}`
          ),
          `sitemap: ${locale} ${pathname} URL`
        )
      );
    }
  }
  for (const pathname of englishOnlyPaths) {
    check('/sitemap.xml', () =>
      assert.deepEqual(
        sitemapLocations.filter((url) => url?.endsWith(pathname)),
        [`${canonicalOrigin}${pathname}`],
        `sitemap: ${pathname} only in English`
      )
    );
  }
  for (const [index, entry] of entries.entries()) {
    const loc = sitemapLocations[index];
    // A count/set failure or one bad entry must not prevent checking other entries.
    try {
      assert.ok(loc, 'sitemap: missing loc');
      const url = new URL(loc);
      assert.equal(url.origin, canonicalOrigin, 'sitemap: canonical origin');
      const availableLocales = expectedSitemapEntries.get(loc);
      assert.ok(availableLocales, 'sitemap: unexpected URL');
      const alternates = [...entry.matchAll(/<(?:xhtml:)?link\b[^>]*>/gi)]
        .map(([tag]) =>
          Object.fromEntries(
            [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
              key.toLowerCase(),
              value,
            ])
          )
        )
        .filter((link) => link.rel === 'alternate');
      const targets = [...availableLocales];
      if (availableLocales.has('en')) targets.push('x-default');
      assert.deepEqual(
        alternates.map((link) => link.hreflang).sort(),
        targets.sort(),
        'sitemap: exact hreflang locales'
      );
      const pathname = unlocalize(url.pathname);
      for (const link of alternates) {
        assert.equal(
          link.href,
          `${canonicalOrigin}${localize(pathname, link.hreflang === 'x-default' ? 'en' : link.hreflang)}`,
          `sitemap: ${link.hreflang} must reference the same page`
        );
      }
      assert.ok(
        alternates.some(
          (link) => link.hreflang !== 'x-default' && link.href === loc
        ),
        'sitemap: self alternate'
      );
    } catch (error) {
      failures.push({
        path: loc ?? `/sitemap.xml#entry-${index + 1}`,
        error: error.message,
      });
    }
  }
  return { sitemapCount: entries.length, failures };
}

async function checkPage(pathname, locale) {
  const localized = localize(pathname, locale);
  const response = await fetch(`${origin}${localized}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(90000),
    headers: { 'user-agent': 'Googlebot' },
  });
  if (englishOnlyPaths.has(pathname) && locale !== 'en') {
    assert.equal(
      response.status,
      308,
      `${localized}: permanent English redirect`
    );
    assert.equal(
      new URL(response.headers.get('location'), origin).href,
      new URL(pathname, origin).href,
      `${localized}: unprefixed English destination`
    );
    verifiedRedirects++;
    return;
  }
  assert.equal(response.status, 200, `${localized}: HTTP status`);
  const html = await response.text();
  // Check the HTML shell, before React's hidden streamed Suspense content.
  // Merely finding an H1 anywhere in the response missed an empty hero shell.
  const shell = html.split(/<div\b[^>]*\bhidden\b[^>]*\bid="S:/i)[0];
  if (
    pathname === '/' ||
    pathname === '/filter' ||
    englishOnlyPaths.has(pathname)
  ) {
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
  const availableLocales = englishOnlyPaths.has(pathname) ? ['en'] : locales;
  assert.equal(
    alternates.length,
    availableLocales.length + 1,
    `${localized}: hreflang count`
  );
  for (const target of [...availableLocales, 'x-default']) {
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
      `Verified ${verified + verifiedRedirects}/${paths.length * locales.length} pages and redirects`
    );
  }
}

async function main() {
  const expectedSitemapEntries = buildExpectedSitemapEntries();
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
    const result = checkSitemap(xml, expectedSitemapEntries);
    sitemapCount = result.sitemapCount;
    failures.push(...result.failures);
  } catch (error) {
    failures.push({ path: '/sitemap.xml', error: error.message });
  }

  console.log(
    JSON.stringify(
      {
        origin,
        verifiedPages: verified,
        expectedPages:
          paths.length * locales.length -
          englishOnlyPaths.size * (locales.length - 1),
        verifiedRedirects,
        expectedRedirects: englishOnlyPaths.size * (locales.length - 1),
        sitemapUrls: sitemapCount,
        expectedSitemapUrls: expectedSitemapEntries.size,
        failures,
      },
      null,
      2
    )
  );
  if (failures.length) process.exitCode = 1;
}

// Importable helpers let node:test exercise the verifier without network requests.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
