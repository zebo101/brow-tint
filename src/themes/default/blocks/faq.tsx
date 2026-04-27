'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { Section } from '@/shared/types/blocks/landing';

export function Faq({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const defaultValue =
    section.items?.[1]?.question || section.items?.[1]?.title || undefined;

  return (
    <section id={section.id} className={`relative py-16 md:py-24 ${className}`}>
      <div className={`mx-auto max-w-full px-4 md:max-w-3xl md:px-8`}>
        <div className="mx-auto max-w-2xl text-center text-balance">
          <h2 className="text-foreground font-display mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
            {section.title}
          </h2>
          <p className="text-muted-foreground font-display mb-6 md:mb-12 lg:mb-16">
            {section.description}
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-full">
          <Accordion
            type="single"
            collapsible
            defaultValue={defaultValue}
            className="bg-muted dark:bg-muted/50 w-full rounded-2xl p-1"
          >
            {section.items?.map((item, idx) => (
              <div className="group" key={idx}>
                <AccordionItem
                  value={item.question || item.title || ''}
                  className="data-[state=open]:bg-card dark:data-[state=open]:bg-muted peer rounded-xl border-none px-7 py-1 data-[state=open]:border-none data-[state=open]:shadow-sm"
                >
                  <AccordionTrigger className="font-display cursor-pointer text-base hover:no-underline">
                    {item.question || item.title || ''}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-base">
                      {item.answer || item.description || ''}
                    </p>
                  </AccordionContent>
                </AccordionItem>
                <hr className="mx-7 border-dashed group-last:hidden peer-data-[state=open]:opacity-0" />
              </div>
            ))}
          </Accordion>

          <p
            className="text-muted-foreground mt-6 px-8"
            dangerouslySetInnerHTML={{ __html: section.tip || '' }}
          />
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-[58%] left-0 z-0 hidden h-[200px] w-[200px] translate-x-40 -translate-y-1/2 opacity-60 md:block md:h-[280px] md:w-[280px] md:translate-x-32 lg:h-[380px] lg:w-[380px] lg:translate-x-40 lg:opacity-70"
        style={{
          backgroundImage: "url('/imgs/bg/faq.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
        }}
      />
    </section>
  );
}
