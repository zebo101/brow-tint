import type { BrowAnalysis, BrowCandidate, BrowReport } from './types';

/** Photo pixels, not physical millimetres or an attractiveness score.
 * Length is the five-station centerline polyline; height/gap use the eye frame.
 */
export function measureBrows(
  analysis: BrowAnalysis,
  candidate?: BrowCandidate
): BrowReport {
  const { frame } = analysis;
  const brows = analysis.observed.map((observed, i) => {
    const brow = candidate?.brows[i];
    const samples = brow ? brow.samples.map(frame.toLocal) : observed.samples;
    const head = brow ? frame.toLocal(brow.head) : observed.head;
    const arch = brow ? frame.toLocal(brow.arch) : observed.arch;
    return {
      head,
      arch,
      measurement: {
        length:
          samples
            .slice(1)
            .reduce(
              (sum, p, j) =>
                sum + Math.hypot(p.x - samples[j].x, p.y - samples[j].y),
              0
            ) * frame.scale,
        archRise: (head.y - arch.y) * frame.scale,
        thickness: brow?.thickness ?? observed.thickness * frame.scale,
      },
    };
  });
  const [left, right] = brows;
  return {
    unit: 'px',
    eyeSpan: frame.scale,
    headGap: Math.abs(right.head.x - left.head.x) * frame.scale,
    archHeightDifference: Math.abs(left.arch.y - right.arch.y) * frame.scale,
    lengthDifference: Math.abs(
      left.measurement.length - right.measurement.length
    ),
    left: left.measurement,
    right: right.measurement,
  };
}
