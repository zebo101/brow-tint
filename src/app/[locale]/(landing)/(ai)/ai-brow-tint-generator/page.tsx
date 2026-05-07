import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { getThemePage } from '@/core/theme';
import { JsonLd } from '@/shared/components/json-ld';
import { getMetadata } from '@/shared/lib/seo';
import { buildCanonicalUrl, getSiteUrl } from '@/shared/lib/seo-paths';
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

  const canonicalUrl = buildCanonicalUrl('/ai-brow-tint-generator', locale);
  const homeUrl = buildCanonicalUrl('/', locale);
  const previewImage = envConfigs.app_preview_image || '/logo.png';
  const productImage = previewImage.startsWith('http')
    ? previewImage
    : `${getSiteUrl()}${previewImage}`;

  // aggregateRating intentionally omitted until a real in-product rating
  // system exists. Faking ratings violates Google's structured-data policy.
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: t('product.name'),
    description: t('product.description'),
    url: canonicalUrl,
    image: productImage,
    brand: {
      '@type': 'Brand',
      name: envConfigs.app_name || 'Brow Tint',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: t('breadcrumb.home'),
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: t('breadcrumb.current'),
        item: canonicalUrl,
      },
    ],
  };

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
      <JsonLd id="product-schema" schema={productSchema} />
      <JsonLd id="breadcrumb-schema" schema={breadcrumbSchema} />
      <Suspense>
        <BrowTintStudio styles={styles} />
      </Suspense>
      <Page locale={locale} page={page} />
    </>
  );
}
