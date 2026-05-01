type JsonLdProps = {
  schema: Record<string, unknown> | Record<string, unknown>[];
  id?: string;
};

export function JsonLd({ schema, id }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      id={id}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
