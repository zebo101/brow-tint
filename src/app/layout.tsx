import '@/config/style/global.css';

import localFont from 'next/font/local';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import NextTopLoader from 'nextjs-toploader';

import { envConfigs } from '@/config';
import { DeferUntilIdle } from '@/shared/blocks/common/defer-until-idle';
import { UtmCapture } from '@/shared/blocks/common/utm-capture';
import { JsonLd } from '@/shared/components/json-ld';
import { getSiteUrl } from '@/shared/lib/seo-paths';
import { getAllConfigs } from '@/shared/models/config';
import { getAdsService } from '@/shared/services/ads';
import { getAffiliateService } from '@/shared/services/affiliate';
import { getAnalyticsService } from '@/shared/services/analytics';
import { getCustomerService } from '@/shared/services/customer_service';

// Self-hosted fonts. Drop the .woff2 files into public/fonts/<family>/ before
// running pnpm dev/build. See docs at the bottom of this file for the exact
// filenames and where to download them. Switching off next/font/google means
// builds work behind the GFW and don't depend on fonts.gstatic.com being
// reachable from the build machine.
// Font slimming for Lighthouse: only Noto Sans Mono (body, --font-sans) and
// Amita (display H1, --font-display) are referenced anywhere in the rendered
// tree. Merriweather (--font-serif) and JetBrains Mono (--font-mono) had
// `preload: true` and were being shipped on every page despite zero CSS
// usage. They've been removed — re-add via localFont() if a future block
// actually needs `font-serif` / `font-mono`.
const notoSansMono = localFont({
  src: [
    {
      path: '../../public/fonts/noto-sans-mono/NotoSansMono-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/noto-sans-mono/NotoSansMono-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
  // Body font; preload so first paint doesn't flash fallback.
  preload: true,
});

const amita = localFont({
  src: [
    {
      path: '../../public/fonts/amita/Amita-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/amita/Amita-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-display',
  display: 'swap',
  // Drives the LCP <h1 class="font-display"> on the landing hero — preload is
  // load-bearing for LCP timing.
  preload: true,
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  setRequestLocale(locale);

  // site-level structured data (Organization + WebApplication). Locale-aware
  // description so each language's pages advertise the right copy.
  const tMeta = await getTranslations('common.metadata');
  const siteUrl = getSiteUrl();
  const siteName = envConfigs.app_name || 'Brow Tint';
  const siteDescription = tMeta.has('description') ? tMeta('description') : '';

  const siteSchemas: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: siteName,
      url: siteUrl,
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web',
      description: siteDescription,
    },
  ];

  const isProduction = process.env.NODE_ENV === 'production';
  const isDebug = process.env.NEXT_PUBLIC_DEBUG === 'true';

  // ads components
  let adsMetaTags = null;
  let adsHeadScripts = null;
  let adsBodyScripts = null;

  // analytics components
  let analyticsMetaTags = null;
  let analyticsHeadScripts = null;
  let analyticsBodyScripts = null;

  // affiliate components
  let affiliateMetaTags = null;
  let affiliateHeadScripts = null;
  let affiliateBodyScripts = null;

  // customer service components
  let customerServiceMetaTags = null;
  let customerServiceHeadScripts = null;
  let customerServiceBodyScripts = null;

  if (isProduction || isDebug) {
    const configs = await getAllConfigs();

    const [adsService, analyticsService, affiliateService, customerService] =
      await Promise.all([
        getAdsService(configs),
        getAnalyticsService(configs),
        getAffiliateService(configs),
        getCustomerService(configs),
      ]);

    // get ads components
    adsMetaTags = adsService.getMetaTags();
    adsHeadScripts = adsService.getHeadScripts();
    adsBodyScripts = adsService.getBodyScripts();

    // get analytics components
    analyticsMetaTags = analyticsService.getMetaTags();
    analyticsHeadScripts = analyticsService.getHeadScripts();
    analyticsBodyScripts = analyticsService.getBodyScripts();

    // get affiliate components
    affiliateMetaTags = affiliateService.getMetaTags();
    affiliateHeadScripts = affiliateService.getHeadScripts();
    affiliateBodyScripts = affiliateService.getBodyScripts();

    // get customer service components
    customerServiceMetaTags = customerService.getMetaTags();
    customerServiceHeadScripts = customerService.getHeadScripts();
    customerServiceBodyScripts = customerService.getBodyScripts();
  }

  return (
    <html
      lang={locale}
      className={`${notoSansMono.variable} ${amita.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href={envConfigs.app_favicon} />
        <link rel="alternate icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/* inject ads meta tags */}
        {adsMetaTags}
        {/* inject ads head scripts */}
        {adsHeadScripts}

        {/* inject analytics meta tags */}
        {analyticsMetaTags}
        {/* inject analytics head scripts */}
        {analyticsHeadScripts}

        {/* inject affiliate meta tags */}
        {affiliateMetaTags}
        {/* inject affiliate head scripts */}
        {affiliateHeadScripts}

        {/* inject customer service meta tags */}
        {customerServiceMetaTags}
        {/* inject customer service head scripts */}
        {customerServiceHeadScripts}

        {/* site-level JSON-LD: Organization + WebApplication */}
        <JsonLd id="site-schema" schema={siteSchemas} />
      </head>
      <body suppressHydrationWarning className="overflow-x-hidden">
        {/* Codex perf review (2026-05-02): NextTopLoader + UtmCapture were
            mounting on hydration and adding ~50-100 ms of mobile TBT for
            something that doesn't need to run before paint. DeferUntilIdle
            waits for `requestIdleCallback` (or a 1.5 s timeout) before
            mounting them. The page-nav progress bar still appears on
            navigation; UTM cookie still gets set within the same session. */}
        <DeferUntilIdle>
          <NextTopLoader
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={true}
            easing="ease"
            speed={200}
          />
          <UtmCapture />
        </DeferUntilIdle>

        {children}

        {/* inject ads body scripts */}
        {adsBodyScripts}

        {/* inject analytics body scripts */}
        {analyticsBodyScripts}

        {/* inject affiliate body scripts */}
        {affiliateBodyScripts}

        {/* inject customer service body scripts */}
        {customerServiceBodyScripts}
      </body>
    </html>
  );
}
