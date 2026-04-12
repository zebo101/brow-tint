import { getTranslations } from 'next-intl/server';

import { redirect } from '@/core/i18n/navigation';
import { VerifyEmailPage } from '@/shared/blocks/sign/verify-email';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
} from '@/shared/lib/seo-paths';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('common');

  return {
    title: `${t('sign.verify_email_page_title')} - ${t('metadata.title')}`,
    alternates: {
      canonical: buildCanonicalUrl('/verify-email', locale),
      languages: buildLanguageAlternates('/verify-email'),
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function VerifyEmailRoute({
  searchParams,
  params,
}: {
  searchParams: Promise<{
    email?: string;
    callbackUrl?: string;
    sent?: string;
  }>;
  params: Promise<{ locale: string }>;
}) {
  const { email, callbackUrl, sent } = await searchParams;
  const { locale } = await params;
  // If user lands here without required context (e.g. direct navigation),
  // send them to sign-in instead of showing an incomplete verify page.
  if (!email && !callbackUrl) {
    redirect({ href: '/sign-in', locale });
  }
  return (
    <VerifyEmailPage email={email} callbackUrl={callbackUrl} sent={sent} />
  );
}
