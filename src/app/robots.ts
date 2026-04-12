import { MetadataRoute } from 'next';

import { locales } from '@/config/locale';
import { getSiteUrl } from '@/shared/lib/seo-paths';

const blockedRoots = [
  '/activity',
  '/admin',
  '/api',
  '/chat',
  '/no-permission',
  '/settings',
  '/sign-in',
  '/sign-up',
  '/verify-email',
];

function buildDisallowRules() {
  return blockedRoots.flatMap((root) => [
    root,
    `${root}/*`,
    ...locales.flatMap((locale) => [`/${locale}${root}`, `/${locale}${root}/*`]),
  ]);
}

export default function robots(): MetadataRoute.Robots {
  const appUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/*?*q=',
        '/*?*utm_*',
        '/*?*fbclid=*',
        '/*?*gclid=*',
        ...buildDisallowRules(),
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
