import { redirect } from 'next/navigation';

import { defaultLocale } from '@/config/locale';

export default async function AiBrowTintChangerRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(
    locale === defaultLocale
      ? '/ai-brow-tint-generator'
      : `/${locale}/ai-brow-tint-generator`
  );
}
