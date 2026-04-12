import { buildCanonicalUrl, buildLanguageAlternates } from '@/shared/lib/seo-paths';

type BuildAlternatesOptions = {
  locale?: string;
  defaultLocale?: string;
  locales?: string[];
  siteUrl?: string;
  availableLocales?: string[];
  noIndex?: boolean;
};

export function buildAlternates(
  pathname: string,
  options: BuildAlternatesOptions = {}
) {
  const canonical = buildCanonicalUrl(pathname, options.locale, options);

  if (options.noIndex) {
    return { canonical };
  }

  const languages = buildLanguageAlternates(pathname, {
    ...options,
    locales: options.availableLocales ?? options.locales,
  });

  return {
    canonical,
    languages,
  };
}
