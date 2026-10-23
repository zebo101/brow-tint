import assert from 'node:assert/strict';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

import { locales } from '@/config/locale';

import {
  buildExpectedSitemapEntries,
  checkSitemap,
} from '../../scripts/verify-multilingual-seo.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const canonicalOrigin = 'https://browlens.com';
type Sitemap = Awaited<ReturnType<(typeof import('./sitemap'))['default']>>;
type Sources = Record<
  'docsSource' | 'pagesSource' | 'postsSource',
  {
    getPages: (locale: string) => Array<{ path: string; url: string }>;
  }
>;

function isolatedSitemap(t: TestContext, sources: Sources) {
  const require = createRequire(import.meta.url);
  const sourcePath = require.resolve('@/core/docs/source');
  const sitemapPath = require.resolve('./sitemap');
  const savedSource = require.cache[sourcePath];
  const savedSitemap = require.cache[sitemapPath];
  t.after(() => {
    for (const [path, cached] of [
      [sourcePath, savedSource],
      [sitemapPath, savedSitemap],
    ] as const) {
      if (cached) require.cache[path] = cached;
      else delete require.cache[path];
    }
  });
  // Isolate generated MDX data, but exercise the real registered static routes
  // and sitemap builder rather than only a duplicated route fixture.
  require.cache[sourcePath] = {
    id: sourcePath,
    filename: sourcePath,
    loaded: true,
    exports: {
      i18n: { languages: locales },
      ...sources,
    },
  } as NodeJS.Module;
  delete require.cache[sitemapPath];
  return (require('./sitemap') as typeof import('./sitemap')).default;
}

async function filesystemSources(root: string): Promise<Sources> {
  // Fumadocs exposes the loader through its ESM import condition only.
  const { loader } = await import('fumadocs-core/source');
  const source = (section: string, baseUrl: string) =>
    loader({
      baseUrl,
      // Read actual filenames, not the generated MDX index. The existing Fumadocs
      // loader supplies its real dot-locale/index/group URL rules without compiling MDX.
      source: {
        files: readdirSync(path.join(root, 'content', section), {
          recursive: true,
          encoding: 'utf8',
        })
          .filter((filename) => filename.endsWith('.mdx'))
          .map((filename) => ({
            type: 'page' as const,
            path: filename,
            data: {},
          })),
      },
      i18n: {
        languages: locales,
        defaultLanguage: 'en',
        hideLocale: 'default-locale',
        fallbackLanguage: null,
      },
    });
  return {
    docsSource: source('docs', '/docs'),
    pagesSource: source('pages', '/'),
    postsSource: source('posts', '/blog'),
  };
}

function sitemapXml(entries: Sitemap) {
  return `<urlset>${entries
    .map(
      (entry) =>
        `<url><loc>${entry.url}</loc>${Object.entries(
          entry.alternates?.languages ?? {}
        )
          .map(
            ([locale, url]) =>
              `<xhtml:link rel="alternate" hreflang="${locale}" href="${url}"/>`
          )
          .join('')}</url>`
    )
    .join('')}</urlset>`;
}

test('the registered face-shape route emits exactly one English sitemap entry', async (t) => {
  const emptySource = { getPages: () => [] };
  const sitemap = isolatedSitemap(t, {
    docsSource: emptySource,
    pagesSource: emptySource,
    postsSource: emptySource,
  });
  const pathname = '/eyebrow-shape-for-face-shape';
  const url = `https://browlens.com${pathname}`;
  const entries = (await sitemap()).filter((entry) =>
    entry.url.endsWith(pathname)
  );
  assert.deepEqual(entries, [
    {
      url,
      changeFrequency: 'weekly',
      priority: 0.9,
      lastModified: '2026-10-22',
      alternates: { languages: { en: url, 'x-default': url } },
    },
  ]);
});

test('repository-derived expectations match the sitemap built from real content files', async (t) => {
  const sitemap = isolatedSitemap(t, await filesystemSources(repositoryRoot));
  const entries = await sitemap();
  const expected = buildExpectedSitemapEntries();
  assert.equal(entries.length, expected.size);
  assert.deepEqual(
    new Set(entries.map((entry) => entry.url)),
    new Set(expected.keys())
  );
  assert.deepEqual(checkSitemap(sitemapXml(entries), expected).failures, []);
});

test('locale-only and en+ko post files get exact alternates and independent verification failures', async (t) => {
  // Copy the real content into a disposable fixture; never add posts to content/.
  const root = mkdtempSync(path.join(tmpdir(), 'browlens-sitemap-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const filename of [
    'src/app/sitemap.ts',
    'src/shared/lib/seo-paths.ts',
    'src/config/browlens-redirects.ts',
    'content/docs',
    'content/pages',
    'content/posts',
  ]) {
    mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
    cpSync(path.join(repositoryRoot, filename), path.join(root, filename), {
      recursive: true,
    });
  }
  for (const filename of [
    'posts/s1-only.v2.ko.mdx',
    'posts/s1-pair.v2.mdx',
    'posts/s1-pair.v2.ko.mdx',
    'docs/nested/(group)/index.ko.mdx',
    'pages/admin/private.ko.mdx',
  ]) {
    const target = path.join(root, 'content', filename);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, '---\ntitle: Temporary sitemap fixture\n---\n');
  }
  const sitemap = isolatedSitemap(t, await filesystemSources(root));
  const entries = await sitemap();
  const onlyKo = `${canonicalOrigin}/ko/blog/s1-only.v2`;
  const pairEn = `${canonicalOrigin}/blog/s1-pair.v2`;
  const pairKo = `${canonicalOrigin}/ko/blog/s1-pair.v2`;
  const onlyEntries = entries.filter((entry) =>
    entry.url.endsWith('/blog/s1-only.v2')
  );
  assert.equal(onlyEntries.length, 1);
  assert.equal(onlyEntries[0].url, onlyKo);
  assert.deepEqual(onlyEntries[0].alternates?.languages, { ko: onlyKo });
  const pairEntries = entries.filter((entry) =>
    entry.url.endsWith('/blog/s1-pair.v2')
  );
  assert.deepEqual(
    new Set(pairEntries.map((entry) => entry.url)),
    new Set([pairEn, pairKo])
  );
  for (const entry of pairEntries) {
    assert.deepEqual(entry.alternates?.languages, {
      en: pairEn,
      ko: pairKo,
      'x-default': pairEn,
    });
  }
  const expected = buildExpectedSitemapEntries(root);
  assert.deepEqual(expected.get(onlyKo), new Set(['ko']));
  assert.deepEqual(expected.get(pairEn), new Set(['en', 'ko']));
  assert.deepEqual(expected.get(pairKo), new Set(['en', 'ko']));
  assert.ok(expected.has(`${canonicalOrigin}/ko/docs/nested`));
  assert.ok(!expected.has(`${canonicalOrigin}/ko/admin/private`));
  assert.equal(entries.length, expected.size);
  const xml = sitemapXml(entries);
  assert.deepEqual(checkSitemap(xml, expected).failures, []);

  const brokenEntries = entries
    .filter((entry) => entry.url !== `${canonicalOrigin}/`)
    .map((entry) => {
      if (entry.url === onlyKo) {
        return {
          ...entry,
          alternates: { languages: { ko: onlyKo, 'x-default': onlyKo } },
        };
      }
      if (entry.url === pairEn) {
        return {
          ...entry,
          alternates: {
            languages: { en: pairEn, ko: pairKo, 'x-default': pairKo },
          },
        };
      }
      return entry;
    });
  const { failures } = checkSitemap(sitemapXml(brokenEntries), expected);
  assert.equal(
    failures.length,
    4,
    'count, URL set, and both bad entries must all be reported'
  );
  assert.ok(
    failures.some((failure) =>
      failure.error.includes('repository-derived URL count')
    )
  );
  assert.ok(failures.some((failure) => failure.error.includes('missing (1)')));
  assert.ok(
    failures.some(
      (failure) =>
        failure.path === onlyKo &&
        failure.error.includes('exact hreflang locales')
    )
  );
  assert.ok(
    failures.some(
      (failure) =>
        failure.path === pairEn &&
        failure.error.includes('x-default must reference the same page')
    )
  );

  const unexpectedUrl = `${canonicalOrigin}/blog/not-in-content`;
  const swapped = checkSitemap(
    xml.replace(`<loc>${onlyKo}</loc>`, `<loc>${unexpectedUrl}</loc>`),
    expected
  );
  assert.ok(
    !swapped.failures.some((failure) =>
      failure.error.includes('repository-derived URL count')
    )
  );
  const mismatch = swapped.failures.find((failure) =>
    failure.error.includes('URL set mismatch')
  );
  assert.ok(mismatch);
  assert.ok(mismatch.error.includes(onlyKo));
  assert.ok(mismatch.error.includes(unexpectedUrl));
});
