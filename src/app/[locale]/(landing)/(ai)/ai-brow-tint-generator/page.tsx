import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { getMetadata } from '@/shared/lib/seo';
import { BrowTintStudio } from '@/themes/default/blocks/brow-tint/studio';
import { getActiveBrowStyles } from '@/themes/default/blocks/brow-tint/styles-loader';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'ai.image.metadata',
  canonicalUrl: '/ai-brow-tint-generator',
});

export default async function AiBrowTintGeneratorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('ai.image');
  const pageData = t.raw('page');
  const styles = await getActiveBrowStyles();

  // The studio IS the hero — render it directly above the page so it sits
  // right under the site header with no marketing-banner padding pushing the
  // Generate CTA below the fold. Then DynamicPage renders only the SEO
  // long-form sections (introduce / benefits / usage / features / etc.).
  const seoSections = { ...(pageData.sections || {}) };
  delete seoSections.hero;
  delete seoSections.generator;

  const showSections = (pageData.show_sections || []).filter(
    (k: string) => k !== 'hero' && k !== 'generator'
  );

  const page: DynamicPage = {
    ...pageData,
    sections: seoSections,
    show_sections: showSections,
  };

  const Page = await getThemePage('dynamic-page');

  return (
    <>
      <Suspense>
        <BrowTintStudio styles={styles} />
      </Suspense>
      <Page locale={locale} page={page} />
    </>
  );
}
