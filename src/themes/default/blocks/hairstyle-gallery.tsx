import { ArrowRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { LazyImage } from '@/shared/blocks/common';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { getHairstyles, type Hairstyle } from '@/shared/models/hairstyle';
import type { Section } from '@/shared/types/blocks/landing';

type HairstyleCategoryConfig = {
  key: string;
  title: string;
  description?: string;
  cta_label?: string;
};

interface HairstyleGallerySection extends Section {
  limit?: number;
  cta_url?: string;
  categories?: HairstyleCategoryConfig[];
}

async function loadCategory(key: string, limit: number): Promise<Hairstyle[]> {
  try {
    return await getHairstyles({ category: key, status: 'active', limit });
  } catch (error) {
    console.warn(`[hairstyle-gallery] failed to load "${key}":`, error);
    return [];
  }
}

/**
 * Disambiguate display names inside a single category. If two rows share the
 * same AI-generated `name`, append "#1", "#2", … in sequence-sort order so the
 * gallery never shows two identical labels (SEO-friendlier too: search engines
 * see distinct anchor text). When AI names are unique, suffixes disappear.
 */
function buildDisplayNames(items: Hairstyle[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const map = new Map<string, string>();
  for (const item of items) {
    if ((counts.get(item.name) ?? 0) > 1) {
      const idx = (seen.get(item.name) ?? 0) + 1;
      seen.set(item.name, idx);
      map.set(item.id, `${item.name} #${idx}`);
    } else {
      map.set(item.id, item.name);
    }
  }
  return map;
}

export async function HairstyleGallery({
  section,
  className,
}: {
  section: HairstyleGallerySection;
  className?: string;
}) {
  if (!section || section.disabled) {
    return null;
  }

  const limit = Math.max(1, Math.min(section.limit ?? 8, 24));
  const categories = section.categories ?? [];
  const ctaUrl = section.cta_url ?? '/ai-hairstyle-changer';

  const loaded = await Promise.all(
    categories.map(async (c) => ({
      config: c,
      items: await loadCategory(c.key, limit),
    }))
  );

  const hasAnyItems = loaded.some((group) => group.items.length > 0);
  if (!hasAnyItems) {
    return null;
  }

  return (
    <section
      id={section.id || 'hairstyle-gallery'}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className="container">
        {(section.title || section.description) && (
          <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
            {section.title && (
              <h2 className="text-3xl font-bold tracking-tight text-pretty md:text-4xl">
                {section.title}
              </h2>
            )}
            {section.description && (
              <p className="text-muted-foreground mt-4 text-base md:text-lg">
                {section.description}
              </p>
            )}
          </div>
        )}

        <div className="space-y-16 md:space-y-20">
          {loaded.map(({ config, items }) => {
            if (items.length === 0) return null;
            const displayNames = buildDisplayNames(items);
            return (
              <div
                key={config.key}
                id={`hairstyles-${config.key}`}
                className="scroll-mt-24"
              >
                <div className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
                  <div className="max-w-2xl">
                    <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
                      {config.title}
                    </h3>
                    {config.description && (
                      <p className="text-muted-foreground mt-2 text-sm md:text-base">
                        {config.description}
                      </p>
                    )}
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="group/cta self-start md:self-auto"
                  >
                    <Link href={ctaUrl}>
                      <span>{config.cta_label || 'Try now'}</span>
                      <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                    </Link>
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 md:gap-4">
                  {items.map((item) => {
                    const label = displayNames.get(item.id) ?? item.name;
                    return (
                      <Link
                        key={item.id}
                        href={ctaUrl}
                        className="group border-border/60 bg-card/40 hover:border-primary/50 block overflow-hidden rounded-xl border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="relative aspect-square w-full overflow-hidden dark:bg-gradient-to-b dark:from-neutral-50 dark:to-stone-100">
                          <LazyImage
                            src={item.imageUrl || item.thumbnailUrl}
                            placeholderSrc={item.thumbnailUrl || undefined}
                            alt={`${config.title} - ${label}`}
                            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        </div>
                        <div className="border-border/40 bg-background/60 border-t px-2.5 py-2">
                          <p className="text-foreground truncate text-xs font-medium sm:text-sm">
                            {label}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {section.tip && (
          <p className="text-muted-foreground mt-12 text-center text-sm md:mt-16">
            {section.tip}
          </p>
        )}
      </div>
    </section>
  );
}
