import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { featuredBadges } from '../src/config/featured-badges';
import { FeaturedOn } from '../src/shared/blocks/common/featured-on';

const expectedHrefs = [
  'https://toolhunter.ai/ai-tool/browlens?ref=badge',
  'https://thatappshow.com/product/browlens',
  'https://forg.to/projects/browlens',
  'https://www.aitoolzdir.com',
  'https://www.aitoolsaver.com',
  'https://megalaun.ch/',
  'https://nextlaunch.io/projects/browlens',
  'https://marketingdb.live',
  'https://mydentify.com/',
  'https://kittylaunch.com/p/browlens?utm_source=badge',
  'https://aijet.cc',
  'https://www.aitoolsprime.com?utm_source=badge&utm_medium=referral&utm_campaign=featured_badge',
  'https://agentgo.net',
  'https://bricklaun.ch/ai/browlens',
  'https://buildlist.io',
  'https://prolaunch.net',
  'https://launchstreak.dev/ai/browlens',
  'https://wayfindio.com',
  'https://sumodir.com',
  'https://vinggle.com',
  'https://codetrendy.com/?utm_source=browlens.com&utm_medium=badge',
];

test('featured badges retain all 21 unique directories, hrefs, and required rel values', () => {
  assert.equal(featuredBadges.length, 21);
  assert.equal(
    new Set(featuredBadges.map((badge) => badge.directory)).size,
    21
  );
  assert.equal(expectedHrefs.length, 21);
  assert.equal(new Set(expectedHrefs).size, 21);

  for (const { directory, html } of featuredBadges) {
    assert.ok(html.startsWith('<a '), directory);
    assert.ok(html.endsWith('</a>'), directory);
  }

  for (const href of expectedHrefs) {
    assert.equal(
      featuredBadges.filter(({ html }) => html.includes(`href="${href}"`))
        .length,
      1,
      href
    );
  }

  for (const [directory, expectedRel] of [
    ['marketingdb.live', 'noopener noreferrer nofollow sponsored'],
    ['codetrendy.com', 'nofollow noopener noreferrer'],
    ['sumodir.com', 'dofollow'],
  ]) {
    const badge = featuredBadges.find((entry) => entry.directory === directory);
    assert.ok(badge, directory);
    assert.equal(
      badge.html.match(/^<a\s[^>]*\brel="([^"]*)"/)?.[1],
      expectedRel,
      directory
    );
  }
});

test('FeaturedOn includes every badge verbatim in server-rendered HTML', () => {
  const html = renderToStaticMarkup(createElement(FeaturedOn));

  assert.ok(html.includes('<section aria-label="Featured on"'));
  for (const badge of featuredBadges) {
    assert.ok(html.includes(badge.html), badge.directory);
  }
});

test('framing headers allow embedding without X-Frame-Options', () => {
  const config = readFileSync(
    new URL('../next.config.mjs', import.meta.url),
    'utf8'
  );

  assert.ok(!config.includes('X-Frame-Options'));
  assert.ok(config.includes('frame-ancestors *'));
});
