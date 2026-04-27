import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function Features({
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
      <div className={`container space-y-8 md:space-y-16`}>
        <ScrollAnimation>
          <div className="mx-auto max-w-4xl text-center text-balance">
            <h2 className="text-foreground font-display mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
              {section.title}
            </h2>
            <p className="text-muted-foreground font-display mb-6 md:mb-12 lg:mb-16">
              {section.description}
            </p>
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.2}>
          <div className="relative mx-auto grid divide-x divide-y border *:p-12 sm:grid-cols-2 lg:grid-cols-3">
            {section.items?.map((item, idx) => (
              <div className="space-y-3" key={idx}>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{item.title}</h3>
                </div>
                <p className="text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </ScrollAnimation>
      </div>
      {/* 左下角装饰背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 z-0 hidden h-[300px] w-[300px] translate-x-7 -translate-y-[90px] opacity-70 md:block"
        style={{
          backgroundImage: "url('/imgs/bg/bg3.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
        }}
      />
      {/* 右上角装饰背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 z-0 hidden h-[400px] w-[400px] translate-x-1/4 translate-y-[35px] opacity-80 md:block"
        style={{
          backgroundImage: "url('/imgs/bg/features.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
        }}
      />
    </section>
  );
}
