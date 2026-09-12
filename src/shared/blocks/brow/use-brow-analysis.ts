'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  analyzeFace,
  buildCandidate,
  moveCandidateAnchor,
} from '@/shared/lib/brow-mapping/analysis';
import {
  detectPhoto,
  exportBrowPhoto,
  normalizePhoto,
  type BrowPhoto,
  type DetectionStage,
} from '@/shared/lib/brow-mapping/detector';
import type {
  BrowAnalysis,
  BrowAnchorTarget,
  BrowControls,
  BrowStyle,
  Point,
} from '@/shared/lib/brow-mapping/types';

import type { ConfirmedBrowAnalysis } from './analysis-panel';

export function useBrowAnalysis(file: File | null, onInvalidate: () => void) {
  const [photo, setPhoto] = useState<BrowPhoto | null>(null);
  const [analysis, setAnalysis] = useState<BrowAnalysis | null>(null);
  const [status, setStatus] = useState<DetectionStage | 'preparing' | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [style, setStyle] = useState<BrowStyle>('natural');
  const [controls, setControls] = useState<Partial<BrowControls>>({});
  const [exporting, setExporting] = useState(false);
  const revision = useRef(0);
  const invalidateRef = useRef(onInvalidate);
  invalidateRef.current = onInvalidate;
  const candidate = useMemo(
    () => (analysis ? buildCandidate(analysis, style, controls) : null),
    [analysis, style, controls]
  );

  useEffect(() => {
    const controller = new AbortController();
    const current = ++revision.current;
    let owned: BrowPhoto | null = null;
    const active = () =>
      !controller.signal.aborted && current === revision.current;
    setPhoto(null);
    setAnalysis(null);
    setError(null);
    setStyle('natural');
    setControls({});
    setExporting(false);
    invalidateRef.current();
    setStatus(file ? 'preparing' : null);
    if (file)
      void (async () => {
        try {
          owned = await normalizePhoto(file);
          if (!active()) {
            URL.revokeObjectURL(owned.url);
            owned = null;
            return;
          }
          setPhoto(owned);
          const faces = await detectPhoto(owned, controller.signal, (value) => {
            if (active()) setStatus(value);
          });
          if (!active()) return;
          setAnalysis(analyzeFace(faces, owned.width, owned.height));
        } catch (cause) {
          if (active())
            setError(cause instanceof Error ? cause.message : 'unknown');
        } finally {
          if (active()) setStatus(null);
        }
      })();
    return () => {
      controller.abort();
      // Revision is an operation counter, invalidating in-flight exports as well.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++revision.current;
      if (owned) URL.revokeObjectURL(owned.url);
    };
  }, [file, attempt]);

  function update(nextStyle: BrowStyle, nextControls: Partial<BrowControls>) {
    ++revision.current;
    setStyle(nextStyle);
    setControls(nextControls);
    setError(null);
    invalidateRef.current();
  }

  function moveAnchor(target: BrowAnchorTarget, position: Point) {
    if (!analysis || exporting) return;
    ++revision.current;
    setControls((previous) =>
      moveCandidateAnchor(analysis, style, previous, target, position)
    );
    invalidateRef.current();
  }

  async function exportImage(
    withReferences: boolean
  ): Promise<ConfirmedBrowAnalysis | null> {
    if (!photo || !analysis || !candidate || exporting) return null;
    const current = revision.current;
    setExporting(true);
    try {
      const guide = await exportBrowPhoto(
        photo,
        analysis,
        candidate,
        withReferences
      );
      return current === revision.current ? { photo, guide } : null;
    } catch {
      if (current === revision.current) setError('export');
      return null;
    } finally {
      if (current === revision.current) setExporting(false);
    }
  }

  return {
    photo,
    analysis,
    candidate,
    status,
    error,
    style,
    controls,
    exporting,
    update,
    moveAnchor,
    exportImage,
    retry: () => setAttempt((value) => value + 1),
  };
}
