import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { Empty } from '@/shared/blocks/common';
import { defaultLocale } from '@/config/locale';
import { postsSource } from '@/core/docs/source';
import { buildAlternates } from '@/shared/lib/seo-metadata';
import { getPost } from '@/shared/models/post';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations('pages.blog.metadata');
  const canonicalPath = `/blog/${slug}`;
  const availableLocales = ['en', 'zh'].filter((entryLocale) =>
    Boolean(postsSource.getPage([slug], entryLocale))
  );

  const post = await getPost({ slug, locale });
  if (!post) {
    return {
      title: `${slug} | ${t('title')}`,
      description: t('description'),
      alternates: buildAlternates(canonicalPath, {
        locale,
        availableLocales:
          availableLocales.length > 0 ? availableLocales : [defaultLocale],
      }),
    };
  }

  return {
    title: `${post.title} | ${t('title')}`,
    description: post.description,
    alternates: buildAlternates(canonicalPath, {
      locale,
      availableLocales:
        availableLocales.length > 0 ? availableLocales : [defaultLocale],
    }),
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = await getPost({ slug, locale });

  if (!post) {
    return <Empty message={`Post not found`} />;
  }

  // build page sections
  const page: DynamicPage = {
    sections: {
      blogDetail: {
        block: 'blog-detail',
        data: {
          post,
        },
      },
    },
  };

  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}
