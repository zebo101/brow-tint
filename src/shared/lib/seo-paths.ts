import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';

type SeoPathOptions = {
  defaultLocale?: string;
  locales?: string[];
  siteUrl?: string;
};

const BLOCKED_PREFIXES = [
  '/activity',
  '/admin',
  '/api',
  '/chat',
  '/no-permission',
  '/settings',
  '/sign-in',
  '/sign-up',
  '/verify-email',
];

const LOW_VALUE_PATHS = new Set(['/privacy-policy', '/terms-of-service']);

function getOptions(options: SeoPathOptions = {}) {
  return {
    siteUrl: options.siteUrl ?? envConfigs.app_url,
    defaultLocale: options.defaultLocale ?? defaultLocale,
    locales: options.locales ?? locales,
  };
}

function collapseSlashes(value: string) {
  return value.replace(/\/{2,}/g, '/');
}

function stripQueryAndHash(value: string) {
  return value.split(/[?#]/, 1)[0] || '';
}

function normalizePathname(pathname = '/') {
  const normalized = stripQueryAndHash(pathname.trim());

  if (!normalized) {
    return '/';
  }

  if (/^https?:\/\//i.test(normalized)) {
    const url = new URL(normalized);
    return normalizePathname(url.pathname);
  }

  const withLeadingSlash = normalized.startsWith('/')
    ? normalized
    : `/${normalized}`;
  const collapsed = collapseSlashes(withLeadingSlash);

  return collapsed.length > 1 && collapsed.endsWith('/')
    ? collapsed.slice(0, -1)
    : collapsed;
}

function stripLocalePrefix(pathname: string, localeList: string[]) {
  const normalizedPath = normalizePathname(pathname);

  for (const locale of localeList) {
    if (normalizedPath === `/${locale}`) {
      return '/';
    }

    if (normalizedPath.startsWith(`/${locale}/`)) {
      return normalizePathname(normalizedPath.slice(locale.length + 1));
    }
  }

  return normalizedPath;
}

export function getSiteUrl(options: SeoPathOptions = {}) {
  const { siteUrl } = getOptions(options);

  return (siteUrl || 'http://localhost:3000').replace(/\/+$/, '');
}

export function buildCanonicalUrl(
  pathname = '/',
  locale?: string,
  options: SeoPathOptions = {}
) {
  if (/^https?:\/\//i.test(pathname)) {
    const url = new URL(pathname);
    return `${getSiteUrl(options)}${normalizePathname(url.pathname)}`;
  }

  const resolvedOptions = getOptions(options);
  const normalizedPath = stripLocalePrefix(pathname, resolvedOptions.locales);
  const localizedPath =
    locale && locale !== resolvedOptions.defaultLocale
      ? normalizePathname(`/${locale}${normalizedPath}`)
      : normalizedPath;

  return `${getSiteUrl(resolvedOptions)}${localizedPath}`;
}

export function buildLanguageAlternates(
  pathname = '/',
  options: SeoPathOptions = {}
) {
  const resolvedOptions = getOptions(options);
  const normalizedPath = stripLocalePrefix(pathname, resolvedOptions.locales);

  return Object.fromEntries(
    resolvedOptions.locales.map((locale) => [
      locale,
      buildCanonicalUrl(normalizedPath, locale, resolvedOptions),
    ])
  );
}

export function isIndexablePath(
  pathname: string,
  options: SeoPathOptions = {}
) {
  const resolvedOptions = getOptions(options);
  const normalizedPath = stripLocalePrefix(pathname, resolvedOptions.locales);

  if (LOW_VALUE_PATHS.has(normalizedPath)) {
    return false;
  }

  return !BLOCKED_PREFIXES.some(
    (prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );
}
