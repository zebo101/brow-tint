import { Link } from '@/core/i18n/navigation';
import type { Section } from '@/shared/types/blocks/landing';

type GuideItem = {
  title: string;
  paragraphs: string[];
  link?: { title: string; url: string; prefix: string; suffix?: string };
};

/** Crawlable reading content follows the interactive tool, with locale-owned copy. */
export function BrowGuide({ section }: { section: Section }) {
  return (
    <section
      id={section.id}
      className="px-6 py-16 md:py-24"
      aria-labelledby={`${section.id}-title`}
    >
      <div className="mx-auto max-w-3xl">
        <h2
          id={`${section.id}-title`}
          className="font-display text-3xl font-semibold md:text-4xl"
        >
          {section.title}
        </h2>
        <p className="text-muted-foreground mt-5 leading-7">
          {section.description}
        </p>
        <div className="mt-10 space-y-10">
          {(section.items as GuideItem[] | undefined)?.map((item) => (
            <div key={item.title}>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              {item.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-muted-foreground mt-4 leading-7"
                >
                  {paragraph}
                </p>
              ))}
              {item.link && (
                <p className="text-muted-foreground mt-4 leading-7">
                  {item.link.prefix}
                  <Link
                    href={item.link.url}
                    className="text-foreground underline underline-offset-4"
                  >
                    {item.link.title}
                  </Link>
                  {item.link.suffix}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
