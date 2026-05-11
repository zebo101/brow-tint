import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { defaultLocale, locales } from '@/config/locale';
import { pagesSource } from '@/core/docs/source';
import { buildAlternates } from '@/shared/lib/seo-metadata';
import { buildCanonicalUrl } from '@/shared/lib/seo-paths';
import { getLocalPage } from '@/shared/models/post';

export const revalidate = 3600;

// dynamic page metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  // metadata values
  let title = '';
  let description = '';
  let canonicalUrl = '';

  // 1. try to get static page metadata from
  // content/pages/**/*.mdx

  // static page slug
  const staticPageSlug =
    typeof slug === 'string' ? slug : (slug as string[]).join('/') || '';

  // filter invalid slug
  if (staticPageSlug.includes('.')) {
    return;
  }

  // build canonical url
  canonicalUrl = buildCanonicalUrl(`/${staticPageSlug}`, locale);

  // get static page content
  const staticPage = await getLocalPage({ slug: staticPageSlug, locale });
  const staticPageLocales = locales.filter((entryLocale) =>
    Boolean(pagesSource.getPage([staticPageSlug], entryLocale))
  );

  // return static page metadata
  if (staticPage) {
    title = staticPage.title || '';
    description = staticPage.description || '';

    return {
      title,
      description,
      alternates: buildAlternates(`/${staticPageSlug}`, {
        locale,
        availableLocales:
          staticPageLocales.length > 0 ? staticPageLocales : [defaultLocale],
      }),
    };
  }

  // 2. static page not found, try to get dynamic page metadata from
  // src/config/locale/messages/{locale}/pages/**/*.json

  // dynamic page slug
  const dynamicPageSlug =
    typeof slug === 'string' ? slug : (slug as string[]).join('.') || '';

  const messageKey = `pages.${dynamicPageSlug}`;

  // next-intl throws MISSING_MESSAGE when the namespace doesn't exist
  // for the requested locale. Swallow it and fall through to step 3 —
  // the page component (line ~152) already does the same defensively
  // with notFound(), but generateMetadata has no fallback otherwise.
  try {
    const t = await getTranslations({ locale, namespace: messageKey });

    // return dynamic page metadata
    if (t.has('metadata')) {
      title = t.raw('metadata.title');
      description = t.raw('metadata.description');

      return {
        title,
        description,
        alternates: buildAlternates(`/${staticPageSlug}`, {
          locale,
        }),
      };
    }
  } catch {
    // namespace missing — fall through to common metadata
  }

  // 3. return common metadata
  const tc = await getTranslations('common.metadata');

  title = tc('title');
  description = tc('description');

  return {
    title,
    description,
    alternates: buildAlternates(`/${staticPageSlug}`, {
      locale,
    }),
  };
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // 1. try to get static page from
  // content/pages/**/*.mdx

  // static page slug
  const staticPageSlug =
    typeof slug === 'string' ? slug : (slug as string[]).join('/') || '';

  // filter invalid slug
  if (staticPageSlug.includes('.')) {
    return notFound();
  }

  // get static page content
  const staticPage = await getLocalPage({ slug: staticPageSlug, locale });

  // return static page
  if (staticPage) {
    const Page = await getThemePage('static-page');

    return <Page locale={locale} post={staticPage} />;
  }

  // 2. static page not found
  // try to get dynamic page content from
  // src/config/locale/messages/{locale}/pages/**/*.json

  // dynamic page slug
  const dynamicPageSlug =
    typeof slug === 'string' ? slug : (slug as string[]).join('.') || '';

  const messageKey = `pages.${dynamicPageSlug}`;

  try {
    const t = await getTranslations({ locale, namespace: messageKey });

    // return dynamic page
    if (t.has('page')) {
      const Page = await getThemePage('dynamic-page');
      return <Page locale={locale} page={t.raw('page')} />;
    }
  } catch (error) {
    // ignore error if translation not found
    return notFound();
  }

  // 3. page not found
  return notFound();
}
