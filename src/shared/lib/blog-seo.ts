import { buildAlternates } from '@/shared/lib/seo-metadata';
import { getSiteUrl } from '@/shared/lib/seo-paths';

type BlogSeoInput = {
  slug: string;
  locale: string;
  title: string;
  description?: string;
  image?: string;
  author?: string;
  published?: string | Date;
  modified?: string | Date;
  availableLocales?: string[];
  siteUrl?: string;
};

function isoDate(value?: string | Date) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function buildBlogSeo(input: BlogSeoInput) {
  const siteUrl = getSiteUrl({ siteUrl: input.siteUrl });
  const alternates = buildAlternates(`/blog/${input.slug}`, {
    locale: input.locale,
    siteUrl,
    availableLocales: input.availableLocales,
  });
  const url = alternates.canonical;
  const title = `${input.title} | Browlens`;
  const image = new URL(input.image || '/logo.png', `${siteUrl}/`).href;
  const publishedTime = isoDate(input.published);
  const modifiedTime = isoDate(input.modified);
  const author = input.author
    ? {
        '@type': input.author === 'Browlens Team' ? 'Organization' : 'Person',
        name: input.author,
        ...(input.author === 'Browlens Team'
          ? { url: `${siteUrl}/about` }
          : {}),
      }
    : undefined;

  return {
    metadata: {
      title,
      description: input.description,
      alternates,
      openGraph: {
        type: 'article' as const,
        url,
        title,
        description: input.description,
        siteName: 'Browlens',
        locale: input.locale,
        images: [{ url: image, alt: input.title }],
        publishedTime,
        modifiedTime,
        ...(input.author ? { authors: [input.author] } : {}),
      },
      twitter: {
        card: 'summary_large_image' as const,
        title,
        description: input.description,
        images: [image],
      },
    },
    schema: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      headline: input.title,
      description: input.description,
      url,
      mainEntityOfPage: url,
      image,
      inLanguage: input.locale,
      datePublished: publishedTime,
      dateModified: modifiedTime,
      author,
      publisher: {
        '@type': 'Organization',
        name: 'Browlens',
        url: siteUrl,
        logo: { '@type': 'ImageObject', url: `${siteUrl}/logo.png` },
      },
    },
  };
}
