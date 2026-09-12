import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { getHomepageShownSections } from '@/shared/lib/homepage-sections';
import { getMetadata } from '@/shared/lib/seo';
import type { DynamicPage } from '@/shared/types/blocks/landing';
import { getActiveBrowStyles } from '@/themes/default/blocks/brow-tint/styles-loader';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'pages.index.metadata',
  canonicalUrl: '/',
});

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.index');
  const pageData = t.raw('page');
  const styles = await getActiveBrowStyles();

  // The existing AI studio is now the homepage hero. Keep upload first in
  // both DOM and visual order; marketing sections follow the working tool.
  const page: DynamicPage = {
    ...pageData,
    sections: {
      studio: { block: 'brow-tint-studio', id: 'studio', data: { styles } },
      ...pageData.sections,
    },
    show_sections: getHomepageShownSections([
      'studio',
      ...pageData.show_sections,
    ]),
  };

  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}
