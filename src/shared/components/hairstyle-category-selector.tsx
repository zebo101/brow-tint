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
          className="h-9 w-9 rounded-lg border border-border/60 object-cover shadow-sm flex-shrink-0 bg-background dark:bg-gray-300"
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
              className="h-14 w-14 rounded-lg object-cover bg-background dark:bg-gray-300"
            />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {selectedHairstyle.name}
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
        <DialogContent className="max-h-[92vh] max-w-[calc(100%-1rem)] overflow-hidden border border-border/60 bg-background/95 p-0 shadow-[0_32px_90px_-36px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:max-w-2xl md:max-w-5xl">
          <DialogHeader className="sticky top-0 z-10 border-b border-border/70 bg-background/95 px-6 py-5 backdrop-blur-sm md:px-8">
            <DialogTitle className="text-lg font-semibold tracking-tight md:text-xl">
              {openCategory && t(`categories.${openCategory}`)}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                ({currentHairstyles.length})
              </span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[calc(92vh-92px)] max-h-[760px]">
            <div className="px-5 pb-6 pt-4 md:px-8 md:pb-8 md:pt-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {currentHairstyles.map((hairstyle) => (
                  <button
                    key={hairstyle.id}
                    className={cn(
                      'group relative aspect-square overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-background to-muted/25 p-1.5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_18px_32px_-18px_rgba(0,0,0,0.45)]',
                      selectedHairstyle?.id === hairstyle.id &&
                        'border-primary/70 bg-primary/[0.06] shadow-[0_18px_36px_-20px_rgba(0,0,0,0.5)] ring-2 ring-primary/15'
                    )}
                    onClick={() => handleSelect(hairstyle)}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '80px' }}
                  >
                    <div className="relative h-full w-full overflow-hidden rounded-[14px] bg-white dark:bg-gray-200">
                      <img
                        src={hairstyle.thumbnailUrl || undefined}
                        alt={hairstyle.name}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute inset-x-1.5 bottom-1.5 rounded-xl bg-gradient-to-t from-black/80 via-black/35 to-transparent px-2 py-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <p className="text-[10px] font-medium text-white leading-tight truncate">
                        {hairstyle.name}
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
