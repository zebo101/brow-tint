'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

import { LazyImage } from '@/shared/blocks/common';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';

export interface StackedCardItem {
  id: string;
  src: string;
  alt?: string;
}

interface StackedHairstyleCardsProps {
  items: StackedCardItem[];
  spreadDistance?: number;
  rotationAngle?: number;
  animationDelay?: number;
  className?: string;
  aspectRatio?: string;
  dialogTitle?: string;
}

export function StackedHairstyleCards({
  items,
  spreadDistance = 72,
  rotationAngle = 10,
  animationDelay = 0.08,
  className,
  aspectRatio = 'aspect-[3/4]',
  dialogTitle,
}: StackedHairstyleCardsProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const cards = items.slice(0, 3);

  if (cards.length === 0) {
    return null;
  }

  const hoverMultiplier = isHovered ? 1.08 : 1;

  const buildLayout = (i: number) => {
    if (i === 0) {
      return {
        x: 0,
        y: isHovered ? -3 : 0,
        rotate: 0,
        scale: isHovered ? 1.01 : 1,
        zIndex: 30,
      };
    }
    const side = i === 1 ? -1 : 1;
    return {
      x: side * spreadDistance * hoverMultiplier,
      y: isHovered ? 4 : 6,
      rotate: side * rotationAngle * (isHovered ? 1.05 : 1),
      scale: isHovered ? 0.93 : 0.92,
      zIndex: i === 1 ? 20 : 10,
    };
  };

  return (
    <>
      <div
        className={cn(
          'group/stack relative mx-auto w-full max-w-[300px]',
          aspectRatio,
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {cards.map((item, i) => {
          const layout = buildLayout(i);
          const isFront = i === 0;

          return (
            <motion.button
              key={item.id}
              type="button"
              className="focus-visible:ring-primary absolute inset-0 cursor-pointer rounded-lg bg-transparent focus:outline-none focus-visible:ring-2"
              style={{
                zIndex: layout.zIndex,
                transformOrigin: 'center bottom',
                filter: isFront
                  ? 'drop-shadow(0 14px 22px rgba(0,0,0,0.45))'
                  : 'drop-shadow(0 10px 18px rgba(0,0,0,0.35))',
              }}
              initial={{ x: 0, y: 30, rotate: 0, scale: 0.9, opacity: 0 }}
              animate={{
                x: layout.x,
                y: layout.y,
                rotate: layout.rotate,
                scale: layout.scale,
                opacity: 1,
              }}
              transition={{
                type: 'spring',
                stiffness: 180,
                damping: 24,
                mass: 0.9,
                delay: i * animationDelay,
              }}
              whileTap={{ scale: isFront ? 0.98 : layout.scale - 0.02 }}
              onClick={() => setActiveIndex(i)}
              aria-label={item.alt || `Preview ${i + 1}`}
            >
              <LazyImage
                src={item.src}
                alt={item.alt || `hairstyle preview ${i + 1}`}
                className="h-full w-full object-contain object-bottom"
              />
            </motion.button>
          );
        })}
      </div>

      <Dialog
        open={activeIndex !== null}
        onOpenChange={(open) => !open && setActiveIndex(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
          {activeIndex !== null && cards[activeIndex] && (
            <>
              <DialogHeader className="border-b px-6 py-4">
                <DialogTitle>
                  {dialogTitle || cards[activeIndex].alt || 'Preview'}
                </DialogTitle>
              </DialogHeader>
              <div className="p-4 md:p-6">
                <div className="overflow-hidden rounded-xl border">
                  <LazyImage
                    src={cards[activeIndex].src}
                    alt={cards[activeIndex].alt || 'Preview'}
                    className="h-auto max-h-[70vh] w-full object-contain"
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
