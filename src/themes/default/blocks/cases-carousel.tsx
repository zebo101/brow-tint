'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/shared/components/ui/carousel';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

const AUTOPLAY_INTERVAL_MS = 1500;

export function CasesCarousel({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const isMobile = useIsMobile();
  const items = section.items ?? [];
  const stoppedByUserRef = useRef(false);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  // Manual autoplay — embla-carousel-autoplay isn't a project dep, so we drive
  // the carousel via setInterval and stop on the first user pointer interaction.
  useEffect(() => {
    if (!api) return;
    const id = window.setInterval(() => {
      if (stoppedByUserRef.current) return;
      api.scrollNext();
    }, AUTOPLAY_INTERVAL_MS);

    const onPointerDown = () => {
      stoppedByUserRef.current = true;
    };
    api.on('pointerDown', onPointerDown);

    return () => {
      window.clearInterval(id);
      api.off('pointerDown', onPointerDown);
    };
  }, [api]);

  const getRotation = useCallback(
    (index: number) => {
      if (index === current)
        return 'md:-rotate-45 md:translate-x-40 md:scale-75 md:relative';
      if (index === current + 1) return 'md:rotate-0 md:z-10 md:relative';
      if (index === current + 2)
        return 'md:rotate-45 md:-translate-x-40 md:scale-75 md:relative';
      return '';
    },
    [current]
  );

  const scrollbarBars = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, item) => (
        <motion.div
          key={item}
          initial={{ opacity: 0.2, filter: 'blur(1px)' }}
          animate={{
            opacity: item % 5 === 0 ? 1 : 0.2,
            filter: 'blur(0px)',
          }}
          transition={{
            duration: 0.2,
            delay: item % 5 === 0 ? (item / 5) * 0.05 : 0,
            ease: 'easeOut',
          }}
          className={cn(
            'bg-foreground w-[1px]',
            item % 5 === 0 ? 'h-[15px]' : 'h-[10px]'
          )}
        />
      )),
    []
  );

  if (!items.length) return null;

  // On desktop the rotation trio (current, current+1, current+2) needs two
  // extra forward slots, so we render length + 2 items and wrap the index
  // back to the start of `items` for those tail slots.
  const carouselLength = isMobile ? items.length : items.length + 2;
  const currentItem = items[current % items.length];

  return (
    <section
      id={section.id || section.name}
      className={cn('bg-background py-32', section.className, className)}
    >
      <div className="container flex flex-col items-center justify-center gap-4 text-center">
        {section.title && (
          <h2 className="font-display text-foreground max-w-3xl text-5xl font-medium tracking-tighter text-pretty md:px-9 md:text-6xl">
            {section.title}
          </h2>
        )}
        {section.description && (
          <p className="text-muted-foreground/80 mt-5 max-w-xl">
            {section.description}
          </p>
        )}

        <Carousel
          className="w-full max-w-5xl"
          opts={{ loop: true }}
          setApi={setApi}
        >
          <CarouselContent>
            {Array.from({ length: carouselLength }).map((_, index) => {
              const item = items[index % items.length];
              if (!item) return null;
              const src: string = item.image?.src ?? '';
              const alt: string = item.image?.alt ?? item.name ?? '';
              return (
                <CarouselItem key={index} className="my-10 md:basis-1/3">
                  <div
                    className={cn(
                      'relative h-[420px] w-full transition-transform duration-500 ease-in-out',
                      getRotation(index)
                    )}
                  >
                    {src && (
                      <Image
                        src={src}
                        alt={alt}
                        fill
                        // basis-1/3 column on md+, full-width on mobile.
                        // Capped at 600 to cover retina without overshooting.
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <div className="absolute right-0 bottom-0 flex w-full translate-y-full flex-col items-center justify-center gap-2">
            <div className="flex gap-2">{scrollbarBars}</div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={current}
                className="w-full text-lg font-medium"
                initial={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(5px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, scale: 0.9, filter: 'blur(5px)' }}
                transition={{ duration: 0.5 }}
              >
                {currentItem?.name}
              </motion.p>
            </AnimatePresence>
            <div className="flex gap-2">{scrollbarBars}</div>
          </div>
        </Carousel>
      </div>
    </section>
  );
}
