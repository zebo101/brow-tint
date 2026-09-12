'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';

import type { ConfirmedBrowAnalysis } from '@/shared/blocks/brow/analysis-panel';
import { getBrowCopy } from '@/shared/blocks/brow/copy';
import { PortraitCanvas } from '@/shared/blocks/brow/portrait-canvas';
import { useBrowAnalysis } from '@/shared/blocks/brow/use-brow-analysis';
import type { BrowControls, BrowStyle } from '@/shared/lib/brow-mapping/types';

import { straightBrowControls } from './filter-presets';
import { browShapeLabel } from './shape-label';
import type { BrowStyleItem } from './types';

const shapes = [
  { name: 'Natural', shape: 'natural', base: 'natural', arch: 0 },
  { name: 'Arched', shape: 'lifted', base: 'lifted', arch: 0.012 },
  { name: 'Straight', shape: 'straight', base: 'natural', arch: 0 },
  { name: 'Soft Angled', shape: 'soft', base: 'soft', arch: 0.008 },
  { name: 'S-Shaped', shape: 's-shaped', base: null, arch: 0 },
] as const;

interface FilterEditorProps {
  file: File | null;
  styles: BrowStyleItem[];
  disabled: boolean;
  confirmed: boolean;
  resultUrl: string | null;
  onConfirm: (value: ConfirmedBrowAnalysis) => void;
  onInvalidate: () => void;
  onSelectStyle: (style: BrowStyleItem) => void;
  onTryAnother: () => void;
  action: ReactNode;
  status: ReactNode;
}

export function BrowFilterEditor(props: FilterEditorProps) {
  const locale = useLocale();
  const t = useTranslations('pages.ai-brow-tint');
  const copy = getBrowCopy(locale);
  const local = useBrowAnalysis(props.file, props.onInvalidate);
  const [selected, setSelected] = useState<string | null>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const locked = props.disabled || local.exporting || !!local.status;
  const error = local.error
    ? local.error === 'export'
      ? copy.downloadError
      : (copy.errors[local.error as keyof typeof copy.errors] ??
        copy.errors.unknown)
    : null;

  function choose(option: (typeof shapes)[number], reference: BrowStyleItem) {
    if (locked || !local.analysis || !option.base) return;
    // Selector presets use the existing adjustment API; the mapping engine is unchanged.
    const controls: Partial<BrowControls> =
      option.shape === 'straight'
        ? straightBrowControls(local.analysis)
        : { arch: option.arch };
    local.update(option.base as BrowStyle, controls);
    props.onSelectStyle(reference);
    setSelected(option.shape);
  }

  const selectedLabel = selected
    ? browShapeLabel({ shape: selected }, locale)
    : t('ui.eyebrow_filter');
  const exportRef = useRef(local.exportImage);
  useEffect(() => {
    exportRef.current = local.exportImage;
  });
  const onConfirm = props.onConfirm;
  useEffect(() => {
    if (!selected || !local.candidate) return;
    let cancelled = false;
    // Prepare the same guide locally, without a manual mapping step or an upload.
    void exportRef.current(false).then((result) => {
      if (!cancelled && result) onConfirm(result);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, local.candidate, onConfirm]);

  return (
    <div className="space-y-6" data-filter-editor>
      <ol
        aria-label={t('ui.how_filter_works')}
        className="text-muted-foreground grid grid-cols-2 gap-2 text-xs sm:grid-cols-5"
      >
        {[
          t('ui.upload_photo'),
          t('ui.choose_a_shape'),
          t('ui.preview_look'),
          t('ui.compare'),
          t('ui.download_your_result'),
        ].map((step, index) => (
          <li key={step} className="bg-muted/50 rounded-xl px-3 py-3">
            <span className="text-foreground font-semibold">{index + 1}.</span>{' '}
            {step}
          </li>
        ))}
      </ol>
      <div
        ref={selectionRef}
        tabIndex={-1}
        className="scroll-mt-24 space-y-3 focus:outline-none"
      >
        <h2 className="text-lg font-semibold">{t('ui.choose_your_shape')}</h2>
        <div
          role="group"
          aria-label={t('ui.shapes')}
          className="flex flex-wrap gap-2"
        >
          {shapes.map((option) => {
            const reference = props.styles.find(
              (style) => style.shape === option.shape && !!style.thumbnail
            );
            const available = !!option.base && !!reference;
            return (
              <Button
                key={browShapeLabel({ shape: option.shape }, locale)}
                variant={selected === option.shape ? 'primary' : 'outline'}
                aria-pressed={selected === option.shape}
                isDisabled={locked || !local.analysis || !available}
                onPress={() => reference && choose(option, reference)}
              >
                {browShapeLabel({ shape: option.shape }, locale)}
                {!available && (
                  <span className="text-xs"> · {t('ui.unavailable')}</span>
                )}
              </Button>
            );
          })}
        </div>
        <p className="text-muted-foreground text-sm">
          {!props.file ? t('ui.upload_to_detect') : t('ui.outlines_instant')}
        </p>
      </div>
      {local.status && (
        <p role="status" className="text-sm">
          {copy[local.status]}
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-2 text-sm">
          <p>{error}</p>
          <Button
            variant="outline"
            onPress={() => {
              setSelected(null);
              props.onInvalidate();
              local.retry();
            }}
            isDisabled={locked}
          >
            {t('ui.retry_analysis')}
          </Button>
        </div>
      )}
      {local.photo && (
        <section
          aria-label={
            props.resultUrl ? t('ui.before_after') : t('ui.live_preview')
          }
          className="border-border space-y-4 rounded-2xl border p-3 sm:p-5"
        >
          <h2 className="text-base font-semibold">
            {props.resultUrl
              ? t('ui.your_result', { name: selectedLabel })
              : selected
                ? t('ui.shape_live_preview', { name: selectedLabel })
                : t('ui.current_shape')}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-4" data-brow-comparison>
            <figure className="min-w-0 space-y-2">
              <figcaption className="text-sm font-medium">
                {t('ui.before')}
              </figcaption>
              <div className="bg-muted aspect-[3/4] overflow-hidden rounded-xl">
                <img
                  src={local.photo.url}
                  alt={t('ui.before_alt')}
                  className="h-full w-full object-contain"
                />
              </div>
            </figure>
            <figure className="min-w-0 space-y-2">
              <figcaption className="text-sm font-medium">
                {props.resultUrl ? t('ui.after') : t('ui.shape_preview')}
              </figcaption>
              <div className="bg-muted aspect-[3/4] overflow-hidden rounded-xl">
                {props.resultUrl ? (
                  <img
                    src={props.resultUrl}
                    alt={t('ui.after_alt', {
                      name: selected ? selectedLabel : 'eyebrow',
                    })}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <PortraitCanvas
                    photo={local.photo}
                    analysis={local.analysis}
                    candidate={local.candidate}
                    view="contour"
                    zoom={1}
                    guideStage={6}
                    resultUrl={null}
                    split={50}
                    zh={locale.startsWith('zh')}
                    fitInsets={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  />
                )}
              </div>
            </figure>
          </div>
          {props.resultUrl ? (
            <Button
              variant="primary"
              onPress={() => {
                props.onTryAnother();
                selectionRef.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
                selectionRef.current?.focus({ preventScroll: true });
              }}
            >
              {t('ui.try_another')}
            </Button>
          ) : (
            <div className="max-w-md space-y-3">
              {local.exporting && (
                <p role="status" className="text-muted-foreground text-xs">
                  {t('ui.preparing_preview')}
                </p>
              )}
              {props.action}
            </div>
          )}
          {props.status}
        </section>
      )}
    </div>
  );
}
