import { Link } from '@/core/i18n/navigation';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function ClusterPosts({
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
        <ScrollAnimation>
          <div className="mx-auto mb-12 max-w-3xl text-center text-balance">
            {section.label && (
              <p className="text-primary mb-3 text-sm font-medium tracking-wide uppercase">
                {section.label}
              </p>
            )}
            <h2 className="text-foreground font-display mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
              {section.title}
            </h2>
            {section.description && (
              <p className="text-muted-foreground font-display">
                {section.description}
              </p>
            )}
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.2}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.items?.map((item, idx) => (
              <Link
                key={idx}
                href={item.url ?? '#'}
                target={item.target ?? '_self'}
                className="group bg-card border-border hover:border-primary flex flex-col justify-between rounded-lg border p-6 shadow-sm transition-all hover:shadow-md"
              >
                <div className="space-y-3">
                  <h3 className="text-foreground group-hover:text-primary font-display text-lg font-semibold tracking-tight transition-colors">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="text-primary mt-4 text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100">
                  Read guide →
                </div>
              </Link>
            ))}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
