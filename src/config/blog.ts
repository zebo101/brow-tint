import { z } from 'zod';

/** Extend Fumadocs' schema without changing its existing fields or defaults. */
export const blogFrontmatterFields = {
  faq: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
      })
    )
    .optional(),
  faq_title: z.string().optional(),
  updated_at: z
    .union([z.string(), z.date()])
    .pipe(z.coerce.date())
    .transform((date) => date.toISOString())
    .optional(),
  image_alt: z.string().optional(),
};

/** Editorial fallbacks; localized posts can override these through frontmatter/MDX. */
export const blogDefaults = {
  faqTitle: 'Frequently Asked Questions',
  primaryHref: '/filter',
  primaryLabel: 'Try the free eyebrow filter',
  secondaryHref: '/eyebrow-shape-for-face-shape',
  secondaryLabel: 'Find your face-shape brow match',
} as const;
