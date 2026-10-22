import { blogDefaults } from '@/config/blog';
import { JsonLd } from '@/shared/components/json-ld';
import { buildBlogFaqSchema } from '@/shared/lib/blog-seo';
import type { BlogFaqItem } from '@/shared/types/blocks/blog';

/** Native disclosure elements keep every answer in the server-rendered article. */
export function BlogFaq({
  faq,
  title = blogDefaults.faqTitle,
}: {
  faq?: readonly BlogFaqItem[];
  title?: string;
}) {
  const schema = buildBlogFaqSchema(faq);
  if (!schema) return null;

  return (
    <section className="relative py-16 md:py-24">
      <JsonLd id="article-faq-schema" schema={schema} />
      <div className="mx-auto max-w-full px-4 md:max-w-3xl md:px-8">
        <div className="mx-auto max-w-2xl text-center text-balance">
          <h2 className="text-foreground font-display mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h2>
        </div>
        <div className="bg-muted mx-auto mt-12 w-full rounded-2xl p-1">
          {faq?.map(({ question, answer }, index) => (
            <div className="group" key={index}>
              <details
                open={index === 1}
                className="peer open:bg-card rounded-xl border-none px-7 py-1 open:shadow-sm"
              >
                <summary className="font-display focus-visible:border-ring focus-visible:ring-ring/50 flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-4 text-left text-base font-medium outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden [[open]>&>svg]:rotate-180">
                  <span>{question}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                    className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 9l6 6 6-6"
                    />
                  </svg>
                </summary>
                <div className="pt-0 pb-4">
                  <p className="text-base">{answer}</p>
                </div>
              </details>
              <hr className="mx-7 border-dashed group-last:hidden peer-open:opacity-0" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
