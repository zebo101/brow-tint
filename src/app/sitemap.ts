import fs from 'node:fs';
import path from 'node:path';
import { MetadataRoute } from 'next';

import { docsSource, i18n, pagesSource, postsSource } from '@/core/docs/source';
import { defaultLocale, locales } from '@/config/locale';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  isIndexablePath,
} from '@/shared/lib/seo-paths';

import { expandStaticRoutes, StaticSitemapRoute } from './sitemap-routes';

type SitemapEntry = MetadataRoute.Sitemap[number];

const staticRoutes: StaticSitemapRoute[] = [
  // Recorded substantive content/template updates, not build or request dates.
  // Update these when the corresponding page changes meaningfully.
  {
    path: '/',
    changeFrequency: 'daily',
    priority: 1,
    lastModified: '2026-09-14',
  },
  {
    path: '/pricing',
    changeFrequency: 'weekly',
    priority: 0.9,
    lastModified: '2026-09-12',
  },
  { path: '/showcases', changeFrequency: 'weekly', priority: 0.85 },
  {
    path: '/filter',
    changeFrequency: 'weekly',
    priority: 0.9,
    lastModified: '2026-09-14',
  },
  { path: '/blog', changeFrequency: 'daily', priority: 0.8 },
  { path: '/updates', changeFrequency: 'weekly', priority: 0.7 },
];

function getFileLastModified(filePath: string) {
  try {
    return fs.statSync(filePath).mtime;
  } catch {
    return undefined;
  }
}

function createEntry(
  pathname: string,
  {
    changeFrequency,
    lastModified,
    locale,
    priority,
    availableLocales,
  }: {
    changeFrequency: NonNullable<SitemapEntry['changeFrequency']>;
    lastModified?: Date;
    locale?: string;
    priority: number;
    availableLocales?: string[];
  }
): SitemapEntry {
  return {
    url: buildCanonicalUrl(pathname, locale),
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: buildLanguageAlternates(pathname, {
        locales: availableLocales ?? [locale ?? defaultLocale],
      }),
    },
  };
}

function dedupeEntries(entries: SitemapEntry[]) {
  const entryMap = new Map<string, SitemapEntry>();

  for (const entry of entries) {
    const current = entryMap.get(entry.url);

    if (!current) {
      entryMap.set(entry.url, entry);
      continue;
    }

    if (
      entry.lastModified &&
      (!current.lastModified || entry.lastModified > current.lastModified)
    ) {
      entryMap.set(entry.url, entry);
    }
  }

  return Array.from(entryMap.values()).sort((a, b) =>
    a.url.localeCompare(b.url)
  );
}

function buildStaticRouteEntries() {
  return expandStaticRoutes(staticRoutes, {
    defaultLocale,
    locales,
  });
}

function buildSourceEntries(
  contentDir: string,
  getPages: (locale: string) => Array<{ path: string; url: string }>,
  {
    changeFrequency,
    priority,
  }: {
    changeFrequency: NonNullable<SitemapEntry['changeFrequency']>;
    priority: number;
  }
) {
  const translatedPages = i18n.languages.map((locale) => ({
    locale,
    pages: getPages(locale),
  }));
  return translatedPages.flatMap(({ locale, pages }) =>
    pages
      .filter((page) => isIndexablePath(page.url))
      .map((page) =>
        createEntry(page.url, {
          changeFrequency,
          priority,
          locale,
          availableLocales: translatedPages
            .filter((group) =>
              group.pages.some(
                (other) =>
                  buildCanonicalUrl(other.url, defaultLocale) ===
                  buildCanonicalUrl(page.url, defaultLocale)
              )
            )
            .map((group) => group.locale),
          lastModified: getFileLastModified(
            path.join(process.cwd(), contentDir, page.path)
          ),
        })
      )
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = buildStaticRouteEntries();
  const docsEntries = buildSourceEntries(
    'content/docs',
    (locale) => docsSource.getPages(locale),
    {
      changeFrequency: 'weekly',
      priority: 0.65,
    }
  );
  const pageEntries = buildSourceEntries(
    'content/pages',
    (locale) => pagesSource.getPages(locale),
    {
      changeFrequency: 'monthly',
      priority: 0.5,
    }
  );
  const postEntries = buildSourceEntries(
    'content/posts',
    (locale) => postsSource.getPages(locale),
    {
      changeFrequency: 'weekly',
      priority: 0.7,
    }
  );

  return dedupeEntries([
    ...staticEntries,
    ...docsEntries,
    ...pageEntries,
    ...postEntries,
  ]);
}
