import assert from 'node:assert/strict';
import test from 'node:test';

import { blogFrontmatterFields } from '@/config/blog';

async function getSchemas() {
  // Fumadocs' plugins are ESM-only; do not load its CommonJS config entry in tsx.
  const { frontmatterSchema } = await import('fumadocs-mdx/config');
  return {
    frontmatterSchema,
    schema: frontmatterSchema.extend(blogFrontmatterFields),
  };
}

test('optional blog fields do not change the existing frontmatter schema result when absent', async () => {
  const { schema, frontmatterSchema } = await getSchemas();
  const legacy = {
    title: 'An existing guide',
    description: 'The same description',
    image: '/imgs/cases/2.jpg',
    created_at: '2026-09-12',
    author_name: 'Browlens Team',
  };

  assert.deepEqual(schema.parse(legacy), frontmatterSchema.parse(legacy));
});

test('blog frontmatter retains FAQ text, its localized title, and image alt', async () => {
  const { schema } = await getSchemas();
  const frontmatter = {
    title: 'Guide',
    faq_title: 'Häufig gestellte Fragen',
    faq: [
      { question: 'Kann ich es testen?', answer: 'Ja. **Text** bleibt Text.' },
    ],
    image_alt: 'Augenbrauen mit eingezeichneten Messlinien',
  };

  assert.deepEqual(schema.parse(frontmatter), frontmatter);
});

test('updated_at accepts date strings and YAML dates, normalized to serializable ISO strings', async () => {
  const { schema } = await getSchemas();
  for (const updated_at of ['2026-10-15', new Date('2026-10-15T00:00:00Z')]) {
    assert.equal(
      schema.parse({ title: 'Guide', updated_at }).updated_at,
      '2026-10-15T00:00:00.000Z'
    );
  }
});

test('invalid optional frontmatter fails validation instead of silently losing data', async () => {
  const { schema } = await getSchemas();
  for (const fields of [
    { updated_at: 'not a date' },
    { updated_at: null },
    { updated_at: 123 },
    { faq: [{ question: 'Missing answer' }] },
    { faq: [{ question: 'Invalid answer', answer: 42 }] },
    { image_alt: 42 },
  ]) {
    assert.equal(
      schema.safeParse({ title: 'Guide', ...fields }).success,
      false
    );
  }
});

test('an empty FAQ is valid and stays opt-in', async () => {
  const { schema } = await getSchemas();
  assert.deepEqual(schema.parse({ title: 'Guide', faq: [] }).faq, []);
  assert.equal(schema.parse({ title: 'Guide' }).faq, undefined);
});
