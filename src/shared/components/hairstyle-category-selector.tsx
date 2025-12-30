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
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-8 w-8 rounded bg-muted flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      {previews.map((h) => (
        <img
          key={h.id}
          src={h.thumbnailUrl || undefined}
          alt={h.name}
          className="h-8 w-8 rounded object-cover flex-shrink-0 bg-background dark:bg-gray-300"
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
              'w-full flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-accent',
              isSelected && 'border-primary bg-accent/50'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <CategoryPreview hairstyles={categoryHairstyles} />
              <div className="text-left min-w-0">
                <p className="font-medium text-sm truncate">
                  {t(`categories.${cat.key}`)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cat.count} {t('categories.styles')}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
        <DialogContent className="max-w-2xl max-h-[85vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>
              {openCategory && t(`categories.${openCategory}`)}
              <span className="ml-2 text-muted-foreground font-normal">
                ({currentHairstyles.length})
              </span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {currentHairstyles.map((hairstyle) => (
                  <button
                    key={hairstyle.id}
                    className={cn(
                      'group relative aspect-square overflow-hidden rounded-lg border transition-all hover:border-primary hover:ring-2 hover:ring-primary/20',
                      selectedHairstyle?.id === hairstyle.id &&
                        'border-primary ring-2 ring-primary/20'
                    )}
                    onClick={() => handleSelect(hairstyle)}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '80px' }}
                  >
                    <img
                      src={hairstyle.thumbnailUrl || undefined}
                      alt={hairstyle.name}
                      className="h-full w-full object-contain bg-background dark:bg-gray-200"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="text-[9px] font-medium text-white leading-tight truncate">
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
