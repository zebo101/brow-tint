import fs from 'node:fs';
import path from 'node:path';
import { MetadataRoute } from 'next';

import { defaultLocale, locales } from '@/config/locale';
import { docsSource, i18n, pagesSource, postsSource } from '@/core/docs/source';
import { PostStatus, PostType, getPosts } from '@/shared/models/post';
import { buildCanonicalUrl, isIndexablePath } from '@/shared/lib/seo-paths';
import { expandStaticRoutes, StaticSitemapRoute } from './sitemap-routes';

type SitemapEntry = MetadataRoute.Sitemap[number];

const staticRoutes: StaticSitemapRoute[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/showcases', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/ai-brow-tint-generator', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/hairstyle-changer-ai-video', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/ai-music-generator', changeFrequency: 'weekly', priority: 0.75 },
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
  }: {
    changeFrequency: NonNullable<SitemapEntry['changeFrequency']>;
    lastModified?: Date;
    locale?: string;
    priority: number;
  }
): SitemapEntry {
  return {
    url: buildCanonicalUrl(pathname, locale),
    lastModified,
    changeFrequency,
    priority,
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

  return Array.from(entryMap.values()).sort((a, b) => a.url.localeCompare(b.url));
}

function buildStaticRouteEntries() {
  return expandStaticRoutes(staticRoutes, {
    defaultLocale,
    locales,
  });
}

function buildSourceEntries(
  contentDir: string,
  getPages: (locale: string) => Array<{ path: string; url: string }>
,
  {
    changeFrequency,
    priority,
  }: {
    changeFrequency: NonNullable<SitemapEntry['changeFrequency']>;
    priority: number;
  }
) {
  return i18n.languages.flatMap((locale) =>
    getPages(locale)
      .filter((page) => isIndexablePath(page.url))
      .map((page) =>
        createEntry(page.url, {
          changeFrequency,
          priority,
          lastModified: getFileLastModified(
            path.join(process.cwd(), contentDir, page.path)
          ),
        })
      )
  );
}

async function buildRemotePostEntries() {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const posts = await getPosts({
      type: PostType.ARTICLE,
      status: PostStatus.PUBLISHED,
      limit: 500,
    });

    return posts
      .filter((post) => post.slug)
      .map((post) =>
        createEntry(`/blog/${post.slug}`, {
          locale: defaultLocale,
          changeFrequency: 'weekly',
          priority: 0.7,
          lastModified: post.updatedAt ?? post.createdAt ?? undefined,
        })
      );
  } catch (error) {
    console.log('building remote sitemap entries failed:', error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = buildStaticRouteEntries();
  const docsEntries = buildSourceEntries('content/docs', (locale) => docsSource.getPages(locale), {
    changeFrequency: 'weekly',
    priority: 0.65,
  });
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
  const remotePostEntries = await buildRemotePostEntries();

  return dedupeEntries([
    ...staticEntries,
    ...docsEntries,
    ...pageEntries,
    ...postEntries,
    ...remotePostEntries,
  ]);
}
