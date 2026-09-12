import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  analyzeFace,
  buildCandidate,
  moveCandidateAnchor,
} from '../src/shared/lib/brow-mapping/analysis';
import {
  createFrame,
  intersection,
} from '../src/shared/lib/brow-mapping/geometry';

test('moving an individual anchor preserves the other anchors and opposite brow', () => {
  const analysis = analyzeFace([face()], 1000, 1000);
  const settings = { rotation: 5, length: 1.08, right: { vertical: 0.01 } };
  const before = buildCandidate(analysis, 'soft', settings);
  for (const point of ['head', 'arch', 'tail'] as const) {
    const target = { side: 'left', point } as const;
    const old = before.brows[0][point];
    const desired = { x: old.x + 2, y: old.y - 3 };
    const controls = moveCandidateAnchor(
      analysis,
      'soft',
      settings,
      target,
      desired
    );
    const after = buildCandidate(analysis, 'soft', controls);
    assert.ok(
      Math.hypot(
        after.brows[0][point].x - desired.x,
        after.brows[0][point].y - desired.y
      ) < 0.001
    );
    assert.deepEqual(after.brows[1], before.brows[1]);
    for (const other of ['head', 'arch', 'tail'] as const)
      if (other !== point)
        assert.deepEqual(after.brows[0][other], before.brows[0][other]);
    assert.notEqual(after.brows[0].path, before.brows[0].path);
    assert.equal(
      buildCandidate(analysis, 'soft', {
        ...controls,
        anchorOffsets: undefined,
      }).brows[0].path,
      before.brows[0].path
    );
  }
});

test('anchor moves use image pixels even on a rolled portrait with rotated brows', () => {
  const angle = 0.2;
  const rolled = face().map((p) => ({
    ...p,
    x: 0.5 + (p.x - 0.5) * Math.cos(angle) - (p.y - 0.5) * Math.sin(angle),
    y: 0.5 + (p.x - 0.5) * Math.sin(angle) + (p.y - 0.5) * Math.cos(angle),
  }));
  const analysis = analyzeFace([rolled], 1000, 1000);
  const controls = { rotation: -6 };
  const old = buildCandidate(analysis, 'lifted', controls).brows[1].arch;
  const point = { x: old.x + 1, y: old.y - 2 };
  const updated = moveCandidateAnchor(
    analysis,
    'lifted',
    controls,
    { side: 'right', point: 'arch' },
    point
  );
  const result = buildCandidate(analysis, 'lifted', updated).brows[1].arch;
  assert.ok(Math.hypot(point.x - result.x, point.y - result.y) < 0.001);
});

test('anchor corrections reject nonfinite input and cannot reverse brow stations', () => {
  const analysis = analyzeFace([face()], 1000, 1000);
  const settings = {};
  assert.equal(
    moveCandidateAnchor(
      analysis,
      'natural',
      settings,
      { side: 'left', point: 'arch' },
      { x: NaN, y: 20 }
    ),
    settings
  );
  let controls = moveCandidateAnchor(
    analysis,
    'natural',
    {},
    { side: 'left', point: 'head' },
    { x: 99999, y: -9999 }
  );
  controls = moveCandidateAnchor(
    analysis,
    'natural',
    controls,
    { side: 'left', point: 'arch' },
    { x: -9999, y: 99999 }
  );
  const brow = buildCandidate(analysis, 'natural', controls).brows[0];
  assert.ok(!/NaN|Infinity/.test(brow.path));
  for (let i = 1; i < brow.samples.length; i++)
    assert.ok(brow.samples[i].x < brow.samples[i - 1].x);
});

// Independent synthetic portrait; these are test inputs, never a production fallback.
function face() {
  const p = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const put = (i: number, x: number, y: number) => (p[i] = { x, y, z: 0 });
  put(33, 0.25, 0.45);
  put(133, 0.43, 0.45);
  put(263, 0.75, 0.45);
  put(362, 0.57, 0.45);
  put(159, 0.34, 0.43);
  put(145, 0.34, 0.47);
  put(386, 0.66, 0.43);
  put(374, 0.66, 0.47);
  put(468, 0.34, 0.45);
  put(469, 0.36, 0.45);
  put(471, 0.32, 0.45);
  put(473, 0.66, 0.45);
  put(474, 0.68, 0.45);
  put(476, 0.64, 0.45);
  put(98, 0.44, 0.61);
  put(327, 0.56, 0.61);
  put(1, 0.5, 0.59);
  put(10, 0.5, 0.18);
  put(152, 0.5, 0.86);
  put(234, 0.19, 0.56);
  put(454, 0.81, 0.56);
  [70, 63, 105, 66, 107].forEach((id, i) =>
    put(id, 0.21 + i * 0.0525, [0.365, 0.33, 0.315, 0.33, 0.355][i])
  );
  [46, 53, 52, 65, 55].forEach((id, i) =>
    put(id, 0.21 + i * 0.0525, [0.37, 0.355, 0.35, 0.365, 0.395][i])
  );
  [300, 293, 334, 296, 336].forEach((id, i) =>
    put(id, 0.79 - i * 0.0525, [0.365, 0.33, 0.315, 0.33, 0.355][i])
  );
  [276, 283, 282, 295, 285].forEach((id, i) =>
    put(id, 0.79 - i * 0.0525, [0.37, 0.355, 0.35, 0.365, 0.395][i])
  );
  return p;
}

test('line intersections handle vertical lines and reject parallel lines', () => {
  assert.deepEqual(
    intersection(
      { x: 2, y: 0 },
      { x: 2, y: 3 },
      { x: 0, y: 1 },
      { x: 4, y: 1 }
    ),
    { x: 2, y: 1 }
  );
  assert.equal(
    intersection(
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 }
    ),
    null
  );
});

test('eye frame roundtrip does not mirror or lose roll', () => {
  const frame = createFrame({ x: 100, y: 150 }, { x: 300, y: 250 });
  const p = { x: 123, y: 89 };
  const restored = frame.toImage(frame.toLocal(p));
  assert.ok(Math.hypot(restored.x - p.x, restored.y - p.y) < 1e-8);
  assert.ok(frame.toLocal({ x: 300, y: 250 }).x > 0);
});

test('mapping is equivariant under portrait rotation and uniform scaling', () => {
  const input = face();
  const a = analyzeFace([input], 1000, 1000);
  const angle = 0.17,
    scale = 1.15;
  const transform = (p: { x: number; y: number }) => ({
    x:
      0.5 +
      scale * ((p.x - 0.5) * Math.cos(angle) - (p.y - 0.5) * Math.sin(angle)),
    y:
      0.5 +
      scale * ((p.x - 0.5) * Math.sin(angle) + (p.y - 0.5) * Math.cos(angle)),
    z: 0,
  });
  const b = analyzeFace([input.map(transform)], 1000, 1000);
  const targetA = buildCandidate(a, 'natural');
  const targetB = buildCandidate(b, 'natural');
  targetA.brows.forEach((brow, i) => {
    const expected = transform({
      x: brow.arch.x / 1000,
      y: brow.arch.y / 1000,
    });
    assert.ok(
      Math.hypot(
        expected.x * 1000 - targetB.brows[i].arch.x,
        expected.y * 1000 - targetB.brows[i].arch.y
      ) < 1e-6
    );
  });
  assert.deepEqual(a.recommendations, b.recommendations);
});

test('rejects no face, multiple faces, incomplete landmarks and degenerate geometry', () => {
  assert.throws(() => analyzeFace([], 1000, 1000), /no-face/);
  assert.throws(
    () => analyzeFace([face(), face()], 1000, 1000),
    /multiple-faces/
  );
  assert.throws(() => analyzeFace([[{ x: 0, y: 0 }]], 1000, 1000), /landmarks/);
  assert.throws(
    () =>
      analyzeFace(
        [Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))],
        1000,
        1000
      ),
    /small-face|geometry/
  );
  const invalid = face();
  invalid[98].x = NaN;
  assert.throws(() => analyzeFace([invalid], 1000, 1000), /landmarks/);
});

test('portrait and landscape image dimensions preserve the same pixel geometry', () => {
  const square = analyzeFace([face()], 1000, 1000);
  const rectangular = analyzeFace(
    [face().map((p) => ({ ...p, x: p.x / 1.4 }))],
    1400,
    1000
  );
  const first = buildCandidate(square, 'soft');
  const second = buildCandidate(rectangular, 'soft');
  first.brows.forEach((brow, i) => {
    assert.equal(brow.path, second.brows[i].path);
    for (const anchor of ['head', 'arch', 'tail'] as const) {
      assert.ok(
        Math.hypot(
          brow[anchor].x - second.brows[i][anchor].x,
          brow[anchor].y - second.brows[i][anchor].y
        ) < 1e-8
      );
    }
  });
  square.guides.forEach((guide, i) => {
    for (const point of ['from', 'to'] as const)
      assert.ok(
        Math.hypot(
          guide[point].x - rectangular.guides[i][point].x,
          guide[point].y - rectangular.guides[i][point].y
        ) < 1e-8
      );
  });
});

test('closed eyes and strongly turned portraits ask for a better photo', () => {
  const closed = face();
  closed[159].y = closed[145].y;
  assert.throws(() => analyzeFace([closed], 1000, 1000), /eyes-open/);
  const turned = face();
  turned[1].x = 0.65;
  assert.throws(() => analyzeFace([turned], 1000, 1000), /front-facing/);
});

test('three distinct candidates stay finite and thickness controls real contours', () => {
  const analysis = analyzeFace([face()], 1000, 1000);
  assert.equal(new Set(analysis.recommendations).size, 3);
  const natural = buildCandidate(analysis, 'natural');
  const lifted = buildCandidate(analysis, 'lifted');
  assert.ok(lifted.brows[0].arch.y < natural.brows[0].arch.y);
  assert.notEqual(
    buildCandidate(analysis, 'natural', { thickness: 1.2, arch: 0 }).brows[0]
      .path,
    natural.brows[0].path
  );
  for (const id of analysis.recommendations) {
    const c = buildCandidate(analysis, id);
    assert.equal(c.brows.length, 2);
    for (const brow of c.brows) {
      assert.ok(!/NaN|Infinity/.test(brow.path));
      assert.match(brow.path, /Z$/);
      assert.ok(brow.head.y < 450);
    }
  }
});

test('cross-check rays meet above the brows between opposite head reference lines', () => {
  const analysis = analyzeFace([face()], 1000, 1000);
  const cross = analysis.guides.filter((guide) =>
    guide.id.startsWith('cross-')
  );
  assert.equal(cross.length, 2);
  const meeting = intersection(
    cross[0].from,
    cross[0].to,
    cross[1].from,
    cross[1].to
  );
  assert.ok(meeting);
  assert.ok(
    meeting.y < 315,
    'the check belongs in the forehead, above the brow arches'
  );
  assert.ok(meeting.x > 440 && meeting.x < 560);
  assert.equal(cross[0].from.x, 315);
  assert.equal(cross[1].from.x, 685);
  assert.equal(cross[0].to.x, 560);
  assert.equal(cross[1].to.x, 440);
});

test('natural fitting preserves all five observed stations and a naturally descending tail', () => {
  const input = face();
  input[70].y = 0.405;
  input[46].y = 0.415;
  const analysis = analyzeFace([input], 1000, 1000);
  const candidate = buildCandidate(analysis, 'natural');
  assert.equal(candidate.brows[0].tail.y, 410);
  assert.equal(candidate.brows[0].head.x, 420);
  candidate.brows.forEach((brow, side) => {
    assert.equal(brow.samples.length, 5);
    brow.samples.forEach((sample, i) => {
      const expected = analysis.frame.toImage(
        analysis.observed[side].samples[i]
      );
      assert.ok(
        Math.hypot(sample.x - expected.x, sample.y - expected.y) < 1e-8
      );
    });
  });
});

test('oblique brow contours retain the horizontal offset of measured upper and lower edges', () => {
  const input = face();
  const top = [107, 66, 105, 63, 70];
  const bottom = [55, 65, 52, 53, 46];
  // A projected brow band is sheared: its two edges do not share x coordinates.
  top.forEach((id) => {
    input[id].x -= 0.008;
  });
  bottom.forEach((id) => {
    input[id].x += 0.008;
  });
  const candidate = buildCandidate(analyzeFace([input], 1000, 1000), 'natural');
  const outline = flattenPath(candidate.brows[0].path);
  for (let i = 0; i < 5; i++) {
    const upper = outline[i * 16];
    const lower = outline[65 + (4 - i) * 16];
    for (const [actual, expected] of [
      [upper, input[top[i]]],
      [lower, input[bottom[i]]],
    ]) {
      assert.ok(
        Math.hypot(actual.x - expected.x * 1000, actual.y - expected.y * 1000) <
          0.002,
        'natural outline must pass through the observed projected edge'
      );
    }
  }
});

test('reference meridians follow the projected face axis instead of a fixed eye midpoint', () => {
  const input = face();
  input[10].x = 0.52;
  input[98].x += 0.045;
  input[327].x += 0.045;
  input[1].x += 0.055;
  const analysis = analyzeFace([input], 1000, 1000);
  const center = analysis.guides.find((g) => g.id === 'center')!;
  assert.ok(Math.abs(center.to.x - 545) < 1e-6);
  assert.ok(Math.abs(center.to.y - 610) < 1e-6);
  const axis = { x: 25, y: 430 };
  for (const guide of analysis.guides.filter(
    (g) =>
      g.id === 'center' || (g.id.startsWith('head-') && g.id !== 'head-level')
  )) {
    const dx = guide.to.x - guide.from.x,
      dy = guide.to.y - guide.from.y;
    assert.ok(
      Math.abs(dx * axis.y - dy * axis.x) < 1e-5,
      'meridians must follow forehead-to-nose-base direction'
    );
  }
});

test('length, vertical, spacing and rotation move geometry with isolated side corrections', () => {
  const analysis = analyzeFace([face()], 1000, 1000);
  const original = buildCandidate(analysis, 'natural');
  const moved = buildCandidate(analysis, 'natural', {
    left: { length: 1.1, vertical: 0.02, spacing: 0.01 },
  });
  assert.deepEqual(moved.brows[1], original.brows[1]);
  assert.ok(Math.abs(moved.brows[0].head.x - 415) < 1e-8);
  assert.ok(Math.abs(moved.brows[0].head.y - 385) < 1e-8);
  assert.ok(Math.abs(moved.brows[0].tail.x - 184) < 1e-8);
  const rotated = buildCandidate(analysis, 'natural', { rotation: 5 });
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(rotated.brows[i].head, original.brows[i].head);
    assert.ok(rotated.brows[i].tail.y < original.brows[i].tail.y);
  }
});

test('untrusted control values stay finite and clamp before combining corrections', () => {
  const analysis = analyzeFace([face()], 1000, 1000);
  const baseline = buildCandidate(analysis, 'natural');
  assert.deepEqual(
    buildCandidate(analysis, 'natural', {
      arch: NaN,
      thickness: Infinity,
      length: -Infinity,
      vertical: NaN,
      spacing: Infinity,
      rotation: NaN,
    }).brows,
    baseline.brows
  );
  const huge = buildCandidate(analysis, 'natural', {
    length: 100,
    vertical: -100,
    spacing: 100,
    rotation: 100,
    left: { length: 100, arch: 100, thickness: -100 },
  });
  for (const brow of huge.brows) {
    assert.ok(!/NaN|Infinity/.test(brow.path));
    assert.ok(Math.abs(brow.tail.x - brow.head.x) > 100);
    assert.ok(brow.thickness > 0);
  }
});

test('measured report uses observed pixel distances and eye-aligned height differences', async () => {
  const { measureBrows } = await import(
    '../src/shared/lib/brow-mapping/report'
  );
  const analysis = analyzeFace([face()], 1000, 1000);
  const report = measureBrows(analysis);
  assert.equal(report.unit, 'px');
  assert.equal(report.eyeSpan, 500);
  assert.ok(Math.abs(report.headGap - 160) < 1e-8);
  assert.ok(report.archHeightDifference < 1e-8);
  assert.ok(report.lengthDifference < 1e-8);
  assert.ok(Math.abs(report.left.archRise - 42.5) < 1e-8);
  const edited = measureBrows(
    analysis,
    buildCandidate(analysis, 'natural', {
      left: { vertical: 0.02, spacing: 0.01 },
    })
  );
  assert.ok(Math.abs(edited.archHeightDifference - 10) < 1e-8);
  assert.ok(Math.abs(edited.headGap - 165) < 1e-8);
  assert.ok(Math.abs(edited.left.length - report.left.length) < 1e-8);
  const doubled = measureBrows(analyzeFace([face()], 2000, 2000));
  assert.ok(Math.abs(doubled.left.length - report.left.length * 2) < 1e-8);
});

test('thin measured brows are not inflated by a minimum aesthetic thickness', async () => {
  const { measureBrows } = await import(
    '../src/shared/lib/brow-mapping/report'
  );
  const input = face();
  [55, 65, 52, 53, 46].forEach((id, i) => {
    input[id].y = input[[107, 66, 105, 63, 70][i]].y + 0.005;
  });
  const analysis = analyzeFace([input], 1000, 1000);
  assert.ok(Math.abs(measureBrows(analysis).left.thickness - 5) < 1e-8);
  assert.ok(
    Math.abs(buildCandidate(analysis, 'natural').brows[0].thickness - 5) < 1e-8
  );
});

test('all adjusted stations and measured gaps follow portrait roll and scale', async () => {
  const { measureBrows } = await import(
    '../src/shared/lib/brow-mapping/report'
  );
  const angle = -0.31,
    scale = 1.12;
  const transform = (p: { x: number; y: number }) => ({
    x:
      500 +
      scale * ((p.x - 500) * Math.cos(angle) - (p.y - 500) * Math.sin(angle)),
    y:
      500 +
      scale * ((p.x - 500) * Math.sin(angle) + (p.y - 500) * Math.cos(angle)),
  });
  const original = analyzeFace([face()], 1000, 1000);
  const moved = analyzeFace(
    [
      face().map((p) => {
        const point = transform({ x: p.x * 1000, y: p.y * 1000 });
        return { x: point.x / 1000, y: point.y / 1000 };
      }),
    ],
    1000,
    1000
  );
  const controls = {
    arch: 0.02,
    rotation: 8,
    left: { length: 0.86, spacing: -0.03, vertical: -0.04 },
  };
  const a = buildCandidate(original, 'lifted', controls);
  const b = buildCandidate(moved, 'lifted', controls);
  a.brows.forEach((brow, i) =>
    brow.samples.forEach((p, j) => {
      const expected = transform(p);
      assert.ok(
        Math.hypot(
          expected.x - b.brows[i].samples[j].x,
          expected.y - b.brows[i].samples[j].y
        ) < 1e-8
      );
    })
  );
  const reportA = measureBrows(original, a),
    reportB = measureBrows(moved, b);
  for (const metric of [
    'headGap',
    'archHeightDifference',
    'lengthDifference',
  ] as const) {
    assert.ok(Math.abs(reportB[metric] - reportA[metric] * scale) < 1e-8);
  }
});

// Sample exported SVG cubics, then check nonadjacent edges for intersections.
// This exercises the actual export instead of a separate test-only contour.
function flattenPath(path: string) {
  const tokens = path.match(/[MLCZ]|-?\d+(?:\.\d+)?/g)!;
  const points: { x: number; y: number }[] = [];
  let i = 0;
  const point = () => ({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M' || command === 'L') points.push(point());
    else if (command === 'C') {
      const start = points.at(-1)!,
        a = point(),
        b = point(),
        end = point();
      for (let step = 1; step <= 16; step++) {
        const t = step / 16,
          s = 1 - t;
        points.push({
          x:
            s ** 3 * start.x +
            3 * s ** 2 * t * a.x +
            3 * s * t ** 2 * b.x +
            t ** 3 * end.x,
          y:
            s ** 3 * start.y +
            3 * s ** 2 * t * a.y +
            3 * s * t ** 2 * b.y +
            t ** 3 * end.y,
        });
      }
    } else assert.equal(command, 'Z');
  }
  return points;
}

test('extreme combined adjustments export closed nonintersecting contours without flipping sides', () => {
  const analysis = analyzeFace([face()], 1000, 1000);
  const cross = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number }
  ) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (const id of analysis.recommendations)
    for (const sign of [-1, 1]) {
      const candidate = buildCandidate(analysis, id, {
        thickness: 1 + sign * 100,
        arch: sign * 100,
        length: 1 + sign * 100,
        rotation: sign * 100,
        vertical: sign * 100,
        spacing: sign * 100,
        right: { rotation: -sign * 100, thickness: 1 - sign * 100 },
      });
      assert.ok(candidate.brows[0].head.x < candidate.brows[1].head.x);
      candidate.brows.forEach((brow, side) => {
        assert.ok((side === 0 ? -1 : 1) * (brow.tail.x - brow.head.x) > 0);
        assert.match(brow.path, /Z$/);
        const p = flattenPath(brow.path);
        for (let i = 0; i < p.length; i++)
          for (let j = i + 2; j < p.length; j++) {
            if (i === 0 && j === p.length - 1) continue;
            const a = p[i],
              b = p[(i + 1) % p.length],
              c = p[j],
              d = p[(j + 1) % p.length];
            assert.ok(
              !(
                cross(a, b, c) * cross(a, b, d) < 0 &&
                cross(c, d, a) * cross(c, d, b) < 0
              ),
              'exported contour must not intersect itself'
            );
          }
      });
    }
});
