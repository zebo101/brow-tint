'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function FeaturesAccordion({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const defaultItem = (section as any)?.default_item || 'item-1';
  const [activeItem, setActiveItem] = useState<string>(defaultItem);

  const images: any = {};
  section.items?.forEach((item, idx) => {
    images[`item-${idx + 1}`] = {
      image: item.image?.src ?? '',
      alt: item.image?.alt || item.title || '',
      width: item.image?.width || 1200,
      height: item.image?.height || 800,
    };
  });
  const activeImage = images[activeItem]?.image;
  const activeAlt = images[activeItem]?.alt ?? '';
  const activeWidth = images[activeItem]?.width ?? 1200;
  const activeHeight = images[activeItem]?.height ?? 800;
  const isVideo = typeof activeImage === 'string' && activeImage.endsWith('.mp4');

  return (
    // overflow-x-hidden to prevent horizontal scroll
    <section
      className={cn(
        'overflow-x-hidden py-16 md:py-24',
        section.className,
        className
      )}
    >
      {/* add overflow-x-hidden to container */}
      <div className="container space-y-8 overflow-x-hidden px-2 sm:px-6 md:space-y-16 lg:space-y-20 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
        <div className="mx-auto max-w-4xl text-center text-balance">
          <h2 className="text-foreground font-display mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
            {section.title}
          </h2>
          <p className="text-muted-foreground font-display mb-6 md:mb-12 lg:mb-16">
            {section.description}
          </p>
        </div>

        {/* grid: clamp min-w-0 and fix px padding/breakpoints */}
        <div className="grid min-w-0 gap-12 sm:px-6 md:grid-cols-2 lg:gap-20 lg:px-0">
          <Accordion
            type="single"
            value={activeItem}
            onValueChange={(value) => setActiveItem(value as string)}
            className="w-full"
          >
            {section.items?.map((item, idx) => (
              <AccordionItem value={`item-${idx + 1}`} key={idx}>
                <AccordionTrigger>
                  <div className="flex items-center gap-2 text-base">
                    {item.title}
                  </div>
                </AccordionTrigger>
                <AccordionContent>{item.description}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* min-w-0/flex-shrink to prevent overflow */}
          <div className="bg-background relative flex min-w-0 flex-shrink self-start overflow-hidden rounded-3xl border p-2">
            <div className="absolute inset-0 right-0 ml-auto w-15 border-l bg-[repeating-linear-gradient(-45deg,var(--color-border),var(--color-border)_1px,transparent_1px,transparent_8px)]"></div>
            <div className="bg-background relative w-full min-w-0 rounded-2xl">
              <div
                key={`${activeItem}-id`}
                className="relative w-full overflow-hidden rounded-2xl border shadow-md"
              >
                {activeImage ? (
                  isVideo ? (
                    <video
                      className="h-auto w-full object-contain object-center dark:mix-blend-normal"
                      src={activeImage}
                      autoPlay
                      controls
                      playsInline
                      muted
                      loop
                    />
                  ) : (
                    <Image
                      src={activeImage}
                      alt={activeAlt}
                      width={activeWidth}
                      height={activeHeight}
                      sizes="(max-width: 768px) 100vw, 600px"
                      className="h-auto w-full object-contain object-center dark:mix-blend-normal"
                    />
                  )
                ) : (
                  <div className="aspect-video w-full bg-muted" aria-hidden />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
