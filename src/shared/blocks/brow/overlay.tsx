'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useLocale } from 'next-intl';

import type { BrowPhoto } from '@/shared/lib/brow-mapping/detector';
import type {
  BrowAnalysis,
  BrowCandidate,
} from '@/shared/lib/brow-mapping/types';

import { browText } from './copy';

export function BrowOverlay({
  photo,
  analysis,
  candidate,
  stage,
  original,
  replay,
}: {
  photo: BrowPhoto;
  analysis: BrowAnalysis | null;
  candidate: BrowCandidate | null;
  stage: number;
  original: boolean;
  replay: number;
}) {
  const reduced = useReducedMotion();
  const locale = useLocale();
  return (
    <svg
      viewBox={`0 0 ${photo.width} ${photo.height}`}
      className="block max-h-[680px] w-full"
      role="img"
      aria-label={
        original
          ? browText(locale, 'Original portrait', '原始人像')
          : browText(locale, 'Brow mapping portrait', '眉形定位分析图')
      }
    >
      <image href={photo.url} width={photo.width} height={photo.height} />
      {!original && analysis && (
        <g
          fill="none"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0px 1px 1px rgb(0 0 0 / 0.35))' }}
        >
          {analysis.landmarks.map((point, i) => (
            <circle
              key={`point-${i}`}
              cx={point.x}
              cy={point.y}
              r={photo.width / 260}
              fill="white"
              stroke="none"
            />
          ))}
          {analysis.guides
            .filter((guide) => guide.stage <= stage)
            .map((guide) => (
              <motion.path
                key={`${replay}-${guide.id}`}
                d={`M ${guide.from.x} ${guide.from.y} L ${guide.to.x} ${guide.to.y}`}
                vectorEffect="non-scaling-stroke"
                strokeWidth={1}
                opacity={0.85}
                initial={{ pathLength: reduced ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduced ? 0 : 0.6 }}
              />
            ))}
          {stage >= 6 &&
            candidate?.brows.map((brow, i) => (
              <motion.path
                key={`${replay}-brow-${i}`}
                initial={{ d: brow.path, pathLength: reduced ? 1 : 0 }}
                animate={{ d: brow.path, pathLength: 1 }}
                transition={{
                  d: { duration: reduced ? 0 : 0.3 },
                  pathLength: { duration: reduced ? 0 : 0.65 },
                }}
                vectorEffect="non-scaling-stroke"
                strokeWidth={1.8}
              />
            ))}
        </g>
      )}
    </svg>
  );
}
