'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
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

interface HairstyleDropdownProps {
  hairstyles: Record<string, Hairstyle[]>;
  categories: { key: string; count: number }[];
  isLoading?: boolean;
  selectedHairstyle: Hairstyle | null;
  onSelect: (hairstyle: Hairstyle) => void;
  className?: string;
}

const ITEMS_PER_PAGE = 20;

export function HairstyleDropdown({
  hairstyles,
  categories,
  isLoading = false,
  selectedHairstyle,
  onSelect,
  className,
}: HairstyleDropdownProps) {
  const t = useTranslations('ai.image.generator');
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(
    categories[0]?.key || 'men'
  );
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Get hairstyles for current category
  const currentHairstyles = useMemo(() => {
    return hairstyles[activeCategory] || [];
  }, [hairstyles, activeCategory]);

  // Get visible hairstyles
  const visibleHairstyles = useMemo(() => {
    return currentHairstyles.slice(0, visibleCount);
  }, [currentHairstyles, visibleCount]);

  const hasMore = visibleCount < currentHairstyles.length;

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  const handleSelect = (hairstyle: Hairstyle) => {
    onSelect(hairstyle);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={cn(
            'w-full justify-between h-auto py-2 px-3',
            className
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            {selectedHairstyle ? (
              <>
                <img
                  src={selectedHairstyle.thumbnailUrl}
                  alt={selectedHairstyle.name}
                  className="h-10 w-10 rounded-md object-cover flex-shrink-0"
                />
                <span className="truncate text-sm font-medium">
                  {selectedHairstyle.name}
                </span>
              </>
            ) : (
              <>
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-muted-foreground text-xs">?</span>
                </div>
                <span className="text-muted-foreground text-sm">
                  {t('selectHairstyle') || 'Select a hairstyle'}
                </span>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0"
        align="start"
        sideOffset={8}
      >
        {/* Category Tabs */}
        <div className="border-b p-2">
          <Tabs
            value={activeCategory}
            onValueChange={handleCategoryChange}
          >
            <TabsList className="w-full grid grid-cols-4">
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat.key}
                  value={cat.key}
                  className="text-xs"
                >
                  {t(`categories.${cat.key}`) || cat.key}
                  <span className="ml-1 text-muted-foreground">
                    ({cat.count})
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Hairstyles Grid */}
        <ScrollArea className="h-[320px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-2">
              <div className="grid grid-cols-4 gap-2">
                {visibleHairstyles.map((hairstyle) => (
                  <button
                    key={hairstyle.id}
                    className={cn(
                      'group relative aspect-square overflow-hidden rounded-lg border transition-all hover:border-primary hover:ring-2 hover:ring-primary/20',
                      selectedHairstyle?.id === hairstyle.id &&
                        'border-primary ring-2 ring-primary/20'
                    )}
                    onClick={() => handleSelect(hairstyle)}
                  >
                    <img
                      src={hairstyle.thumbnailUrl}
                      alt={hairstyle.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="text-[9px] font-medium text-white leading-tight truncate">
                        {hairstyle.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="mt-3 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    className="text-xs"
                  >
                    {t('loadMore') || 'Load more'} (
                    {currentHairstyles.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
