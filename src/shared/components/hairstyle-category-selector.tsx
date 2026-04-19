'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { cn } from '@/shared/lib/utils';

interface Hairstyle {
  id: string;
  category: string;
  sequence: number;
  name: string;
  tags: string[];
  imageUrl: string;
  thumbnailUrl: string;
}

interface HairstyleCategorySelectorProps {
  hairstyles: Record<string, Hairstyle[]>;
  categories: { key: string; count: number }[];
  isLoading?: boolean;
  selectedHairstyle: Hairstyle | null;
  onSelect: (hairstyle: Hairstyle) => void;
  className?: string;
}

// Preview images for each category (first few from the category)
function CategoryPreview({ hairstyles }: { hairstyles: Hairstyle[] }) {
  const previews = hairstyles.slice(0, 3);
  
  if (previews.length === 0) {
    return (
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 w-9 rounded-lg border border-border/60 bg-muted/70 shadow-sm flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {previews.map((h) => (
        <img
          key={h.id}
          src={h.thumbnailUrl || undefined}
          alt={h.name}
          className="h-9 w-9 rounded-lg border border-border/60 object-cover shadow-sm flex-shrink-0 bg-background dark:bg-gradient-to-b dark:from-neutral-50 dark:to-stone-100"
        />
      ))}
    </div>
  );
}

export function HairstyleCategorySelector({
  hairstyles,
  categories,
  isLoading = false,
  selectedHairstyle,
  onSelect,
  className,
}: HairstyleCategorySelectorProps) {
  const t = useTranslations('ai.image.generator');
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // Get hairstyles for open category
  const currentHairstyles = useMemo(() => {
    if (!openCategory) return [];
    return hairstyles[openCategory] || [];
  }, [hairstyles, openCategory]);

  // Disambiguate name collisions in the open category by appending #1, #2, …
  // only when a name appears more than once. Stable across re-renders because
  // `currentHairstyles` preserves sequence-sorted order from the API.
  const displayNames = useMemo(() => {
    const count = new Map<string, number>();
    for (const h of currentHairstyles) {
      count.set(h.name, (count.get(h.name) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    const map = new Map<string, string>();
    for (const h of currentHairstyles) {
      if ((count.get(h.name) ?? 0) > 1) {
        const idx = (seen.get(h.name) ?? 0) + 1;
        seen.set(h.name, idx);
        map.set(h.id, `${h.name} #${idx}`);
      } else {
        map.set(h.id, h.name);
      }
    }
    return map;
  }, [currentHairstyles]);

  // For the always-visible "Selected Hairstyle Preview" outside the dialog,
  // disambiguate against all hairstyles in the selected's category (not just
  // the currently-open one).
  const selectedDisplayName = useMemo(() => {
    if (!selectedHairstyle) return '';
    const siblings = hairstyles[selectedHairstyle.category] ?? [];
    const sameName = siblings.filter((h) => h.name === selectedHairstyle.name);
    if (sameName.length <= 1) return selectedHairstyle.name;
    const idx =
      sameName.findIndex((h) => h.id === selectedHairstyle.id) + 1;
    return `${selectedHairstyle.name} #${idx}`;
  }, [hairstyles, selectedHairstyle]);

  const handleOpenCategory = (category: string) => {
    setOpenCategory(category);
  };

  const handleSelect = (hairstyle: Hairstyle) => {
    onSelect(hairstyle);
    setOpenCategory(null);
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <img 
          src="/imgs/bg/landingbg1.gif" 
          alt="Loading..." 
          className="h-12 w-12 object-contain"
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Category Rows */}
      {categories.map((cat) => {
        const categoryHairstyles = hairstyles[cat.key] || [];
        const isSelected = selectedHairstyle?.category === cat.key;

        return (
          <button
            key={cat.key}
            onClick={() => handleOpenCategory(cat.key)}
            className={cn(
              'group w-full flex items-center justify-between rounded-xl border border-border/70 bg-background/80 px-3.5 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/50 hover:shadow-md',
              isSelected &&
                'border-primary/60 bg-primary/5 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.45)]'
            )}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <CategoryPreview hairstyles={categoryHairstyles} />
              <div className="text-left min-w-0">
                <p className="font-medium text-sm truncate text-foreground">
                  {t(`categories.${cat.key}`)}
                </p>
                <p className="text-xs text-muted-foreground/90">
                  {cat.count} {t('categories.styles')}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/80 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        );
      })}

      {/* Selected Hairstyle Preview */}
      {selectedHairstyle && (
        <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">{t('categories.selected')}:</p>
          <div className="flex items-center gap-3">
            <img
              src={selectedHairstyle.thumbnailUrl || undefined}
              alt={selectedHairstyle.name}
              className="h-14 w-14 rounded-lg object-cover bg-background dark:bg-gradient-to-b dark:from-neutral-50 dark:to-stone-100"
            />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {selectedDisplayName}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedHairstyle.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 bg-background rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hairstyle Selection Dialog */}
      <Dialog open={!!openCategory} onOpenChange={() => setOpenCategory(null)}>
        <DialogContent className="border-border/60 bg-background/95 max-h-[92vh] max-w-[calc(100%-1rem)] overflow-hidden border p-0 shadow-[0_32px_90px_-36px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:max-w-2xl md:max-w-5xl">
          <DialogHeader className="border-border/70 bg-background/95 sticky top-0 z-10 border-b px-4 py-3.5 backdrop-blur-sm sm:px-6 sm:py-4 md:px-8 md:py-5">
            <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg md:text-xl">
              {openCategory && t(`categories.${openCategory}`)}
              <span className="text-muted-foreground ml-2 text-sm font-normal sm:text-base">
                ({currentHairstyles.length})
              </span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[calc(92vh-76px)] max-h-[760px] sm:h-[calc(92vh-92px)]">
            <div className="px-3 pt-3 pb-5 sm:px-5 sm:pt-4 sm:pb-6 md:px-8 md:pt-5 md:pb-8">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 md:gap-3.5 lg:grid-cols-5 xl:grid-cols-6">
                {currentHairstyles.map((hairstyle) => (
                  <button
                    key={hairstyle.id}
                    className={cn(
                      'group border-border/50 bg-background/60 hover:border-primary/50 flex flex-col overflow-hidden rounded-xl border text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                      selectedHairstyle?.id === hairstyle.id &&
                        'border-primary/70 ring-primary/20 ring-2'
                    )}
                    onClick={() => handleSelect(hairstyle)}
                    style={{
                      contentVisibility: 'auto',
                      containIntrinsicSize: '120px',
                    }}
                  >
                    <div className="relative aspect-square w-full overflow-hidden dark:bg-gradient-to-b dark:from-neutral-50 dark:to-stone-100">
                      <img
                        src={hairstyle.thumbnailUrl || undefined}
                        alt={hairstyle.name}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    </div>
                    <div
                      className={cn(
                        'border-border/40 bg-background/80 border-t px-2 py-1.5',
                        selectedHairstyle?.id === hairstyle.id &&
                          'bg-primary/[0.06]'
                      )}
                    >
                      <p className="text-foreground truncate text-[11px] leading-tight font-medium sm:text-xs">
                        {displayNames.get(hairstyle.id) ?? hairstyle.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
