import Image from 'next/image';

import { Link } from '@/core/i18n/navigation';
import { BorderBeam } from '@/shared/components/magicui/border-beam';
import { Button } from '@/shared/components/ui/button';
import { PolaroidFrame } from '@/shared/components/ui/polaroid-frame';
import { RainbowButton } from '@/shared/components/ui/rainbow-button';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function HeroEditorial({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const displayText = section.highlight_text || section.title || '';

  return (
    <section
      id={section.id}
      className={cn(
        'relative min-h-[100svh] overflow-hidden',
        section.className,
        className
      )}
    >
      {/* Background image (hero-1) — full screen base layer */}
      {section.background_image?.src && (
        <Image
          src={section.background_image.src}
          alt={section.background_image.alt || ''}
          className="absolute inset-0 h-full w-full object-cover object-[70%_15%] md:object-center"
          fill
          priority
          sizes="100vw"
        />
      )}

      {/* Giant brand text
          Mobile: z-[3] ABOVE model so it's always visible, with subtle shadow
          Desktop: z-[1] BEHIND model for editorial layering effect */}
      <h1
        className="font-display pointer-events-none absolute inset-x-0 top-[5%] z-[3] text-center leading-[0.85] font-black text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.1)] select-none md:top-[10%] md:z-[1] md:drop-shadow-none"
        style={{ fontSize: 'clamp(56px, 16vw, 300px)' }}
      >
        {displayText}
      </h1>

      {/* Foreground image (hero-2) — model overlaps the text on desktop */}
      {section.image?.src && (
        <Image
          src={section.image.src}
          alt={section.image.alt || ''}
          className="absolute inset-0 z-[2] h-full w-full object-cover object-[70%_15%] md:object-center"
          fill
          priority
          sizes="100vw"
        />
      )}

      {/* Decorative polaroid stack — desktop-only, anchored to the left
          edge. Two layered cards (back/front) tilted in opposite
          directions for an editorial scrapbook feel; together they tell
          the brand's before → after story. Hidden on mobile + tablet
          (cramped). pointer-events-none on the wrapper + auto on each
          card so hover works but the empty space between them lets
          clicks pass through to layers behind. */}
      <div className="pointer-events-none absolute top-[58%] left-12 z-[3] hidden h-[360px] w-[340px] -translate-y-1/2 lg:block xl:left-20">
        {/* Back card — "before", angled left */}
        <div className="pointer-events-auto absolute top-6 left-0 w-[210px] -rotate-[8deg] transition-transform duration-300 hover:-rotate-[6deg] hover:scale-[1.03]">
          <PolaroidFrame caption="before">
            <div className="bg-default-50 relative aspect-[3/4] w-full overflow-hidden">
              <Image
                src="/imgs/cases/1.jpg"
                alt=""
                fill
                className="object-cover"
                sizes="210px"
              />
            </div>
          </PolaroidFrame>
        </div>
        {/* Front card — "after", angled right, sits above the back */}
        <div className="pointer-events-auto absolute top-0 right-0 z-10 w-[210px] rotate-[10deg] transition-transform duration-300 hover:rotate-[12deg] hover:scale-[1.03]">
          <PolaroidFrame caption="after">
            <div className="bg-default-50 relative aspect-[3/4] w-full overflow-hidden">
              <Image
                src="/imgs/cases/2.jpg"
                alt=""
                fill
                className="object-cover"
                sizes="210px"
              />
            </div>
          </PolaroidFrame>
        </div>
      </div>

      {/* ── Mobile bottom: glass card ── */}
      <div className="absolute inset-x-0 bottom-0 z-[4] p-5 md:hidden">
        <div className="mx-auto max-w-sm">
          <div className="relative overflow-hidden rounded-2xl">
            <div className="font-display bg-white/[0.08] px-5 py-4 text-sm leading-relaxed text-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-white/[0.15] backdrop-blur-xl">
              {section.description && (
                <span
                  dangerouslySetInnerHTML={{ __html: section.description }}
                />
              )}{' '}
              {section.buttons?.[0] && (
                <Link
                  href={section.buttons[0].url ?? ''}
                  target={section.buttons[0].target ?? '_self'}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-1 text-sm font-semibold text-black transition-colors hover:bg-white/90"
                >
                  {section.buttons[0].title} →
                </Link>
              )}
            </div>
            <BorderBeam
              size={120}
              duration={7}
              borderWidth={1}
              colorFrom="#ff69b4"
              colorTo="#ffc0cb"
            />
            <BorderBeam
              size={120}
              duration={7}
              borderWidth={1}
              colorFrom="#ffc0cb"
              colorTo="#ff85c2"
              initialOffset={50}
            />
          </div>
        </div>
      </div>

      {/* ── Desktop bottom: editorial layout ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] hidden md:block md:px-12 md:pb-12 lg:px-16">
        <div className="flex items-end justify-between">
          {/* Left column: label + description + CTA */}
          <div className="pointer-events-auto max-w-md">
            {section.title && (
              <p className="mb-3 text-[11px] font-medium tracking-[0.25em] text-white/50 uppercase">
                {section.title}
              </p>
            )}
            {section.description && (
              <p
                className="font-display text-[15px] leading-relaxed text-white/80"
                dangerouslySetInnerHTML={{ __html: section.description }}
              />
            )}
            {section.buttons && (
              <div className="mt-5 flex items-center gap-4">
                {section.buttons.map((button, idx) => {
                  if (idx === 0) {
                    return (
                      <RainbowButton
                        asChild
                        key={idx}
                        className="!bg-white !text-black hover:!bg-white/90"
                      >
                        <Link
                          href={button.url ?? ''}
                          target={button.target ?? '_self'}
                        >
                          <span className="text-sm font-semibold whitespace-nowrap">
                            {button.title}
                          </span>
                        </Link>
                      </RainbowButton>
                    );
                  }
                  return (
                    <Link
                      href={button.url ?? ''}
                      target={button.target ?? '_self'}
                      key={idx}
                      className="group flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
                    >
                      {button.title}
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/10 transition-colors group-hover:bg-white/20">
                        ↗
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column: decorative editorial elements */}
          <div className="pointer-events-auto text-right">
            {section.powered_by && (
              <p className="text-[11px] font-medium tracking-[0.25em] text-white/40 uppercase">
                [ {section.powered_by} ]
              </p>
            )}
            {section.editorial_labels && (
              <div className="mt-4 space-y-0.5 text-[13px] font-semibold tracking-[0.2em] text-white/30 uppercase">
                {(section.editorial_labels as string[]).map(
                  (label: string, idx: number) => (
                    <p key={idx}>{label}</p>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
