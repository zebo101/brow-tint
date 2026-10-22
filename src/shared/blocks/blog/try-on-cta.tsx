import { Link } from '@/core/i18n/navigation';
import { blogDefaults } from '@/config/blog';

export type TryOnCtaProps = {
  title?: string;
  text?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

/** An opt-in MDX card: no client state, effects, or interactive dependencies. */
export function TryOnCta({
  title,
  text,
  primaryHref = blogDefaults.primaryHref,
  primaryLabel = blogDefaults.primaryLabel,
  secondaryHref = blogDefaults.secondaryHref,
  secondaryLabel = blogDefaults.secondaryLabel,
}: TryOnCtaProps) {
  return (
    <aside className="not-prose border-border bg-muted/50 my-8 rounded-2xl border p-6">
      {title && (
        <h2 className="font-display text-foreground text-xl font-semibold">
          {title}
        </h2>
      )}
      {text && <p className="text-muted-foreground mt-3 leading-7">{text}</p>}
      <div
        className={`flex flex-wrap items-center gap-4 ${title || text ? 'mt-5' : ''}`}
      >
        <Link
          href={primaryHref}
          className="bg-primary hover:bg-primary/90 focus-visible:ring-ring inline-flex max-w-full items-center justify-center rounded-full px-6 py-3 text-center text-sm font-medium no-underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span className="text-primary-foreground">{primaryLabel}</span>
        </Link>
        <Link
          href={secondaryHref}
          className="focus-visible:ring-ring rounded-sm text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span className="text-foreground">{secondaryLabel}</span>
        </Link>
      </div>
    </aside>
  );
}
