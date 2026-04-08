import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { VideoGenerator } from '@/shared/blocks/generator';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'ai.video.metadata',
  canonicalUrl: '/hairstyle-changer-ai-video',
});

export default async function HairstyleChangerAiVideoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // get ai video data
  const t = await getTranslations('ai.video');
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
        data: {
          customContent: (
            <div id="generator">
              <VideoGenerator srOnlyTitle={t.raw('generator.title')} />
            </div>
          ),
        },
      },
    },
  };

  // load page component
  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}
