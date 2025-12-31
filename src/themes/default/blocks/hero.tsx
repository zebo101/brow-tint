'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common';
import { Button } from '@/shared/components/ui/button';
import { RainbowButton } from '@/shared/components/ui/rainbow-button';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

import { SocialAvatars } from './social-avatars';

// 图片类型定义
interface CarouselImage {
  light?: string;
  dark?: string;
  alt: string;
}

export function Hero({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const highlightText = section.highlight_text ?? '';
  let texts = null;
  if (highlightText) {
    texts = section.title?.split(highlightText, 2);
  }

  return (
    <section
      id={section.id}
      className={cn(
        `pt-24 pb-8 md:pt-36 md:pb-8`,
        section.className,
        className
      )}
    >
      {section.announcement && (
        <Link
          href={section.announcement.url || ''}
          target={section.announcement.target || '_self'}
          className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto mb-8 flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-zinc-950/5 transition-colors duration-300 dark:border-t-white/5 dark:shadow-zinc-950"
        >
          <span className="text-foreground text-sm">
            {section.announcement.title}
          </span>
          <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700"></span>

          <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
            <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
              <span className="flex size-6">
                <ArrowRight className="m-auto size-3" />
              </span>
              <span className="flex size-6">
                <ArrowRight className="m-auto size-3" />
              </span>
            </div>
          </div>
        </Link>
      )}

      <div className="relative mx-auto max-w-full px-4 text-center md:max-w-5xl">
        {texts && texts.length > 0 ? (
          <h1 className="hero-gradient py-2 text-center font-['Satoshi'] text-4xl leading-[1.1] font-bold tracking-[-0.05em] sm:mt-12 md:text-[78.05px] md:leading-[1.1]">
            {texts[0]}
            <span className="hero-gradient">{highlightText}</span>
            {texts[1]}
          </h1>
        ) : (
          <h1 className="hero-gradient py-2 text-center font-['Satoshi'] text-4xl leading-[1.1] font-bold tracking-[-0.05em] sm:mt-12 md:text-[78.05px] md:leading-[1.1]">
            {section.title}
          </h1>
        )}

        <p
          className="hero-gradient mt-8 mb-8 text-lg tracking-tight text-balance"
          dangerouslySetInnerHTML={{ __html: section.description ?? '' }}
        />

        {section.buttons && (
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {section.buttons.map((button, idx) => {
              // 第一个按钮使用RainbowButton（不显示图标，保持简洁）
              if (idx === 0) {
                return (
                  <RainbowButton asChild key={idx}>
                    <Link
                      href={button.url ?? ''}
                      target={button.target ?? '_self'}
                    >
                      <span className="whitespace-nowrap">{button.title}</span>
                    </Link>
                  </RainbowButton>
                );
              }
              // 其他按钮使用普通Button
              return (
                <Button
                  asChild
                  size={button.size || 'lg'}
                  variant={button.variant || 'default'}
                  className="h-11 rounded-xl px-4 font-medium whitespace-nowrap sm:px-8"
                  key={idx}
                >
                  <Link
                    href={button.url ?? ''}
                    target={button.target ?? '_self'}
                  >
                    {button.icon && <SmartIcon name={button.icon as string} />}
                    <span className="whitespace-nowrap">{button.title}</span>
                  </Link>
                </Button>
              );
            })}
          </div>
        )}

        {section.tip && (
          <p
            className="text-muted-foreground mt-6 block text-center text-sm"
            dangerouslySetInnerHTML={{ __html: section.tip ?? '' }}
          />
        )}

        {section.show_avatars && (
          <SocialAvatars tip={section.avatars_tip || ''} />
        )}
      </div>

      {(section.image?.src || section.image_invert?.src) && (
        <HeroBrowserPreview section={section} />
      )}

      {section.background_image?.src && (
        <div className="absolute inset-0 -z-10 hidden h-full w-full overflow-hidden md:block">
          <div className="from-background/20 via-background/20 to-background absolute inset-0 z-10 bg-gradient-to-b" />
          <Image
            src={section.background_image.src}
            alt={section.background_image.alt || ''}
            className="object-cover opacity-90 blur-[0px]"
            fill
            loading="lazy"
            sizes="(max-width: 768px) 0vw, 100vw"
            quality={70}
            unoptimized={section.background_image.src.startsWith('http')}
          />
        </div>
      )}
    </section>
  );
}

// 浏览器预览组件 - 带有图片轮播效果
function HeroBrowserPreview({ section }: { section: Section }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // 从配置读取图片数组，优先使用 carousel_images
  const carouselImages = (section as any).carousel_images;
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

  // 手动切换函数
  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsPaused(true);
    // 3秒后恢复自动播放
    setTimeout(() => setIsPaused(false), 3000);
  };

  const nextSlide = () => {
    goToSlide((currentSlide + 1) % images.length);
  };

  const prevSlide = () => {
    goToSlide((currentSlide - 1 + images.length) % images.length);
  };

  // 自动轮播
  useEffect(() => {
    if (images.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % images.length);
    }, 5000); // 每5秒切换

    return () => clearInterval(timer);
  }, [images.length, isPaused]);

  return (
    <div className="relative mt-12 px-4 sm:mt-20">
      {/* 外层容器 */}
      <div className="relative mx-auto max-w-7xl">
        {/* 背景装饰光晕 - 与主背景协调 */}
        <div className="from-background/50 via-muted/30 to-background/50 dark:from-muted/10 dark:via-background/5 dark:to-muted/10 absolute inset-0 -z-10 rounded-[1.5rem] bg-gradient-to-br blur-3xl" />

        {/* 主卡片容器 - 外圆角 1.5rem */}
        <div className="border-border/30 from-muted/40 via-background/60 to-muted/40 dark:border-border/40 dark:from-muted/5 dark:via-background/10 dark:to-muted/5 relative overflow-hidden rounded-[1.5rem] border bg-gradient-to-br p-6 shadow-2xl backdrop-blur-sm sm:p-8 dark:shadow-black/50">
          {/* 背景图片层 */}
          <div className="absolute inset-0 -z-0 overflow-hidden rounded-[1.5rem]">
            <Image
              src="/imgs/bg/hero-a.png"
              alt="Card background"
              className="object-cover opacity-30 dark:opacity-20"
              fill
              loading="lazy"
              sizes="(max-width: 768px) 100vw, 1400px"
              quality={80}
            />
          </div>
          {/* 内容容器 - 内圆角 = 1.5rem - 0.5rem = 1rem */}
          <div className="bg-background/95 dark:bg-background/80 relative overflow-hidden rounded-2xl shadow-2xl backdrop-blur-xl">
            {/* 浏览器顶部栏 */}
            <div className="border-border/50 bg-muted/50 dark:border-border/30 dark:bg-muted/20 flex items-center justify-between border-b px-4 py-3 backdrop-blur-sm sm:px-6">
              {/* 左侧：窗口控制按钮 */}
              <div className="flex items-center gap-2">
                <div className="group size-3 rounded-full bg-red-500 shadow-sm transition-all hover:scale-110 dark:bg-red-500/80" />
                <div className="group size-3 rounded-full bg-yellow-500 shadow-sm transition-all hover:scale-110 dark:bg-yellow-500/80" />
                <div className="group size-3 rounded-full bg-green-500 shadow-sm transition-all hover:scale-110 dark:bg-green-500/80" />
              </div>

              {/* 中间：浏览器地址栏 */}
              <div className="bg-background/80 border-border/30 dark:border-border/20 dark:bg-background/40 hidden items-center gap-2 rounded-lg border px-4 py-1.5 sm:flex sm:min-w-[300px] md:min-w-[400px]">
                <svg
                  className="text-muted-foreground size-4"
                  fill="none"
                  strokeWidth="2"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9Z" />
                </svg>
              </div>

              {/* 右侧：标签指示器 */}
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

            {/* 图片轮播区域 */}
            <div className="group relative overflow-hidden">
              {/* 左右切换按钮 - 仅在多图片时显示 */}
              {images.length > 1 && (
                <>
                  {/* 左侧按钮 */}
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

                  {/* 右侧按钮 */}
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
                  {/* 暗色主题图片 */}
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
                      sizes="(max-width: 768px) 100vw, 1400px"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      fetchPriority={idx === 0 ? 'high' : 'low'}
                      quality={92}
                      unoptimized={image.dark.startsWith('http')}
                    />
                  )}

                  {/* 亮色主题图片 */}
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
                      sizes="(max-width: 768px) 100vw, 1400px"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      fetchPriority={idx === 0 ? 'high' : 'low'}
                      quality={92}
                      unoptimized={image.light.startsWith('http')}
                    />
                  )}
                </div>
              ))}

              {/* 渐变遮罩 - 增强视觉效果 */}
              <div className="from-background/5 to-background/5 dark:from-background/10 dark:to-background/10 pointer-events-none absolute inset-0 bg-gradient-to-b via-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
