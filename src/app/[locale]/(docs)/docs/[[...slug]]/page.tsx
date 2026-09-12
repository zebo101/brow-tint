import { notFound, redirect } from 'next/navigation';
import { getMDXComponents } from '@/mdx-components';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';

import { i18n, source } from '@/core/docs/source';
import { buildAlternates } from '@/shared/lib/seo-metadata';

export const revalidate = 86400;
// Keep request locale headers available to the shared root layout. Forcing
// static rendering here makes <html lang> fall back to English for every locale.
export const dynamicParams = true;

export default async function DocsContentPage(props: {
  params: Promise<{ slug?: string[]; locale?: string }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug, params.locale);

  if (!page) {
    const fallback = source.getPage(params.slug, i18n.defaultLanguage);
    if (fallback) redirect(fallback.url);
    notFound();
  }

  const MDXContent = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{
        style: 'clerk',
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page) as any,
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams('slug', 'locale');
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[]; locale?: string }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug, params.locale);
  if (!page) {
    const fallback = source.getPage(params.slug, i18n.defaultLanguage);
    if (fallback) redirect(fallback.url);
    notFound();
  }

  const canonicalPath = page.url;
  const availableLocales = i18n.languages.filter((locale) =>
    Boolean(source.getPage(params.slug, locale))
  );

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: buildAlternates(canonicalPath, {
      locale: params.locale,
      availableLocales,
    }),
  };
}
