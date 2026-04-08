import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { AIMediaType, AITaskStatus } from '@/extensions/ai';
import { ImageGenerator } from '@/shared/blocks/generator';
import { getMetadata } from '@/shared/lib/seo';
import { getAITasks } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

const HISTORY_TASK_LIMIT = 20;
const HISTORY_IMAGE_LIMIT = 24;

type HistoryImage = {
  id: string;
  taskId: string;
  url: string;
  provider?: string;
  model?: string;
  prompt?: string;
  createdAt?: string;
};

function parseJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse AI task payload:', error);
    return null;
  }
}

function extractImageUrls(result: any): string[] {
  if (!result) {
    return [];
  }

  const output = result.output ?? result.images ?? result.data;

  if (!output) {
    return [];
  }

  if (typeof output === 'string') {
    return [output];
  }

  if (Array.isArray(output)) {
    return output
      .flatMap((item) => {
        if (!item) return [];
        if (typeof item === 'string') return [item];
        if (typeof item === 'object') {
          const candidate =
            item.url ?? item.uri ?? item.image ?? item.src ?? item.imageUrl;
          return typeof candidate === 'string' ? [candidate] : [];
        }
        return [];
      })
      .filter(Boolean);
  }

  if (typeof output === 'object') {
    const candidate =
      output.url ?? output.uri ?? output.image ?? output.src ?? output.imageUrl;
    if (typeof candidate === 'string') {
      return [candidate];
    }
  }

  return [];
}

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
  const user = await getUserInfo();

  const historyImages: HistoryImage[] = user
    ? (
        await getAITasks({
          userId: user.id,
          mediaType: AIMediaType.IMAGE,
          limit: HISTORY_TASK_LIMIT,
        })
      )
        .filter((task) => task.status === AITaskStatus.SUCCESS)
        .flatMap((task) => {
          const taskInfo = parseJson(task.taskInfo);
          const taskResult = parseJson(task.taskResult);
          const imageUrls = extractImageUrls(taskInfo);
          const urls = imageUrls.length > 0 ? imageUrls : extractImageUrls(taskResult);

          return urls.map((url, index) => ({
            id: `${task.id}-${index}`,
            taskId: task.id,
            url,
            prompt: task.prompt,
            provider: task.provider,
            model: task.model,
            createdAt: task.createdAt?.toISOString?.() ?? undefined,
          }));
        })
        .slice(0, HISTORY_IMAGE_LIMIT)
    : [];

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
          customContent: (
            <ImageGenerator
              srOnlyTitle={t.raw('generator.title')}
              historyImages={historyImages}
            />
          ),
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
