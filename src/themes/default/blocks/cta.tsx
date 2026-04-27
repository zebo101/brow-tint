import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { RainbowButton } from '@/shared/components/ui/rainbow-button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function Cta({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn('relative py-16 md:py-24', section.className, className)}
    >
      <div className="container">
        <div className="text-center">
          <ScrollAnimation>
            <h2 className="font-display text-4xl font-semibold text-balance lg:text-5xl">
              {section.title}
            </h2>
          </ScrollAnimation>
          <ScrollAnimation delay={0.15}>
            <p
              className="font-display mt-4"
              dangerouslySetInnerHTML={{ __html: section.description ?? '' }}
            />
          </ScrollAnimation>

          <ScrollAnimation delay={0.3}>
            <div className="mt-12 flex flex-wrap justify-center gap-4 relative z-0">
              {section.buttons?.map((button, idx) => {
                // 第一个按钮使用RainbowButton（不显示图标，保持简洁）
                if (idx === 0) {
                  return (
                    <RainbowButton
                      asChild
                      key={idx}
                      showRainbow
                    >
                      <Link
                        href={button.url || ''}
                        target={button.target || '_self'}
                      >
                        <span>{button.title}</span>
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
                    className="rounded-full px-8 font-medium"
                    key={idx}
                  >
                    <Link
                      href={button.url || ''}
                      target={button.target || '_self'}
                    >
                      <span>{button.title}</span>
                    </Link>
                  </Button>
                );
              })}
            </div>
          </ScrollAnimation>
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 z-0 hidden h-[180px] w-[180px] -translate-x-4 translate-y-4 opacity-70 md:block md:h-[220px] md:w-[220px] md:-translate-x-12 md:translate-y-8 lg:h-[280px] lg:w-[280px] lg:-translate-x-16 lg:translate-y-12 lg:opacity-80"
        style={{
          backgroundImage: "url('/imgs/bg/cta.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
        }}
      />
    </section>
  );
}
