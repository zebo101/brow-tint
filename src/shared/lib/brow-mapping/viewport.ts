import { clamp } from './geometry';
import type { BrowAnalysis, Point } from './types';

export type Viewport = Point & { width: number; height: number };
export type ImageBounds = { width: number; height: number };
export type FitInsets = {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
};

/** A world-space viewing region, never a crop or modification of the asset. */
export function browFocusRegion(
  analysis: BrowAnalysis,
  image: ImageBounds
): Viewport {
  const full = { x: 0, y: 0, ...image };
  if (!analysis.observed.length) return full;
  const band = analysis.observed.flatMap((brow) =>
    brow.samples.flatMap((p, i) => {
      const halfWidth = (brow.widths?.[i] ?? brow.thickness) / 2;
      return [
        { x: p.x, y: p.y - halfWidth },
        { x: p.x, y: p.y + halfWidth },
      ];
    })
  );
  const eyes = analysis.observed.flatMap((brow) => [
    brow.outerEye,
    brow.irisOuter,
  ]);
  const points = [...band, ...eyes];
  const left = Math.min(...points.map((p) => p.x)) - 0.12;
  const right = Math.max(...points.map((p) => p.x)) + 0.12;
  const top = Math.min(...band.map((p) => p.y)) - 0.22;
  const bottom = Math.max(
    Math.max(...eyes.map((p) => p.y)) + 0.16,
    Math.max(...band.map((p) => p.y)) + 0.12
  );
  // The local rectangle follows portrait roll; its image-space AABB contains
  // all four transformed corners, including the outer tails and eye margins.
  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: left, y: bottom },
    { x: right, y: bottom },
  ].map(analysis.frame.toImage);
  const x = clamp(Math.min(...corners.map((p) => p.x)), 0, image.width);
  const y = clamp(Math.min(...corners.map((p) => p.y)), 0, image.height);
  const width = clamp(Math.max(...corners.map((p) => p.x)), 0, image.width) - x;
  const height =
    clamp(Math.max(...corners.map((p) => p.y)), 0, image.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : full;
}

export function fitPortraitViewport(
  image: ImageBounds,
  surface: ImageBounds = image,
  insets: FitInsets = {},
  region?: Viewport
): Viewport {
  const target =
    region &&
    region.width > 0 &&
    region.height > 0 &&
    Number.isFinite(region.x + region.y + region.width + region.height)
      ? region
      : { x: 0, y: 0, ...image };
  const inset = (value: number | undefined) =>
    Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
  const left = Math.min(inset(insets.left), Math.max(0, surface.width - 1));
  const top = Math.min(inset(insets.top), Math.max(0, surface.height - 1));
  const safeWidth = Math.max(1, surface.width - left - inset(insets.right));
  const safeHeight = Math.max(1, surface.height - top - inset(insets.bottom));
  const scale = Math.min(safeWidth / target.width, safeHeight / target.height);
  return {
    x: target.x + target.width / 2 - (left + safeWidth / 2) / scale,
    y: target.y + target.height / 2 - (top + safeHeight / 2) / scale,
    width: surface.width / scale,
    height: surface.height / scale,
  };
}
export function panViewport(
  box: Viewport,
  _image: ImageBounds,
  delta: Point
): Viewport {
  return {
    ...box,
    x: box.x + (Number.isFinite(delta.x) ? delta.x : 0),
    y: box.y + (Number.isFinite(delta.y) ? delta.y : 0),
  };
}
export function zoomViewportAt(
  box: Viewport,
  base: Viewport,
  image: ImageBounds,
  zoom: number,
  anchor: Point
): Viewport {
  const bounded = clamp(Number.isFinite(zoom) ? zoom : 1, 0.25, 8);
  const width = base.width / bounded,
    height = base.height / bounded;
  const x = anchor.x - ((anchor.x - box.x) / box.width) * width;
  const y = anchor.y - ((anchor.y - box.y) / box.height) * height;
  return panViewport({ x, y, width, height }, image, { x: 0, y: 0 });
}
export function clientToImage(
  point: Point,
  element: { left: number; top: number; width: number; height: number },
  box: Viewport
): Point {
  const scale = Math.min(
    element.width / box.width,
    element.height / box.height
  );
  if (!(scale > 0))
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const left = element.left + (element.width - box.width * scale) / 2;
  const top = element.top + (element.height - box.height * scale) / 2;
  return {
    x: box.x + (point.x - left) / scale,
    y: box.y + (point.y - top) / scale,
  };
}
