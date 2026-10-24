import { featuredBadges } from '@/config/featured-badges';
import commonMessages from '@/config/locale/messages/en/common.json';

export function FeaturedOn({
  section = commonMessages.featured_on,
}: {
  section?: { title: string };
}) {
  return (
    <section
      aria-label={section.title}
      className="border-border/40 border-t px-4 py-6"
    >
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="text-muted-foreground mb-4 text-center text-sm font-medium">
          {section.title}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {featuredBadges.map((badge) => (
            <div
              key={badge.directory}
              className="inline-flex items-center"
              dangerouslySetInnerHTML={{ __html: badge.html }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
