import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { ImageGenerator } from '@/shared/blocks/generator';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'ai.image.metadata',
  canonicalUrl: '/ai-hairstyle-changer',
});

export default async function AiHairstyleChangerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // get ai image data
  const t = await getTranslations('ai.image');
  const pageData = t.raw('page');

  // remove generator from sections as it will be inside hero
  const { generator, ...sections } = pageData.sections || {};

  // build page sections
  const page: DynamicPage = {
    ...pageData,
    sections: {
      ...sections,
      hero: {
        ...pageData.sections?.hero,
        // pass custom content via data which DynamicPage spreads to block
        data: {
          customContent: <ImageGenerator srOnlyTitle={t.raw('generator.title')} />,
        },
        background_image: {
          src: '/imgs/bg/image-bg2.png',
          alt: 'hero background',
        },
      },
    },
  };

  // load page component
  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}
