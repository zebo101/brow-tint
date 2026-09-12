import Image from 'next/image';

import { Link } from '@/core/i18n/navigation';
import { BorderBeam } from '@/shared/components/magicui/border-beam';
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
        'relative isolate min-h-[100svh] overflow-hidden bg-[#EFB3B6] text-[#42282D]',
        section.className,
        className
      )}
    >
      {/* Keep the palette visible before the portrait loads, too. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_16%_40%,#F4C5C4_0%,#EFB3B6_48%,#EFAAB0_100%)]"
      />
      {section.background_image?.src && (
        // Show only the empty left third; the source also contains a portrait.
        <div className="absolute inset-y-0 left-0 hidden w-[300%] md:block">
          <Image
            src={section.background_image.src}
            alt={section.background_image.alt || ''}
            className="h-full w-full object-cover object-center"
            fill
            loading="lazy"
            sizes="100vw"
          />
        </div>
      )}

      {/* Giant brand text
          Mobile: z-[3] ABOVE model so it's always visible
          Desktop: z-[1] BEHIND model for editorial layering effect */}
      <h1
        className="font-display pointer-events-none absolute inset-x-0 top-[12%] z-[3] text-center leading-[0.85] font-black text-[#713C49] select-none md:top-[10%] md:z-[1]"
        style={{ fontSize: 'clamp(56px, 16vw, 300px)' }}
      >
        {displayText}
      </h1>

      {/* Mobile uses a single cropped portrait with a baked-in pink backdrop. */}
      <Image
        src="/imgs/bg/hero-mobile.webp"
        alt={section.image?.alt || section.title || ''}
        className="absolute inset-0 z-[2] h-full w-full object-cover md:hidden"
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[28%] bg-linear-to-b from-[#EFB3B6] via-[#EFB3B6]/80 to-transparent md:hidden"
      />

      {/* Foreground image (hero-2) — desktop only; the model overlaps the
          giant H1 text creating the editorial layered effect. Wrapped in
          `hidden md:block` so mobile never fetches it. */}
      {section.image?.src && (
        <div className="absolute inset-0 z-[2] hidden md:block">
          <Image
            src={section.image.src}
            alt={section.image.alt || ''}
            className="h-full w-full object-cover object-center"
            fill
            priority
            sizes="100vw"
          />
        </div>
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
        <div className="pointer-events-auto absolute top-6 left-0 w-[210px] -rotate-[8deg] transition-transform duration-300 hover:scale-[1.03] hover:-rotate-[6deg]">
          <PolaroidFrame
            caption="before"
            className="bg-[#FFF4E9] text-[#713C49] ring-[#713C49]/10"
          >
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
        <div className="pointer-events-auto absolute top-0 right-0 z-10 w-[210px] rotate-[10deg] transition-transform duration-300 hover:scale-[1.03] hover:rotate-[12deg]">
          <PolaroidFrame
            caption="after"
            className="bg-[#FFF4E9] text-[#713C49] ring-[#713C49]/10"
          >
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

      {/* Mobile copy sits on a tinted surface for consistent contrast. */}
      <div className="absolute inset-x-0 bottom-0 z-[4] p-5 md:hidden">
        <div className="mx-auto max-w-sm">
          <div className="relative overflow-hidden rounded-2xl">
            <div className="bg-[#F1D3CB]/95 px-5 py-4 text-sm leading-relaxed text-[#42282D] shadow-[0_8px_32px_rgba(66,40,45,0.16)] ring-1 ring-[#713C49]/15 backdrop-blur-xl">
              {section.description && (
                <span
                  dangerouslySetInnerHTML={{ __html: section.description }}
                />
              )}{' '}
              {section.buttons?.[0] && (
                <Link
                  href={section.buttons[0].url ?? ''}
                  target={section.buttons[0].target ?? '_self'}
                  className="mt-3 flex min-h-11 w-fit items-center gap-2 rounded-full bg-[#713C49] px-5 py-2 text-sm font-semibold text-[#FFF4E9] transition-colors hover:bg-[#572B38] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#713C49]"
                >
                  {section.buttons[0].title} →
                </Link>
              )}
            </div>
            <BorderBeam
              size={120}
              duration={7}
              borderWidth={1}
              colorFrom="#B87879"
              colorTo="#E3BCA5"
            />
            <BorderBeam
              size={120}
              duration={7}
              borderWidth={1}
              colorFrom="#E3BCA5"
              colorTo="#B87879"
              initialOffset={50}
            />
          </div>
        </div>
      </div>

      {/* ── Desktop bottom: editorial layout ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] hidden md:block md:px-12 md:pb-12 lg:px-16">
        <div className="flex items-end justify-between">
          {/* Left column: label + description + CTA */}
          <div className="pointer-events-auto max-w-md md:max-xl:max-w-sm md:max-xl:rounded-2xl md:max-xl:bg-[#F1D3CB]/95 md:max-xl:p-5 md:max-xl:shadow-lg">
            {section.title && (
              <p className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#713C49] uppercase">
                {section.title}
              </p>
            )}
            {section.description && (
              <p
                className="text-[15px] leading-relaxed text-[#42282D]"
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
                        className="border-[#713C49]/20 bg-[#713C49] text-[#FFF4E9] hover:bg-[#572B38] focus-visible:ring-[#713C49] dark:bg-[#713C49] dark:text-[#FFF4E9] dark:hover:bg-[#572B38]"
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
                      className="group flex items-center gap-2 rounded-md text-sm font-medium text-[#572B38] transition-colors hover:text-[#42282D] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#713C49]"
                    >
                      {button.title}
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#713C49]/10 transition-colors group-hover:bg-[#713C49]/20">
                        ↗
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Editorial attribution sits directly on the photograph. */}
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
