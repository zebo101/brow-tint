import { getTranslations } from 'next-intl/server';

import { defaultLocale } from '@/config/locale';
import { redirect } from '@/core/i18n/navigation';
import { SignIn } from '@/shared/blocks/sign/sign-in';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
} from '@/shared/lib/seo-paths';
import { getConfigs } from '@/shared/models/config';
import { getSignUser } from '@/shared/models/user';

function safeInternalPath(raw?: string) {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  return raw;
}

function stripLocalePrefix(path: string, locale: string) {
  if (!path?.startsWith('/')) return '/';
  if (locale === defaultLocale) return path;
  if (path === `/${locale}`) return '/';
  if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1) || '/';
  return path;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const t = await getTranslations('common');

  return {
    title: `${t('sign.sign_in_title')} - ${t('metadata.title')}`,
    alternates: {
      canonical: buildCanonicalUrl('/sign-in', locale),
      languages: buildLanguageAlternates('/sign-in'),
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SignInPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    email?: string;
    verified?: string;
  }>;
  params: Promise<{ locale: string }>;
}) {
  const { callbackUrl, email } = await searchParams;
  const { locale } = await params;

  // If user is already signed in, don't show sign-in form again.
  const sessionUser = await getSignUser();
  if (sessionUser) {
    const target = stripLocalePrefix(safeInternalPath(callbackUrl), locale);
    redirect({ href: target || '/', locale });
  }

  const configs = await getConfigs();

  return (
    <SignIn
      configs={configs}
      callbackUrl={callbackUrl || '/'}
      defaultEmail={email || ''}
    />
  );
}
