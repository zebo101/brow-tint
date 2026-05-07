import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { getHomepageShownSections } from '@/shared/lib/homepage-sections';
import { getMetadata } from '@/shared/lib/seo';
import type { DynamicPage, Section } from '@/shared/types/blocks/landing';
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

  // Inject the BrowTintStudio as a section right after `hero`. We do this at
  // runtime (not in JSON) because the studio needs server-fetched style data.
  // Insertion-order of `sections` keys drives the render order in DynamicPage.
  const originalSections = pageData.sections ?? {};
  const originalShown: string[] = pageData.show_sections ?? Object.keys(originalSections);

  const studioSection = {
    block: 'brow-tint-studio',
    id: 'studio',
    data: { styles },
  };

  const reorderedSections: Record<string, Section> = {};
  let inserted = false;
  for (const key of Object.keys(originalSections)) {
    reorderedSections[key] = originalSections[key];
    if (key === 'hero' && !inserted) {
      reorderedSections['studio'] = studioSection;
      inserted = true;
    }
  }
  if (!inserted) {
    reorderedSections['studio'] = studioSection;
  }

  const heroIndex = originalShown.indexOf('hero');
  const reorderedShown =
    heroIndex >= 0
      ? [
          ...originalShown.slice(0, heroIndex + 1),
          'studio',
          ...originalShown.slice(heroIndex + 1),
        ]
      : ['studio', ...originalShown];

  const page: DynamicPage = {
    ...pageData,
    sections: reorderedSections,
    show_sections: getHomepageShownSections(reorderedShown),
  };

  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}
