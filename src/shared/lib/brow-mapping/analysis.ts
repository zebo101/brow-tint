import {
  clamp,
  createFrame,
  intersection,
  midpoint,
  sampledContourPath,
} from './geometry';
import type {
  BrowAdjustments,
  BrowAnalysis,
  BrowAnchorTarget,
  BrowCandidate,
  BrowControls,
  BrowStyle,
  Guide,
  Landmark,
  ObservedBrow,
  Point,
} from './types';

// MediaPipe Face Landmarker topology; names refer to image sides, not subject sides.
const SIDES = [
  {
    side: -1 as const,
    top: [107, 66, 105, 63, 70],
    bottom: [55, 65, 52, 53, 46],
    nose: 98,
    outer: 33,
    inner: 133,
    iris: [469, 471],
    upper: 159,
    lower: 145,
  },
  {
    side: 1 as const,
    top: [336, 296, 334, 293, 300],
    bottom: [285, 295, 282, 283, 276],
    nose: 327,
    outer: 263,
    inner: 362,
    iris: [474, 476],
    upper: 386,
    lower: 374,
  },
];

/** All rules operate in an eye-aligned, scale-free frame. No beauty probability. */
export function analyzeFace(
  faces: Landmark[][],
  width: number,
  height: number
): BrowAnalysis {
  if (!faces.length) throw new Error('no-face');
  if (faces.length !== 1) throw new Error('multiple-faces');
  const face = faces[0];
  if (
    face.length < 478 ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(width + height) ||
    face.some((p) => !Number.isFinite(p.x + p.y))
  )
    throw new Error('landmarks');
  const pixels = face.map((p) => ({ x: p.x * width, y: p.y * height }));
  const frame = createFrame(pixels[33], pixels[263]);
  if (frame.scale < 90 || frame.scale / Math.min(width, height) < 0.16)
    throw new Error('small-face');
  const local = pixels.map(frame.toLocal);
  // A strong lateral offset signals an unsuitable oblique portrait, not aesthetic asymmetry.
  if (Math.abs(local[1].x) > 0.14) throw new Error('front-facing');
  const observed: ObservedBrow[] = SIDES.map((config) => {
    const upper = local[config.upper],
      lower = local[config.lower];
    const eyeWidth = Math.abs(local[config.outer].x - local[config.inner].x);
    if (eyeWidth < 0.08 || (lower.y - upper.y) / eyeWidth < 0.085)
      throw new Error('eyes-open');
    const samples = config.top.map((id, i) =>
      midpoint(local[id], local[config.bottom[i]])
    );
    const widths = config.top.map((id, i) =>
      Math.abs(local[config.bottom[i]].y - local[id].y)
    );
    if (
      samples.some(
        (p, i) => i > 0 && config.side * (p.x - samples[i - 1].x) <= 0.001
      )
    )
      throw new Error('brows-visible');
    const head = samples[0],
      tail = samples[4];
    const arch = samples.slice(1, 4).reduce((a, b) => (b.y < a.y ? b : a));
    // Exclude the tapering tip from the body-width measurement.
    const thickness =
      widths.slice(0, 4).reduce((sum, width) => sum + width, 0) / 4;
    if (Math.abs(tail.x - head.x) < 0.18 || head.y > -0.015 || arch.y > -0.025)
      throw new Error('brows-visible');
    return {
      side: config.side,
      head,
      arch,
      tail,
      thickness,
      nose: local[config.nose],
      outerEye: local[config.outer],
      irisOuter: config.iris
        .map((id) => local[id])
        .reduce((a, b) => (config.side * a.x > config.side * b.x ? a : b)),
      samples,
      widths,
      edgeOffsets: config.top.map((id, i) => ({
        x: (local[config.bottom[i]].x - local[id].x) / 2,
        y: (local[config.bottom[i]].y - local[id].y) / 2,
      })),
    };
  });
  const guides: Guide[] = [];
  const line = (id: string, stage: number, from: Point, to: Point) =>
    guides.push({
      id,
      stage,
      from: frame.toImage(from),
      to: frame.toImage(to),
    });
  const browTop = Math.min(...observed.map((b) => b.arch.y - b.thickness));
  const top = Math.max(local[10].y, browTop - 0.22);
  // The nose tip projects sideways with yaw. Use the projected forehead and
  // nose-base midpoint for the facial meridian, not x=0 in the eye frame.
  const noseBase = midpoint(observed[0].nose, observed[1].nose);
  const axisHeight = noseBase.y - local[10].y;
  const axisSlope =
    axisHeight > 0.1 ? (noseBase.x - local[10].x) / axisHeight : 0;
  const atTop = (anchor: Point): Point => ({
    x: anchor.x + (top - anchor.y) * axisSlope,
    y: top,
  });
  line('center', 1, atTop(noseBase), noseBase);
  for (const b of observed) {
    line(`head-${b.side}`, 2, { x: b.nose.x, y: b.nose.y }, atTop(b.nose));
    for (const [name, stage, via] of [
      ['arch', 3, b.irisOuter],
      ['tail', 4, b.outerEye],
    ] as const) {
      const end = intersection(
        b.nose,
        via,
        { x: -2, y: b.arch.y },
        { x: 2, y: b.arch.y }
      );
      if (end)
        line(`${name}-${b.side}`, stage, b.nose, {
          x: clamp(end.x, -0.85, 0.85),
          y: end.y,
        });
    }
  }
  const left = observed[0],
    right = observed[1];
  line('arch-level', 5, left.arch, right.arch);
  line('head-level', 5, left.head, right.head);
  line('tail-level', 5, left.tail, right.tail);
  // Join each observed arch to the opposite nose-wing/head meridian at the
  // shared upper reference. These measured anchors give an inspectable X in
  // the forehead, even when the original brows have almost flat arch slopes.
  for (const [a, b] of [
    [left, right],
    [right, left],
  ]) {
    line(`cross-${a.side}`, 5, a.arch, atTop(b.nose));
  }
  const aspect =
    (local[152].y - local[10].y) / Math.abs(local[454].x - local[234].x);
  const archRise = observed.reduce((s, b) => s + b.head.y - b.arch.y, 0) / 2;
  const reason =
    aspect > 1.55 ? 'elongated' : archRise < 0.055 ? 'low-arch' : 'balanced';
  const recommendations: BrowStyle[] =
    reason === 'elongated'
      ? ['soft', 'natural', 'lifted']
      : reason === 'low-arch'
        ? ['lifted', 'natural', 'soft']
        : ['natural', 'soft', 'lifted'];
  return {
    width,
    height,
    frame,
    observed,
    guides,
    landmarks: SIDES.flatMap((s) => [s.outer, s.inner, s.nose]).map(
      (id) => pixels[id]
    ),
    recommendations,
    reason,
  };
}

const finite = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) ? value : fallback;

function normalizeControls(
  controls: Partial<BrowAdjustments>
): BrowAdjustments {
  return {
    thickness: clamp(finite(controls.thickness, 1), 0.75, 1.25),
    arch: clamp(finite(controls.arch, 0), -0.025, 0.025),
    length: clamp(finite(controls.length, 1), 0.85, 1.15),
    vertical: clamp(finite(controls.vertical, 0), -0.04, 0.04),
    spacing: clamp(finite(controls.spacing, 0), -0.035, 0.035),
    rotation: clamp(finite(controls.rotation, 0), -8, 8),
  };
}

export function buildCandidate(
  analysis: BrowAnalysis,
  id: BrowStyle,
  controls: Partial<BrowControls> = {}
): BrowCandidate {
  const settings = normalizeControls(controls);
  const brows = analysis.observed.map((b) => {
    const correction = normalizeControls(
      (b.side === -1 ? controls.left : controls.right) ?? {}
    );
    const adjusted = normalizeControls({
      thickness: settings.thickness * correction.thickness,
      length: settings.length * correction.length,
      arch: settings.arch + correction.arch,
      vertical: settings.vertical + correction.vertical,
      spacing: settings.spacing + correction.spacing,
      rotation: settings.rotation + correction.rotation,
    });
    const span = b.tail.x - b.head.x;
    const archFraction = (b.arch.x - b.head.x) / span;
    const side = b.side === -1 ? 'left' : 'right';
    const manual = controls.anchorOffsets?.[side];
    const maxX =
      Math.min(Math.abs(b.arch.x - b.head.x), Math.abs(b.tail.x - b.arch.x)) *
      adjusted.length *
      0.3;
    const offsets = (['head', 'arch', 'tail'] as const).map((key) => ({
      x: clamp(finite(manual?.[key]?.x, 0), -maxX, maxX),
      y: clamp(finite(manual?.[key]?.y, 0), -0.08, 0.08),
    }));
    const rise = b.head.y - b.arch.y;
    const styleRise =
      id === 'soft'
        ? -Math.max(0, rise) * 0.35
        : id === 'lifted'
          ? Math.max(0, rise) * 0.18 + 0.012
          : 0;
    const samples = b.samples.map((p) => {
      const t = clamp((p.x - b.head.x) / span, 0, 1);
      // Piecewise smooth arch influence is zero at head/tail and one at the observed arch.
      const phase =
        t <= archFraction ? t / archFraction : (1 - t) / (1 - archFraction);
      const weight = phase * phase * (3 - 2 * phase);
      const segment = t <= archFraction ? 0 : 1;
      const fraction =
        segment === 0
          ? t / archFraction
          : (t - archFraction) / (1 - archFraction);
      const offset = {
        x:
          offsets[segment].x * (1 - fraction) +
          offsets[segment + 1].x * fraction,
        y:
          offsets[segment].y * (1 - fraction) +
          offsets[segment + 1].y * fraction,
      };
      return {
        x: b.head.x + (p.x - b.head.x) * adjusted.length + offset.x,
        y: p.y - (styleRise + adjusted.arch) * weight + offset.y,
      };
    });
    const angle = (-b.side * adjusted.rotation * Math.PI) / 180;
    const transform = (p: Point): Point => ({
      x:
        b.head.x +
        (p.x - b.head.x) * Math.cos(angle) -
        (p.y - b.head.y) * Math.sin(angle) +
        b.side * adjusted.spacing,
      y:
        b.head.y +
        (p.x - b.head.x) * Math.sin(angle) +
        (p.y - b.head.y) * Math.cos(angle) +
        adjusted.vertical,
    });
    const widths = (b.widths ?? b.samples.map(() => b.thickness)).map(
      (width) => Math.max(width, 0.002) * adjusted.thickness
    );
    const imageSamples = samples.map((p) =>
      analysis.frame.toImage(transform(p))
    );
    const archIndex = b.samples.indexOf(b.arch);
    return {
      head: imageSamples[0],
      arch: imageSamples[archIndex < 0 ? 2 : archIndex],
      tail: imageSamples[imageSamples.length - 1],
      thickness: b.thickness * adjusted.thickness * analysis.frame.scale,
      samples: imageSamples,
      path: sampledContourPath(
        samples,
        widths,
        {
          ...analysis.frame,
          toImage: (p) => analysis.frame.toImage(transform(p)),
        },
        b.edgeOffsets?.map((offset) => ({
          x: offset.x * adjusted.thickness * adjusted.length,
          y: offset.y * adjusted.thickness,
        }))
      ),
    };
  });
  return {
    id,
    controls: {
      ...settings,
      ...(controls.left ? { left: normalizeControls(controls.left) } : {}),
      ...(controls.right ? { right: normalizeControls(controls.right) } : {}),
      ...(controls.anchorOffsets
        ? { anchorOffsets: controls.anchorOffsets }
        : {}),
    },
    brows,
  };
}

/** Move one anchor to a photo-pixel position without moving the camera or the other anchors. */
export function moveCandidateAnchor(
  analysis: BrowAnalysis,
  style: BrowStyle,
  controls: Partial<BrowControls>,
  target: BrowAnchorTarget,
  position: Point
): Partial<BrowControls> {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y))
    return controls;
  const sideIndex = target.side === 'left' ? 0 : 1;
  const observed = analysis.observed[sideIndex];
  const candidate = buildCandidate(analysis, style, controls).brows[sideIndex];
  const from = analysis.frame.toLocal(candidate[target.point]);
  const to = analysis.frame.toLocal(position);
  const settings = normalizeControls(controls);
  const correction = normalizeControls(controls[target.side] ?? {});
  const rotation = clamp(settings.rotation + correction.rotation, -8, 8);
  const angle = (-observed.side * rotation * Math.PI) / 180;
  const length = clamp(settings.length * correction.length, 0.85, 1.15);
  const maxX =
    Math.min(
      Math.abs(observed.arch.x - observed.head.x),
      Math.abs(observed.tail.x - observed.arch.x)
    ) *
    length *
    0.3;
  const previous = controls.anchorOffsets?.[target.side]?.[target.point];
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const offset = {
    x: clamp(
      clamp(finite(previous?.x, 0), -maxX, maxX) +
        dx * Math.cos(angle) +
        dy * Math.sin(angle),
      -maxX,
      maxX
    ),
    y: clamp(
      clamp(finite(previous?.y, 0), -0.08, 0.08) -
        dx * Math.sin(angle) +
        dy * Math.cos(angle),
      -0.08,
      0.08
    ),
  };
  return {
    ...controls,
    anchorOffsets: {
      ...controls.anchorOffsets,
      [target.side]: {
        ...controls.anchorOffsets?.[target.side],
        [target.point]: offset,
      },
    },
  };
}
