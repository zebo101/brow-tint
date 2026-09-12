import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from '@/core/i18n/config';
import { browlensRedirects } from '@/config/browlens-redirects';

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Keep legacy Chinese links, normalized to the supported locale code.
  if (pathname === '/zh-CN' || pathname.startsWith('/zh-CN/')) {
    const destination = request.nextUrl.clone();
    destination.pathname = pathname.replace(/^\/zh-CN/, '/zh');
    return NextResponse.redirect(destination, 308);
  }
  const prefix = pathname.split('/')[1];
  const hasLocale = routing.locales.includes(prefix);
  const locale = hasLocale ? prefix : routing.defaultLocale;
  const pathWithoutLocale = hasLocale
    ? pathname.slice(prefix.length + 1) || '/'
    : pathname;
  if (browlensRedirects[pathWithoutLocale]) {
    const destination = request.nextUrl.clone();
    destination.pathname = `${locale === routing.defaultLocale ? '' : `/${locale}`}${browlensRedirects[pathWithoutLocale]}`;
    return NextResponse.redirect(destination, 308);
  }
  const response = intlMiddleware(request);

  // Only check authentication for admin routes
  if (
    pathWithoutLocale.startsWith('/admin') ||
    pathWithoutLocale.startsWith('/settings') ||
    pathWithoutLocale.startsWith('/activity')
  ) {
    // Check if session cookie exists
    const sessionCookie = getSessionCookie(request);

    // If no session token found, redirect to sign-in
    if (!sessionCookie) {
      const signInUrl = new URL(
        locale === routing.defaultLocale ? '/sign-in' : `/${locale}/sign-in`,
        request.url
      );
      // Preserve the requested language as well as the query after signing in.
      const callbackPath = pathname + request.nextUrl.search;
      signInUrl.searchParams.set('callbackUrl', callbackPath);
      return NextResponse.redirect(signInUrl);
    }

    // For admin routes, we need to check RBAC permissions
    // Note: Full permission check happens in the page/API route level
    // This is a lightweight session check to prevent unauthorized access
    // The detailed permission check (admin.access and specific permissions)
    // will be done in the layout or individual pages using requirePermission()
  }

  response.headers.set('x-pathname', request.nextUrl.pathname);
  response.headers.set('x-url', request.url);

  // Remove Set-Cookie from public pages to allow caching
  // We exclude admin, settings, activity, and auth pages from this behavior
  if (
    !pathWithoutLocale.startsWith('/admin') &&
    !pathWithoutLocale.startsWith('/settings') &&
    !pathWithoutLocale.startsWith('/activity') &&
    !pathWithoutLocale.startsWith('/sign-') &&
    !pathWithoutLocale.startsWith('/auth')
  ) {
    response.headers.delete('Set-Cookie');

    // Cache-Control header for public pages
    const cacheControl = 'public, s-maxage=3600, stale-while-revalidate=14400';

    response.headers.set('Cache-Control', cacheControl);
    response.headers.set('CDN-Cache-Control', cacheControl);
    response.headers.set('Cloudflare-CDN-Cache-Control', cacheControl);
  }

  // Return the localized page response for all other public routes.
  return response;
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
