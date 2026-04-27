import Image from 'next/image';

import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { RainbowButton } from '@/shared/components/ui/rainbow-button';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

import { SocialAvatars } from './social-avatars';
import { HeroBrowserPreview } from './hero-browser-preview';

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
    aria-hidden
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

export function Hero({
  section,
  className,
  customContent,
}: {
  section: Section;
  className?: string;
  customContent?: React.ReactNode;
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
                <ArrowRightIcon className="m-auto size-3" />
              </span>
              <span className="flex size-6">
                <ArrowRightIcon className="m-auto size-3" />
              </span>
            </div>
          </div>
        </Link>
      )}

      <div className="relative mx-auto max-w-full px-4 text-center md:max-w-5xl">
        {texts && texts.length > 0 ? (
          <h1 className="hero-gradient font-display py-2 text-center text-4xl leading-[1.1] font-bold sm:mt-12 md:text-[78.05px] md:leading-[1.1]">
            {texts[0]}
            <span className="hero-gradient">{highlightText}</span>
            {texts[1]}
          </h1>
        ) : (
          <h1 className="hero-gradient font-display py-2 text-center text-4xl leading-[1.1] font-bold sm:mt-12 md:text-[78.05px] md:leading-[1.1]">
            {section.title}
          </h1>
        )}

        <p
          className="hero-gradient font-display mt-8 mb-8 text-lg text-balance"
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

      {customContent ? (
        <div className="relative mx-auto mt-12 max-w-[1400px] px-4 sm:mt-20">
          {customContent}
        </div>
      ) : (
        (section.image?.src || section.image_invert?.src) && (
          <HeroBrowserPreview section={section} />
        )
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
            quality={65}
            unoptimized={section.background_image.src.startsWith('http')}
          />
        </div>
      )}
    </section>
  );
}
