export type Point = { x: number; y: number };
export type BrowAnchorKey = 'head' | 'arch' | 'tail';
export type BrowAnchorTarget = { side: 'left' | 'right'; point: BrowAnchorKey };
export type BrowAnchorOffsets = Partial<
  Record<'left' | 'right', Partial<Record<BrowAnchorKey, Point>>>
>;
export type Landmark = Point & { z?: number };
export type BrowStyle = 'natural' | 'soft' | 'lifted';
export type BrowAdjustments = {
  thickness: number;
  arch: number;
  length: number;
  vertical: number;
  spacing: number;
  rotation: number;
};
/** Distances use eye-span units; positive rotation raises the outer tail. */
export type BrowControls = Pick<BrowAdjustments, 'thickness' | 'arch'> &
  Partial<Omit<BrowAdjustments, 'thickness' | 'arch'>> & {
    /** Image sides, not the subject's anatomical sides. */
    left?: Partial<BrowAdjustments>;
    right?: Partial<BrowAdjustments>;
    /** Manual corrections in the eye frame, before the per-brow rotation. */
    anchorOffsets?: BrowAnchorOffsets;
  };
export type Frame = {
  scale: number;
  toLocal: (point: Point) => Point;
  toImage: (point: Point) => Point;
};
export type BrowAnchors = {
  head: Point;
  arch: Point;
  tail: Point;
  thickness: number;
};
export type ObservedBrow = BrowAnchors & {
  side: -1 | 1;
  nose: Point;
  outerEye: Point;
  irisOuter: Point;
  samples: Point[];
  widths?: number[];
  /** Half-vectors from the observed upper edge to the lower edge in the eye frame. */
  edgeOffsets?: Point[];
};
export type Guide = { id: string; stage: number; from: Point; to: Point };
export type BrowAnalysis = {
  width: number;
  height: number;
  frame: Frame;
  observed: ObservedBrow[];
  guides: Guide[];
  landmarks: Point[];
  recommendations: BrowStyle[];
  reason: 'elongated' | 'low-arch' | 'balanced';
};
export type BrowCandidate = {
  id: BrowStyle;
  controls: BrowControls;
  brows: (BrowAnchors & { path: string; samples: Point[] })[];
};

export type BrowMeasurement = {
  length: number;
  archRise: number;
  thickness: number;
};
export type BrowReport = {
  unit: 'px';
  eyeSpan: number;
  headGap: number;
  archHeightDifference: number;
  lengthDifference: number;
  left: BrowMeasurement;
  right: BrowMeasurement;
};
