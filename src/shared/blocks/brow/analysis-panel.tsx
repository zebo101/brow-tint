'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Download, Loader2, Pause, Play, RotateCcw } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useLocale } from 'next-intl';

import {
  analyzeFace,
  buildCandidate,
} from '@/shared/lib/brow-mapping/analysis';
import {
  detectPhoto,
  exportBrowPhoto,
  normalizePhoto,
  type BrowPhoto,
  type DetectionStage,
} from '@/shared/lib/brow-mapping/detector';
import type { BrowAnalysis, BrowStyle } from '@/shared/lib/brow-mapping/types';

import { getBrowCopy } from './copy';
import { BrowOverlay } from './overlay';

export type ConfirmedBrowAnalysis = { photo: BrowPhoto; guide: Blob };

const timings = [700, 900, 1000, 1100, 1100, 1200];
const control =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50';

export function BrowAnalysisPanel({
  file,
  disabled = false,
  onConfirm,
  onInvalidate,
}: {
  file: File;
  disabled?: boolean;
  onConfirm: (value: ConfirmedBrowAnalysis) => void;
  onInvalidate: () => void;
}) {
  const c = getBrowCopy(useLocale());
  const id = useId();
  const reduced = useReducedMotion();
  const callbacks = useRef({ onConfirm, onInvalidate });
  callbacks.current = { onConfirm, onInvalidate };
  const revision = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [photo, setPhoto] = useState<BrowPhoto | null>(null);
  const [analysis, setAnalysis] = useState<BrowAnalysis | null>(null);
  const [status, setStatus] = useState<DetectionStage | 'preparing' | null>(
    'preparing'
  );
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<BrowStyle>('natural');
  const [thickness, setThickness] = useState(1);
  const [arch, setArch] = useState(0);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);
  const [original, setOriginal] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const candidate = useMemo(
    () =>
      analysis ? buildCandidate(analysis, style, { thickness, arch }) : null,
    [analysis, style, thickness, arch]
  );

  useEffect(() => {
    const controller = new AbortController();
    const current = ++revision.current;
    let ownedPhoto: BrowPhoto | null = null;
    const active = () =>
      !controller.signal.aborted && revision.current === current;
    callbacks.current.onInvalidate();
    setPhoto(null);
    setAnalysis(null);
    setError(null);
    setConfirmed(false);
    setExporting(false);
    setOriginal(false);
    setThickness(1);
    setArch(0);
    setStatus('preparing');
    void (async () => {
      try {
        ownedPhoto = await normalizePhoto(file);
        if (!active()) {
          URL.revokeObjectURL(ownedPhoto.url);
          ownedPhoto = null;
          return;
        }
        setPhoto(ownedPhoto);
        const faces = await detectPhoto(
          ownedPhoto,
          controller.signal,
          (value) => {
            if (active()) setStatus(value);
          }
        );
        if (!active()) return;
        const result = analyzeFace(faces, ownedPhoto.width, ownedPhoto.height);
        setAnalysis(result);
        setStyle(result.recommendations[0]);
        setStage(0);
        setPlaying(true);
        setReplay((value) => value + 1);
      } catch (cause) {
        if (!active()) return;
        setError(cause instanceof Error ? cause.message : 'unknown');
      } finally {
        if (active()) setStatus(null);
      }
    })();
    return () => {
      controller.abort();
      // This is an async operation counter, not a DOM ref: invalidate the latest export too.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++revision.current;
      if (ownedPhoto) URL.revokeObjectURL(ownedPhoto.url);
    };
  }, [file, attempt]);

  useEffect(() => {
    if (!analysis) return;
    if (reduced) {
      setStage(6);
      setPlaying(false);
      return;
    }
    if (!playing || stage >= 6) return;
    const timer = window.setTimeout(
      () => setStage((value) => value + 1),
      timings[stage]
    );
    return () => window.clearTimeout(timer);
  }, [analysis, playing, stage, reduced]);

  function invalidate() {
    ++revision.current;
    setConfirmed(false);
    callbacks.current.onInvalidate();
  }

  async function exportPhoto(confirm: boolean) {
    if (!photo || !analysis || !candidate || exporting || disabled) return;
    const current = revision.current;
    setExporting(true);
    setError(null);
    try {
      const blob = await exportBrowPhoto(photo, analysis, candidate, !confirm);
      if (revision.current !== current) return;
      if (confirm) {
        setConfirmed(true);
        callbacks.current.onConfirm({ photo, guide: blob });
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'brow-analysis.png';
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      if (revision.current === current) setError('export');
    } finally {
      if (revision.current === current) setExporting(false);
    }
  }

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="bg-card border-border overflow-hidden rounded-2xl border"
    >
      <header className="border-border space-y-2 border-b p-4 sm:p-5">
        <h2 id={`${id}-heading`} className="font-semibold">
          {c.analysis}
        </h2>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {c.privacy}
        </p>
      </header>
      {photo && (
        <div className="bg-muted/30 overflow-hidden">
          <BrowOverlay
            photo={photo}
            analysis={analysis}
            candidate={candidate}
            stage={stage}
            original={original}
            replay={replay}
          />
        </div>
      )}
      {status && (
        <p role="status" className="flex items-center gap-2 p-5 text-sm">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          {c[status]}
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-3 p-4 text-sm">
          <p>
            {error === 'export'
              ? c.downloadError
              : (c.errors[error as keyof typeof c.errors] ?? c.errors.unknown)}
          </p>
          {!analysis && (
            <button
              type="button"
              className={control}
              disabled={disabled}
              onClick={() => setAttempt((value) => value + 1)}
            >
              {c.retry}
            </button>
          )}
        </div>
      )}
      {analysis && (
        <div className="space-y-5 p-4 sm:p-5">
          <div className="space-y-3">
            <ol aria-label={c.analysis} className="flex flex-wrap gap-1.5">
              {c.steps.map((label, index) => (
                <li key={label}>
                  <button
                    type="button"
                    aria-current={stage === index ? 'step' : undefined}
                    aria-label={`${index + 1}. ${label}`}
                    className={`${control} min-w-11 px-2 ${stage === index ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
                    onClick={() => {
                      setStage(index);
                      setPlaying(false);
                      setOriginal(false);
                    }}
                  >
                    {index + 1}
                  </button>
                </li>
              ))}
            </ol>
            <div aria-live="polite" aria-atomic="true" className="min-h-20">
              <p className="text-sm font-semibold">{c.steps[stage]}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {c.explanations[stage]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stage < 6 && (
                <button
                  type="button"
                  className={control}
                  onClick={() => setPlaying((value) => !value)}
                >
                  {playing ? (
                    <Pause aria-hidden className="size-4" />
                  ) : (
                    <Play aria-hidden className="size-4" />
                  )}
                  {playing ? c.pause : c.continue}
                </button>
              )}
              {stage < 6 ? (
                <button
                  type="button"
                  className={control}
                  onClick={() => {
                    setStage(6);
                    setPlaying(false);
                  }}
                >
                  {c.skip}
                </button>
              ) : (
                <button
                  type="button"
                  className={control}
                  onClick={() => {
                    setStage(reduced ? 6 : 0);
                    setPlaying(!reduced);
                    setReplay((value) => value + 1);
                    setOriginal(false);
                  }}
                >
                  <RotateCcw aria-hidden className="size-4" />
                  {c.replay}
                </button>
              )}
              <button
                type="button"
                aria-pressed={original}
                className={control}
                onClick={() => setOriginal((value) => !value)}
              >
                {original ? c.mapping : c.original}
              </button>
            </div>
          </div>
          <fieldset
            disabled={disabled || exporting}
            className="space-y-4 disabled:opacity-60"
          >
            <legend className="text-sm font-semibold">{c.direction}</legend>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {c.directionHint}
            </p>
            <div
              className="grid grid-cols-3 gap-2"
              role="group"
              aria-label={c.direction}
            >
              {analysis.recommendations.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={style === value}
                  className={`${control} px-1 ${style === value ? 'border-primary bg-primary/10' : ''}`}
                  onClick={() => {
                    invalidate();
                    setStyle(value);
                    setStage(6);
                    setPlaying(false);
                    setOriginal(false);
                  }}
                >
                  {c[value]}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {c[`${style}Reason`]} {c.reasons[analysis.reason]}
            </p>
            <div className="space-y-3">
              <label
                htmlFor={`${id}-thickness`}
                className="flex justify-between text-sm"
              >
                <span>{c.thickness}</span>
                <output>{Math.round(thickness * 100)}%</output>
              </label>
              <input
                id={`${id}-thickness`}
                type="range"
                min="75"
                max="125"
                step="1"
                value={Math.round(thickness * 100)}
                className="accent-primary min-h-11 w-full cursor-pointer"
                onChange={(event) => {
                  invalidate();
                  setThickness(Number(event.target.value) / 100);
                  setStage(6);
                  setPlaying(false);
                }}
              />
              <label
                htmlFor={`${id}-arch`}
                className="flex justify-between text-sm"
              >
                <span>{c.arch}</span>
                <output>{Math.round(arch * 1000)}</output>
              </label>
              <input
                id={`${id}-arch`}
                type="range"
                min="-25"
                max="25"
                step="1"
                value={Math.round(arch * 1000)}
                aria-valuetext={`${arch > 0 ? c.higher : c.lower} ${Math.abs(Math.round(arch * 1000))}`}
                className="accent-primary min-h-11 w-full cursor-pointer"
                onChange={(event) => {
                  invalidate();
                  setArch(Number(event.target.value) / 1000);
                  setStage(6);
                  setPlaying(false);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={control}
                onClick={() => void exportPhoto(false)}
              >
                <Download aria-hidden className="size-4" />
                {c.download}
              </button>
              <button
                type="button"
                disabled={stage < 6 || confirmed}
                className={`${control} bg-primary text-primary-foreground hover:bg-primary/90 flex-1`}
                onClick={() => void exportPhoto(true)}
              >
                {exporting ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : confirmed ? (
                  <Check aria-hidden className="size-4" />
                ) : null}
                {confirmed ? c.confirmed : c.confirm}
              </button>
            </div>
          </fieldset>
        </div>
      )}
    </section>
  );
}
