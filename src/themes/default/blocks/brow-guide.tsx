import { Link } from '@/core/i18n/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import type { Section } from '@/shared/types/blocks/landing';

type GuideItem = {
  title: string;
  paragraphs: string[];
  link?: { title: string; url: string; prefix: string; suffix?: string };
};

type GuideTable = {
  columns: string[];
  rows: { title: string; values: string[] }[];
};

/** Crawlable reading content follows the interactive tool, with locale-owned copy. */
export function BrowGuide({
  section,
}: {
  section: Section & { table?: GuideTable };
}) {
  return (
    <section
      id={section.id}
      className="px-6 py-16 md:py-24"
      aria-labelledby={`${section.id}-title`}
    >
      <div
        className={section.table ? 'mx-auto max-w-6xl' : 'mx-auto max-w-3xl'}
      >
        <h2
          id={`${section.id}-title`}
          className="font-display text-3xl font-semibold md:text-4xl"
        >
          {section.title}
        </h2>
        <p className="text-muted-foreground mt-5 leading-7">
          {section.description}
        </p>
        {section.table && (
          <div className="border-border mt-10 rounded-2xl border">
            <Table
              aria-labelledby={`${section.id}-title`}
              className="min-w-[720px] text-left"
            >
              <TableHeader className="bg-muted/50">
                <TableRow>
                  {section.table.columns.map((column) => (
                    <TableHead
                      key={column}
                      scope="col"
                      className="p-4 align-top whitespace-normal"
                    >
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.table.rows.map((row) => (
                  <TableRow key={row.title}>
                    <TableHead
                      scope="row"
                      className="p-4 align-top whitespace-normal"
                    >
                      {row.title}
                    </TableHead>
                    {row.values.map((value, index) => (
                      <TableCell
                        key={index}
                        className="text-muted-foreground p-4 align-top leading-6 whitespace-normal"
                      >
                        {value}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
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
