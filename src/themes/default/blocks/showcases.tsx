'use client';

import { useMemo, useState, type SVGProps } from 'react';
import Image from 'next/image';

import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

function WandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m15 4 5 5" />
      <path d="m18 2 4 4" />
      <path d="m2 22 6-6" />
      <path d="m12 12 4-4" />
      <path d="m8 16 4-4" />
    </svg>
  );
}

export function Showcases({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const groups = (section as any).groups || [];
  const [selectedGroup, setSelectedGroup] = useState<string>(
    groups.length > 0 ? groups[0].name : ''
  );

  const filteredItems = useMemo(() => {
    if (!section.items) return [];
    if (!selectedGroup || !groups.length) return section.items;
    if (selectedGroup === 'all') return section.items;
    return section.items.filter((item) => item.group === selectedGroup);
  }, [section.items, selectedGroup, groups.length]);

  return (
    <section
      id={section.id || section.name}
      className={cn('py-24 md:py-36', section.className, className)}
    >
      <div className="container mb-12 text-center">
        {section.sr_only_title && (
          <h1 className="sr-only">{section.sr_only_title}</h1>
        )}
        <h2 className="mx-auto mb-6 max-w-full text-3xl font-bold text-pretty md:max-w-5xl lg:text-4xl">
          {section.title}
        </h2>
        <p className="text-muted-foreground text-md mx-auto mb-4 max-w-full md:max-w-5xl">
          {section.description}
        </p>
      </div>

      {groups.length > 0 && (
        <div className="container mb-12 flex flex-wrap justify-center gap-4">
          {groups.map(
            (group: { name: string; title: string }, index: number) => {
              const isSelected = selectedGroup === group.name;
              return (
                <button
                  key={group.name}
                  onClick={() => setSelectedGroup(group.name)}
                  className={cn(
                    'relative rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                    isSelected
                      ? ''
                      : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground border'
                  )}
                >
                  {isSelected ? (
                    <>
                      <span className="bg-primary absolute inset-0 rounded-lg p-[2px]">
                        <span className="bg-background block h-full w-full rounded-[calc(0.5rem-2px)]" />
                      </span>
                      <span className="bg-primary relative z-10 bg-clip-text text-transparent">
                        {group.title}
                      </span>
                    </>
                  ) : (
                    <span>{group.title}</span>
                  )}
                </button>
              );
            }
          )}
        </div>
      )}

      <div className="container grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {filteredItems.length > 0 ? (
          filteredItems.map((item, index) => {
            const imageSrc = item.image?.src;
            const imageAlt = item.image?.alt ?? item.title ?? '';
            return (
              <div
                key={index}
                className="group relative cursor-pointer overflow-hidden rounded-xl"
              >
                <div className="relative aspect-square w-full overflow-hidden">
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={imageAlt}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      fill
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    />
                  ) : (
                    <div className="bg-muted h-full w-full" aria-hidden="true" />
                  )}
                </div>

                <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 transition-all duration-300 ease-out group-hover:pointer-events-auto group-hover:opacity-100">
                  <div className="translate-y-4 p-4 transition-transform duration-300 ease-out group-hover:translate-y-0">
                    <h3 className="mb-1 text-lg font-bold text-white drop-shadow-lg">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="mb-3 line-clamp-2 text-sm text-white/85 drop-shadow-md">
                        {item.description}
                      </p>
                    )}
                    <Button
                      asChild
                      size="sm"
                      className="bg-primary hover:bg-primary/90 h-9 w-full border-0 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02]"
                    >
                      <Link href="/ai-hairstyle-changer">
                        <WandIcon className="mr-1.5 size-4" />
                        Try This Style
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-muted-foreground col-span-full text-center">
            No items found in this category.
          </div>
        )}
      </div>
    </section>
  );
}
