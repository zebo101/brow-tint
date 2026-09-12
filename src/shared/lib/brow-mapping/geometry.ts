import type { Frame, Point } from './types';

export const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
export const mix = (a: number, b: number, weight: number) =>
  a + (b - a) * weight;
export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export function intersection(
  a: Point,
  b: Point,
  c: Point,
  d: Point
): Point | null {
  const rx = b.x - a.x,
    ry = b.y - a.y;
  const sx = d.x - c.x,
    sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-10) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

export function createFrame(left: Point, right: Point): Frame {
  const scale = Math.hypot(right.x - left.x, right.y - left.y);
  if (!Number.isFinite(scale) || scale < 1e-8) throw new Error('geometry');
  const x = (right.x - left.x) / scale,
    y = (right.y - left.y) / scale;
  const origin = midpoint(left, right);
  return {
    scale,
    toLocal: (p) => ({
      x: ((p.x - origin.x) * x + (p.y - origin.y) * y) / scale,
      y: (-(p.x - origin.x) * y + (p.y - origin.y) * x) / scale,
    }),
    toImage: (p) => ({
      x: origin.x + scale * (p.x * x - p.y * y),
      y: origin.y + scale * (p.x * y + p.y * x),
    }),
  };
}

/** Closed two-segment contour. Controls have monotone x to avoid loops. */
export function contourPath(
  head: Point,
  arch: Point,
  tail: Point,
  thickness: number,
  frame: Frame
): string {
  const hTop = { x: head.x, y: head.y - thickness * 0.48 };
  const hBottom = { x: head.x, y: head.y + thickness * 0.52 };
  const aTop = { x: arch.x, y: arch.y - thickness * 0.38 };
  const aBottom = { x: arch.x, y: arch.y + thickness * 0.38 };
  const point = (p: Point) => {
    const q = frame.toImage(p);
    return `${q.x.toFixed(3)} ${q.y.toFixed(3)}`;
  };
  const controls = (from: Point, to: Point) => [
    { x: mix(from.x, to.x, 0.4), y: from.y },
    { x: mix(from.x, to.x, 0.72), y: to.y },
  ];
  const curve = (from: Point, to: Point) => {
    const [a, b] = controls(from, to);
    return `C ${point(a)} ${point(b)} ${point(to)}`;
  };
  return `M ${point(hTop)} ${curve(hTop, aTop)} ${curve(aTop, tail)} ${curve(tail, aBottom)} ${curve(aBottom, hBottom)} Q ${point({ x: head.x + (head.x - tail.x) * 0.012, y: head.y })} ${point(hTop)} Z`;
}

/**
 * Interpolate every measured station. Both edges share the same monotone x
 * parameter and centerline, with a positive linearly varying width. Thus
 * neither edge can loop or cross the other, including after an affine move.
 */
export function sampledContourPath(
  samples: Point[],
  widths: number[],
  frame: Frame,
  edgeOffsets?: Point[]
): string {
  const slopes = samples
    .slice(1)
    .map((p, i) => (p.y - samples[i].y) / (p.x - samples[i].x));
  const tangents = samples.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === samples.length - 1) return slopes[i - 1];
    const a = slopes[i - 1],
      b = slopes[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  const point = (p: Point) => {
    const q = frame.toImage(p);
    return `${q.x.toFixed(3)} ${q.y.toFixed(3)}`;
  };
  const edges = [-1, 1].map((edge) =>
    samples.slice(1).map((p, i) => {
      const previous = samples[i];
      const dx = (p.x - previous.x) / 3;
      const a = edgeOffsets?.[i] ?? { x: 0, y: widths[i] / 2 };
      const b = edgeOffsets?.[i + 1] ?? { x: 0, y: widths[i + 1] / 2 };
      return [
        { x: previous.x + edge * a.x, y: previous.y + edge * a.y },
        {
          x: previous.x + dx + edge * mix(a.x, b.x, 1 / 3),
          y: previous.y + dx * tangents[i] + edge * mix(a.y, b.y, 1 / 3),
        },
        {
          x: p.x - dx + edge * mix(a.x, b.x, 2 / 3),
          y: p.y - dx * tangents[i + 1] + edge * mix(a.y, b.y, 2 / 3),
        },
        { x: p.x + edge * b.x, y: p.y + edge * b.y },
      ];
    })
  );
  const top = edges[0],
    bottom = edges[1];
  const forward = top
    .map((segment) => `C ${segment.slice(1).map(point).join(' ')}`)
    .join(' ');
  const reverse = bottom
    .slice()
    .reverse()
    .map(
      (segment) =>
        `C ${[segment[2], segment[1], segment[0]].map(point).join(' ')}`
    )
    .join(' ');
  return `M ${point(top[0][0])} ${forward} L ${point(bottom[bottom.length - 1][3])} ${reverse} Z`;
}
