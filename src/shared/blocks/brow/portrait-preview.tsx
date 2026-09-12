'use client';

import { useLocale } from 'next-intl';

import type { BrowPhoto } from '@/shared/lib/brow-mapping/detector';
import type {
  BrowAnalysis,
  BrowCandidate,
} from '@/shared/lib/brow-mapping/types';

import { browText } from './copy';
import { PortraitCanvas } from './portrait-canvas';

/** A borrowed, read-only snapshot. The mounted analysis hook owns its URL. */
export type BrowPreviewState = {
  photo: BrowPhoto | null;
  analysis: BrowAnalysis | null;
  candidate: BrowCandidate | null;
};

export function BrowPortraitPreview({
  preview,
  rawUrl,
  resultUrl,
  zh,
}: {
  preview: BrowPreviewState | null;
  rawUrl: string;
  resultUrl: string | null;
  zh: boolean;
}) {
  const locale = useLocale();
  if (resultUrl || !preview?.photo)
    return (
      <img
        src={resultUrl || rawUrl}
        alt={browText(locale, 'Your brow preview', '你的眉形预览')}
        className="h-full w-full object-contain"
      />
    );
  return (
    <div
      className="h-full w-full"
      style={{
        aspectRatio: `${preview.photo.width} / ${preview.photo.height}`,
      }}
    >
      <PortraitCanvas
        photo={preview.photo}
        analysis={preview.analysis}
        candidate={preview.candidate}
        view="contour"
        zoom={1}
        guideStage={6}
        resultUrl={null}
        split={50}
        zh={zh}
        fitInsets={{ left: 0, top: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
}
