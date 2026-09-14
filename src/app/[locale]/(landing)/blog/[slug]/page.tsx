import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { postsSource } from '@/core/docs/source';
import { getThemePage } from '@/core/theme';
import { locales } from '@/config/locale';
import { JsonLd } from '@/shared/components/json-ld';
import { buildBlogSeo } from '@/shared/lib/blog-seo';
import { buildAlternates } from '@/shared/lib/seo-metadata';
import { getLocalPost } from '@/shared/models/post';
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
  const availableLocales = locales.filter((language) =>
    Boolean(postsSource.getPage([slug], language))
  );

  const post = await getLocalPost({ slug, locale });
  if (!post) {
    return {
      title: `${slug} | ${t('title')}`,
      description: t('description'),
      alternates: buildAlternates(canonicalPath, {
        locale,
        availableLocales: [],
        noIndex: true,
      }),
    };
  }

  return buildBlogSeo({
    slug,
    locale,
    title: post.title || '',
    description: post.description,
    image: post.image,
    author: post.author_name,
    published: post.published_at,
    availableLocales,
  }).metadata;
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = await getLocalPost({ slug, locale });

  if (!post) {
    notFound();
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

  const { schema } = buildBlogSeo({
    slug,
    locale,
    title: post.title || '',
    description: post.description,
    image: post.image,
    author: post.author_name,
    published: post.published_at,
  });

  return (
    <>
      <JsonLd id="article-schema" schema={schema} />
      <Page locale={locale} page={page} />
    </>
  );
}
