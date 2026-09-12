import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCandidate } from '@/shared/lib/brow-mapping/analysis';
import type { BrowAnalysis } from '@/shared/lib/brow-mapping/types';
import { straightBrowControls } from '@/themes/default/blocks/brow-tint/filter-presets';

test('Straight handles arches beyond the slider limit and preserves heads and tails', () => {
  const analysis: BrowAnalysis = {
    width: 1000,
    height: 1000,
    guides: [],
    landmarks: [],
    recommendations: ['natural'],
    reason: 'balanced',
    frame: {
      scale: 100,
      toImage: (p) => ({ x: p.x * 100, y: p.y * 100 }),
      toLocal: (p) => ({ x: p.x / 100, y: p.y / 100 }),
    },
    observed: ([-1, 1] as const).map((side) => {
      const samples = [
        { x: side, y: 0 },
        { x: side * 1.5, y: -0.06 },
        { x: side * 2, y: 0.02 },
      ];
      return {
        side,
        head: samples[0],
        arch: samples[1],
        tail: samples[2],
        samples,
        thickness: 0.01,
        nose: { x: 0, y: 1 },
        outerEye: { x: side, y: 0.5 },
        irisOuter: { x: side, y: 0.5 },
      };
    }),
  };
  const original = buildCandidate(analysis, 'natural');
  const straight = buildCandidate(
    analysis,
    'natural',
    straightBrowControls(analysis)
  );
  straight.brows.forEach((brow, index) => {
    assert.deepEqual(brow.head, original.brows[index].head);
    assert.deepEqual(brow.tail, original.brows[index].tail);
    assert.ok(
      Math.abs(brow.arch.y - (brow.head.y + brow.tail.y) / 2) < 0.00001
    );
    assert.ok(!/NaN|Infinity/.test(brow.path));
  });
});
