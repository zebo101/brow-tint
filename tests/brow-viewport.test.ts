import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createFrame } from '../src/shared/lib/brow-mapping/geometry';
import type { BrowAnalysis } from '../src/shared/lib/brow-mapping/types';
import {
  browFocusRegion,
  clientToImage,
  fitPortraitViewport,
  panViewport,
  zoomViewportAt,
} from '../src/shared/lib/brow-mapping/viewport';

const image = { width: 1000, height: 1200 };
const base = { x: 100, y: 200, width: 800, height: 800 };

test('fit places the complete photo inside safe space while the camera covers the whole canvas', () => {
  assert.deepEqual(fitPortraitViewport(image), {
    x: 0,
    y: 0,
    width: 1000,
    height: 1200,
  });
  assert.deepEqual(
    fitPortraitViewport(
      image,
      { width: 1200, height: 800 },
      { right: 400, bottom: 200 }
    ),
    {
      x: -300,
      y: 0,
      width: 2400,
      height: 1600,
    }
  );
  assert.deepEqual(
    fitPortraitViewport(image, { width: 400, height: 900 }, { bottom: 420 }),
    {
      x: 0,
      y: 0,
      width: 1000,
      height: 2250,
    }
  );
});

test('free panning can move the entire photo beyond the canvas without hitting image boundaries', () => {
  assert.deepEqual(panViewport(base, image, { x: -1e6, y: 1e6 }), {
    x: -999900,
    y: 1000200,
    width: 800,
    height: 800,
  });
  assert.deepEqual(panViewport(base, image, { x: 50, y: -50 }), {
    x: 150,
    y: 150,
    width: 800,
    height: 800,
  });
});

test('zoom preserves the touched world point and covers 25% through 800%', () => {
  const anchor = { x: 300, y: 400 };
  const result = zoomViewportAt(base, base, image, 2, anchor);
  assert.deepEqual(result, { x: 200, y: 300, width: 400, height: 400 });
  assert.deepEqual(zoomViewportAt(result, base, image, 1, anchor), base);
  assert.equal(zoomViewportAt(base, base, image, 100, anchor).width, 100);
  assert.equal(zoomViewportAt(base, base, image, -100, anchor).width, 3200);
  assert.deepEqual(zoomViewportAt(base, base, image, NaN, anchor), base);
});

test('camera aspect matches each surface at every zoom so native image and overlays cannot stretch', () => {
  for (const surface of [
    { width: 1200, height: 800 },
    { width: 390, height: 844 },
  ]) {
    const fit = fitPortraitViewport(image, surface, {
      right: 80,
      top: 60,
      bottom: 120,
    });
    for (const zoom of [0.25, 1, 3, 8]) {
      const camera = zoomViewportAt(fit, fit, image, zoom, { x: 250, y: 300 });
      assert.ok(
        Math.abs(
          camera.width / camera.height - surface.width / surface.height
        ) < 1e-10
      );
      const origin = clientToImage(
        { x: 0, y: 0 },
        { ...surface, left: 0, top: 0 },
        camera
      );
      const horizontal = clientToImage(
        { x: 100, y: 0 },
        { ...surface, left: 0, top: 0 },
        camera
      );
      const vertical = clientToImage(
        { x: 0, y: 100 },
        { ...surface, left: 0, top: 0 },
        camera
      );
      assert.ok(
        Math.abs(horizontal.x - origin.x - (vertical.y - origin.y)) < 1e-10
      );
    }
  }
});

test('client coordinates account for SVG meet letterboxing', () => {
  const element = { left: 10, top: 20, width: 600, height: 400 };
  assert.deepEqual(clientToImage({ x: 310, y: 220 }, element, base), {
    x: 500,
    y: 600,
  });
  assert.deepEqual(clientToImage({ x: 110, y: 20 }, element, base), {
    x: 100,
    y: 200,
  });
});

test('fitting a nonzero world region preserves its photo coordinates and canvas aspect', () => {
  const region = { x: 200, y: 300, width: 600, height: 200 };
  assert.deepEqual(
    fitPortraitViewport(image, { width: 390, height: 260 }, {}, region),
    {
      x: 200,
      y: 200,
      width: 600,
      height: 400,
    }
  );
  assert.deepEqual(
    fitPortraitViewport(image, image, {}, { ...region, width: 0 }),
    {
      x: 0,
      y: 0,
      width: 1000,
      height: 1200,
    }
  );
});

test('brow focus contains both complete brow bands and the eyes under portrait roll', () => {
  for (const roll of [0, 0.4]) {
    const frame = createFrame(
      { x: 300, y: 500 - roll * 200 },
      { x: 700, y: 500 + roll * 200 }
    );
    const analysis: BrowAnalysis = {
      ...image,
      frame,
      guides: [],
      landmarks: [],
      recommendations: ['natural'],
      reason: 'balanced',
      observed: ([-1, 1] as const).map((side) => {
        const samples = [0.18, 0.3, 0.42, 0.52, 0.6].map((x, i) => ({
          x: side * x,
          y: [-0.2, -0.25, -0.27, -0.25, -0.22][i],
        }));
        return {
          side,
          head: samples[0],
          arch: samples[2],
          tail: samples[4],
          thickness: 0.04,
          samples,
          widths: [0.04, 0.04, 0.04, 0.04, 0.02],
          nose: { x: side * 0.12, y: 0.3 },
          outerEye: { x: side * 0.5, y: 0 },
          irisOuter: { x: side * 0.3, y: 0 },
        };
      }),
    };
    const region = browFocusRegion(analysis, image);
    assert.ok(
      region.height < image.height / 2,
      'focus must not include the full face and chin'
    );
    assert.ok(region.y >= 0 && region.x >= 0);
    assert.ok(
      region.x + region.width <= image.width &&
        region.y + region.height <= image.height
    );
    const inside = (p: { x: number; y: number }) => {
      const q = frame.toImage(p);
      assert.ok(
        q.x >= region.x &&
          q.x <= region.x + region.width &&
          q.y >= region.y &&
          q.y <= region.y + region.height
      );
    };
    for (const brow of analysis.observed) {
      brow.samples.forEach((p, i) => {
        inside({ x: p.x, y: p.y - brow.widths![i] / 2 });
        inside({ x: p.x, y: p.y + brow.widths![i] / 2 });
      });
      inside({ x: brow.outerEye.x, y: brow.outerEye.y + 0.05 });
    }
  }
});
