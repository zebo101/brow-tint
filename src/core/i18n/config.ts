import { defineRouting } from 'next-intl/routing';

import {
  defaultLocale,
  localeDetection,
  localePrefix,
  locales,
} from '@/config/locale';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix,
  localeDetection,
  // Page metadata emits content-aware hreflang; middleware must not advertise missing translations.
  alternateLinks: false,
  localeCookie: false,
});
