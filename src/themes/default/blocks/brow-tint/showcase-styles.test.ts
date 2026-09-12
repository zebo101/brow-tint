import assert from 'node:assert/strict';
import test from 'node:test';

import { getShowcaseStyles } from './showcase-styles';
import type { BrowStyleItem } from './types';

function style(id: string, popular = false, trending = false): BrowStyleItem {
  return {
    id,
    slug: id,
    name: id,
    shade: 'brown',
    shape: 'natural',
    intensity: 'soft',
    thumbnail: null,
    prompt: '',
    negative: null,
    popular,
    trending,
    tier: 'free',
    credits: 1,
  };
}

test('showcase prioritizes trending then popular, preserving each group and the source catalog', () => {
  const catalog = [
    style('plain-1'),
    style('popular-1', true),
    style('trending-1', true, true),
    style('trending-2', false, true),
    style('popular-2', true),
    style('plain-2'),
  ];
  const original = catalog.map((item) => item.id);
  assert.deepEqual(
    getShowcaseStyles(catalog, 16).map((item) => item.id),
    ['trending-1', 'trending-2', 'popular-1', 'popular-2', 'plain-1', 'plain-2']
  );
  assert.deepEqual(
    catalog.map((item) => item.id),
    original
  );
});

test('mobile and desktop galleries retain the first six and sixteen ranked samples', () => {
  const catalog = Array.from({ length: 20 }, (_, index) =>
    style(`style-${index}`)
  );
  for (const limit of [6, 16]) {
    const visible = getShowcaseStyles(catalog, limit);
    assert.equal(visible.length, limit);
    assert.deepEqual(visible, catalog.slice(0, limit));
    assert.equal(new Set(visible.map((item) => item.id)).size, limit);
  }
  assert.deepEqual(getShowcaseStyles([], 16), []);
});
