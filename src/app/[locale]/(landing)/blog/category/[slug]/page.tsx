import { permanentRedirect } from 'next/navigation';

import { defaultLocale } from '@/config/locale';

// The public guide library is curated from translated MDX; legacy CMS categories
// must not expose retired articles or replace translated guides with database text.
export default async function CategoryBlogPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale } = await params;
  permanentRedirect(`${locale === defaultLocale ? '' : `/${locale}`}/blog`);
}
