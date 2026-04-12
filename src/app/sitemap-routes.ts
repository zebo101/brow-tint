import { MetadataRoute } from 'next';

import { buildCanonicalUrl } from '@/shared/lib/seo-paths';

export type StaticSitemapRoute = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
  locales?: string[];
};

type ExpandStaticRoutesOptions = {
  defaultLocale?: string;
  locales?: string[];
  siteUrl?: string;
};

export function expandStaticRoutes(
  routes: StaticSitemapRoute[],
  options: ExpandStaticRoutesOptions = {}
): MetadataRoute.Sitemap {
  const localeList = options.locales ?? [];

  return routes.flatMap((route) => {
    const routeLocales = route.locales ?? localeList;

    return routeLocales.map((locale) => ({
      url: buildCanonicalUrl(route.path, locale, options),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }));
  });
}
