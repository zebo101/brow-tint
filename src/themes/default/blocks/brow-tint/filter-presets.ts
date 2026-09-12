import type {
  BrowAnalysis,
  BrowControls,
} from '@/shared/lib/brow-mapping/types';

// UI preset for the existing anchor adjustment API; no engine changes.
export function straightBrowControls(
  analysis: BrowAnalysis
): Partial<BrowControls> {
  const controls: Partial<BrowControls> = { anchorOffsets: {} };
  for (const brow of analysis.observed) {
    const fraction = (brow.arch.x - brow.head.x) / (brow.tail.x - brow.head.x);
    const line = brow.head.y + (brow.tail.y - brow.head.y) * fraction;
    controls.anchorOffsets![brow.side === -1 ? 'left' : 'right'] = {
      arch: { x: 0, y: line - brow.arch.y },
    };
  }
  return controls;
}
