'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

import { cn } from '@/shared/lib/utils';
import { CarouselImage, Hero, Section } from '@/shared/types/blocks/landing';

export function HeroBrowserPreview({ section }: { section: Section }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Type-safe access to carousel_images from Hero interface
  const carouselImages = (section as Hero).carousel_images;
  const images =
    carouselImages && carouselImages.length > 0
      ? carouselImages
      : [
          {
            light: section.image?.src,
            dark: section.image_invert?.src,
            alt: section.image?.alt || section.image_invert?.alt || 'hero',
          },
        ];

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 3000);
  };

  const nextSlide = () => {
    goToSlide((currentSlide + 1) % images.length);
  };

  const prevSlide = () => {
    goToSlide((currentSlide - 1 + images.length) % images.length);
  };

  useEffect(() => {
    if (images.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [images.length, isPaused]);

  return (
    <div className="relative mt-12 px-4 sm:mt-20">
      <div className="relative mx-auto max-w-7xl">
        <div className="from-background/50 via-muted/30 to-background/50 dark:from-muted/10 dark:via-background/5 dark:to-muted/10 absolute inset-0 -z-10 rounded-[1.5rem] bg-gradient-to-br blur-3xl" />

        <div className="border-border/30 from-muted/40 via-background/60 to-muted/40 dark:border-border/40 dark:from-muted/5 dark:via-background/10 dark:to-muted/5 relative overflow-hidden rounded-[1.5rem] border bg-gradient-to-br p-6 shadow-2xl backdrop-blur-sm sm:p-8 dark:shadow-black/50">
          <div className="absolute inset-0 -z-0 overflow-hidden rounded-[1.5rem]">
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.15),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.12),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(20,184,166,0.12),transparent_45%)] opacity-70 dark:opacity-50" />
          </div>
          <div className="bg-background/95 dark:bg-background/80 relative overflow-hidden rounded-2xl shadow-2xl backdrop-blur-xl">
            <div className="border-border/50 bg-muted/50 dark:border-border/30 dark:bg-muted/20 flex items-center justify-between border-b px-4 py-3 backdrop-blur-sm sm:px-6">
              <div className="flex items-center gap-2">
                <div className="group size-3 rounded-full bg-red-500 shadow-sm transition-all hover:scale-110 dark:bg-red-500/80" />
                <div className="group size-3 rounded-full bg-yellow-500 shadow-sm transition-all hover:scale-110 dark:bg-yellow-500/80" />
                <div className="group size-3 rounded-full bg-green-500 shadow-sm transition-all hover:scale-110 dark:bg-green-500/80" />
              </div>

              <div className="bg-background/80 border-border/30 dark:border-border/20 dark:bg-background/40 hidden items-center gap-2 rounded-lg border px-4 py-1.5 sm:flex sm:min-w-[300px] md:min-w-[400px]">
                <svg
                  className="text-muted-foreground size-4"
                  fill="none"
                  strokeWidth="2"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v6m0 0 3-3m-3 3-3-3"
                  />
                </svg>
                <span className="text-muted-foreground flex-1 truncate text-xs transition-all duration-300 sm:text-sm">
                  {images[currentSlide]?.alt || 'your-app.site'}
                </span>
                <svg
                  className="size-4 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9Z" />
                </svg>
              </div>

              <div className="flex items-center gap-1">
                {images.length > 1 &&
                  images.map((_: CarouselImage, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={cn(
                        'h-0 rounded-full transition-all duration-300',
                        currentSlide === idx
                          ? 'bg-primary dark:bg-foreground/80 w-2'
                          : 'bg-muted-foreground/30 hover:bg-muted-foreground/50 dark:bg-muted-foreground/20 dark:hover:bg-muted-foreground/40 w-1.5'
                      )}
                      aria-label={`切换到第 ${idx + 1} 张图片`}
                    />
                  ))}
              </div>
            </div>

            <div className="group relative overflow-hidden">
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevSlide}
                    className="bg-background/80 hover:bg-background dark:bg-background/40 dark:hover:bg-background/60 absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full p-2 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:opacity-100 hover:scale-110 sm:left-6"
                    aria-label="上一张图片"
                  >
                    <svg
                      className="text-foreground size-6"
                      fill="none"
                      strokeWidth="2"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={nextSlide}
                    className="bg-background/80 hover:bg-background dark:bg-background/40 dark:hover:bg-background/60 absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full p-2 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:opacity-100 hover:scale-110 sm:right-6"
                    aria-label="下一张图片"
                  >
                    <svg
                      className="text-foreground size-6"
                      fill="none"
                      strokeWidth="2"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </>
              )}

              {images.map((image: CarouselImage, idx: number) => (
                <div
                  key={idx}
                  className={cn(
                    'transition-all duration-700 ease-in-out',
                    currentSlide === idx
                      ? 'relative opacity-100'
                      : 'absolute inset-0 opacity-0'
                  )}
                >
                  {image.dark && (
                    <Image
                      className="hidden w-full dark:block"
                      src={image.dark}
                      alt={image.alt}
                      width={
                        section.image_invert?.width ||
                        section.image?.width ||
                        1400
                      }
                      height={
                        section.image_invert?.height ||
                        section.image?.height ||
                        800
                      }
                      sizes="(max-width: 768px) 100vw, 1200px"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      priority={idx === 0}
                      fetchPriority={idx === 0 ? 'high' : 'low'}
                      quality={60}
                      unoptimized={image.dark.startsWith('http')}
                    />
                  )}

                  {image.light && (
                    <Image
                      className="block w-full dark:hidden"
                      src={image.light}
                      alt={image.alt}
                      width={
                        section.image?.width ||
                        section.image_invert?.width ||
                        1400
                      }
                      height={
                        section.image?.height ||
                        section.image_invert?.height ||
                        800
                      }
                      sizes="(max-width: 768px) 100vw, 1200px"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      priority={idx === 0}
                      fetchPriority={idx === 0 ? 'high' : 'low'}
                      quality={60}
                      unoptimized={image.light.startsWith('http')}
                    />
                  )}
                </div>
              ))}

              <div className="from-background/5 to-background/5 dark:from-background/10 dark:to-background/10 pointer-events-none absolute inset-0 bg-gradient-to-b via-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
