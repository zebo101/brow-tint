import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const slug = 'nunsseop-moyang-guide';
const postsDirectory = new URL('../../../content/posts/', import.meta.url);

test('the Korean eyebrow guide meets its metadata and content contract', () => {
  const source = readFileSync(
    new URL(`${slug}.ko.mdx`, postsDirectory),
    'utf8'
  );
  const parts = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  assert.ok(parts, 'post must have frontmatter and a separate body');
  const [, frontmatter, body] = parts;

  // Like the other guide contracts, expect single-line YAML text fields.
  for (const [field, maximum] of [
    ['title', 30],
    ['description', 80],
  ] as const) {
    const value = frontmatter
      .match(new RegExp(`^${field}:[ \\t]*(.+)$`, 'm'))?.[1]
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    assert.ok(value, `${field} must not be empty`);
    assert.ok(
      value.length <= maximum,
      `${field} has ${value.length} characters; expected at most ${maximum}`
    );
    assert.ok(value.includes('눈썹 모양'), `${field} must include 눈썹 모양`);
    if (field === 'title') assert.ok(value.startsWith('눈썹 모양'));
  }

  assert.match(frontmatter, /^created_at: 2026-10-23$/m);
  assert.match(frontmatter, /^updated_at: 2026-10-23$/m);
  assert.match(frontmatter, /^faq_title: '자주 묻는 질문'$/m);
  const faq = frontmatter.match(
    /^faq:\r?\n((?:[ \t]+[^\r\n]*(?:\r?\n|$))*)/m
  )?.[1];
  assert.ok(faq, 'frontmatter must include FAQ items');
  const items = faq.split(/^ {2}- /m).slice(1);
  assert.equal(items.length, 4, 'frontmatter must contain exactly four FAQs');
  for (const item of items) {
    assert.match(item, /^question:[ \t]*(['"])(.+)\1$/m);
    assert.match(item, /^ {4}answer:[ \t]*(['"])(.+)\1$/m);
  }

  assert.ok(body.includes('<TryOnCta'), 'body must include the try-on CTA');
  const ctas = body.match(/<TryOnCta\b[\s\S]*?\/>/g) ?? [];
  assert.equal(ctas.length, 1, 'body must include exactly one try-on CTA');
  const [cta] = ctas;
  assert.ok(cta.includes('primaryHref="/filter"'));
  assert.ok(cta.includes('secondaryHref="/blog/eyebrow-shapes-guide"'));
  for (const prop of ['title', 'text', 'primaryLabel', 'secondaryLabel']) {
    const value = cta.match(new RegExp(`\\b${prop}="([^"]+)"`))?.[1];
    assert.ok(value, `CTA must override the ${prop} prop`);
    assert.match(value, /[가-힣]/, `CTA ${prop} must contain Korean copy`);
  }

  const links = [...body.matchAll(/\[[^\]]+\]\((\/[^)\s]+)\)/g)].map(
    ([, url]) => url
  );
  assert.ok(
    links.filter((url) => url === '/ko/filter').length >= 2,
    'body must link to /ko/filter at least twice'
  );
  for (const url of [
    '/ko/blog/eyebrow-shapes-guide',
    '/ko/blog/how-to-shape-eyebrows',
    '/ko/blog/eyebrow-mapping-guide',
  ]) {
    assert.ok(links.includes(url), `body must link to ${url}`);
  }
  assert.ok(links.every((url) => url.startsWith('/ko/')));
  assert.ok(
    !source.includes('/eyebrow-shape-for-face-shape'),
    'post must not link to the English-only face-shape page'
  );

  // Count Hangul in authored body text, excluding frontmatter, URLs, and JSX.
  const text = body
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ');
  const hangulCharacters = text.match(/[가-힣]/g)?.length ?? 0;
  assert.ok(
    hangulCharacters >= 2000,
    `body has ${hangulCharacters} Hangul characters; expected at least 2000`
  );
  for (const phrase of [
    '눈썹 모양',
    '아치형 눈썹',
    '일자 눈썹',
    '얼굴형에 맞는 눈썹 모양',
    '눈썹 모양 추천',
  ]) {
    assert.ok(text.includes(phrase), `body must include ${phrase}`);
  }
  const disclosure = 'Browlens는 얼굴형을 감지하거나 분석하지 않습니다.';
  assert.ok(text.includes(disclosure), 'body must disclose the product limit');
  assert.ok(faq.includes(disclosure), 'FAQ must disclose the product limit');
});

test('the Korean eyebrow guide has no English or other-locale counterpart', () => {
  assert.equal(existsSync(new URL(`${slug}.mdx`, postsDirectory)), false);
  assert.deepEqual(
    readdirSync(postsDirectory).filter((filename) =>
      filename.startsWith(`${slug}.`)
    ),
    [`${slug}.ko.mdx`]
  );
});
