'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Globe, Languages } from 'lucide-react';
import { useLocale } from 'next-intl';

import { usePathname, useRouter } from '@/core/i18n/navigation';
import { localeNames } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cacheSet } from '@/shared/lib/cache';

export function LocaleSelector({
  type = 'icon',
}: {
  type?: 'icon' | 'button';
}) {
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSwitchLanguage = (value: string) => {
    if (value !== currentLocale) {
      cacheSet('locale', value);
      const query = searchParams?.toString?.() ?? '';
      // An article may only exist in some languages. Offer the target language's
      // article list rather than navigating to a missing translation.
      const isArticle = /^\/blog\/[^/]+$/.test(pathname);
      const translated = document.querySelector(
        `link[rel="alternate"][hreflang="${value}"]`
      );
      const destination = isArticle && !translated ? '/blog' : pathname;
      const href = `${destination}${query ? `?${query}` : ''}${window.location.hash}`;
      router.push(href, {
        locale: value,
      });
    }
  };

  if (!mounted) {
    return (
      <Button
        variant={type === 'icon' ? 'ghost' : 'outline'}
        size={type === 'icon' ? 'icon' : 'sm'}
        className={
          type === 'icon' ? 'h-auto w-auto p-0' : 'hover:bg-primary/10'
        }
        disabled
        aria-label={`Language: ${localeNames[currentLocale]}`}
      >
        {type === 'icon' ? (
          <Languages size={18} />
        ) : (
          <>
            <Globe size={16} />
            {localeNames[currentLocale]}
          </>
        )}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {type === 'icon' ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Language: ${localeNames[currentLocale]}`}
            className="size-9"
          >
            <Languages size={18} />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Language: ${localeNames[currentLocale]}`}
            className="hover:bg-primary/10"
          >
            <Globe size={16} />
            {localeNames[currentLocale]}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {Object.keys(localeNames).map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleSwitchLanguage(locale)}
          >
            <span>{localeNames[locale]}</span>
            {locale === currentLocale && (
              <Check size={16} className="text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
