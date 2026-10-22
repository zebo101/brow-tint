import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { JsonLd } from '@/shared/components/json-ld';
import { getMetadata } from '@/shared/lib/seo';
import { buildCanonicalUrl } from '@/shared/lib/seo-paths';
import type { DynamicPage } from '@/shared/types/blocks/landing';
import { BrowTintStudio } from '@/themes/default/blocks/brow-tint/studio';
import { getActiveBrowStyles } from '@/themes/default/blocks/brow-tint/styles-loader';
import { Hero } from '@/themes/default/blocks/hero';

export const revalidate = 3600;

const pathname = '/eyebrow-shape-for-face-shape';
type PageProps = { params: Promise<{ locale: string }> };

const pageMetadata = getMetadata({
  metadataKey: 'pages.face-shape.metadata',
  canonicalUrl: pathname,
  availableLocales: ['en'],
});

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  // This guide is intentionally English-only, not temporarily untranslated.
  // Use Next's redirect so next-intl does not reapply the requested locale.
  if (locale !== 'en') permanentRedirect(pathname);
  return pageMetadata(props);
}

export default async function FaceShapePage({ params }: PageProps) {
  const { locale } = await params;
  if (locale !== 'en') permanentRedirect(pathname);
  setRequestLocale(locale);

  const t = await getTranslations('pages.face-shape');
  const pageData: DynamicPage = t.raw('page');
  const { hero, studio, ...seoSections } = pageData.sections!;
  const styles = await getActiveBrowStyles();
  const Page = await getThemePage('dynamic-page');

  const page: DynamicPage = {
    ...pageData,
    sections: seoSections,
    show_sections: pageData.show_sections?.filter(
      (key) => key !== 'hero' && key !== 'studio'
    ),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: t('breadcrumb.home'),
        item: buildCanonicalUrl('/', locale),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: t('breadcrumb.current'),
        item: buildCanonicalUrl(pathname, locale),
      },
    ],
  };

  return (
    <>
      <JsonLd id="breadcrumb-schema" schema={breadcrumbSchema} />
      {/* Like /filter, keep the upload entry point in the initial HTML. */}
      <Hero section={hero} />
      <div id={studio.id} className="scroll-mt-20">
        <BrowTintStudio
          styles={styles}
          mode="filter"
          titleAs="h2"
          title={studio.title}
          subtitle={studio.description}
        />
      </div>
      <Page locale={locale} page={page} />
    </>
  );
}
