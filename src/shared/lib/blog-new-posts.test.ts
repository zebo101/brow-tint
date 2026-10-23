import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const slugs = [
  'eyebrow-shapes-for-men',
  'eyebrow-shapes-for-women',
  'eyebrow-shapes-for-diamond-faces',
];

for (const slug of slugs) {
  test(`${slug} meets the new English guide content contract`, () => {
    const source = readFileSync(
      new URL(`../../../content/posts/${slug}.mdx`, import.meta.url),
      'utf8'
    );
    const parts = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    assert.ok(parts, 'post must have frontmatter and a separate body');
    const [, frontmatter, body] = parts;

    // These posts use single-line titles and an indented YAML FAQ list.
    const title = frontmatter
      .match(/^title:[ \t]*(.+)$/m)?.[1]
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    assert.ok(title, 'frontmatter title must not be empty');
    assert.ok(title.length <= 49, `title has ${title.length} characters`);
    const faq = frontmatter.match(
      /^faq:\r?\n((?:[ \t]+[^\r\n]*(?:\r?\n|$))*)/m
    )?.[1];
    assert.ok(faq, 'frontmatter must include FAQ items');
    const items = faq.split(/^ {2}- /m).slice(1);
    assert.equal(items.length, 4, 'frontmatter must contain exactly four FAQs');
    for (const item of items) {
      assert.match(item, /^question:[ \t]*\S+/);
      assert.match(item, /^ {4}answer:[ \t]*\S+/m);
    }

    assert.ok(
      body.includes('<TryOnCta />'),
      'body must include the try-on CTA'
    );
    const links = [...body.matchAll(/\[[^\]]+\]\((\/[^)\s]+)\)/g)].map(
      ([, url]) => url
    );
    for (const url of ['/eyebrow-shape-for-face-shape', '/filter']) {
      assert.ok(links.includes(url), `body must link to ${url}`);
    }
    assert.ok(
      new Set(links.filter((url) => url.startsWith('/blog/'))).size >= 3,
      'body must link to at least three blog guides'
    );

    // Count authored body words, not frontmatter, URLs, JSX, or table dividers.
    const text = body
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[*_`#|]/g, ' ')
      .replace(/\s+/g, ' ');
    const words = text.match(/[a-z0-9]+(?:['’\-][a-z0-9]+)*/gi)?.length ?? 0;
    assert.ok(words >= 1000, `body has ${words} words; expected at least 1000`);
    assert.doesNotMatch(
      text,
      /\b(?:detects|analy[sz]es|automatically identifies)\s+(?:(?:your|the)\s+)?face\s+shape\b/i,
      'body must not claim automatic face-shape detection or analysis'
    );
  });
}
