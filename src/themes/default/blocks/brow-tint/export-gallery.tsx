'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Button, Tooltip } from '@heroui/react';
import { Check, ChevronDown, ChevronUp, ImageOff, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useBrowExportAccess } from '@/shared/blocks/brow/export-access';
import { useAppContext } from '@/shared/contexts/app';

interface SavedBrowResult {
  id: string;
  styleId: string;
  styleName: string;
  photoGroup: string;
  previewUrl: string;
  createdAt: string;
  expired: boolean;
}

export function BrowExportGallery({
  refreshKey,
}: {
  refreshKey: string | null;
}) {
  const { user } = useAppContext();
  if (!user) return null;
  return <SavedBrowExportGallery key={user.id} refreshKey={refreshKey} />;
}

function ResultCard({
  result,
  expired = false,
  checked = false,
  unavailable = false,
  busy,
  canExport,
  formatter,
  onToggle,
  onError,
  onExport,
  onRemove,
}: {
  result: SavedBrowResult;
  expired?: boolean;
  checked?: boolean;
  unavailable?: boolean;
  busy: boolean;
  canExport?: boolean;
  formatter: Intl.DateTimeFormat;
  onToggle?: () => void;
  onError?: () => void;
  onExport?: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('pages.ai-brow-tint');
  const [loaded, setLoaded] = useState(false);
  const date = new Date(result.createdAt);
  const dateLabel = Number.isFinite(date.getTime())
    ? formatter.format(date)
    : '';
  return (
    <article
      className={`border-border/40 space-y-2 rounded-2xl border p-2 ${checked ? 'ring-primary ring-2' : ''}`}
    >
      {expired ? (
        <div className="border-border/40 bg-muted text-muted-foreground relative flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed p-2 text-center">
          <div className="min-w-0 space-y-1">
            <ImageOff className="mx-auto size-5" aria-hidden="true" />
            <p className="text-xs font-medium">{t('ui.result_expired')}</p>
            <p className="text-xs leading-snug">
              {t('ui.result_expired_hint')}
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-label={result.styleName}
          aria-pressed={checked}
          disabled={unavailable || busy}
          onClick={onToggle}
          className={`bg-muted focus-visible:ring-primary relative block aspect-[3/4] w-full overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:outline-none ${unavailable ? 'opacity-40' : 'cursor-pointer'}`}
        >
          {!loaded && (
            <span
              aria-hidden="true"
              className="bg-muted absolute inset-0 animate-pulse"
            />
          )}
          <Image
            src={result.previewUrl}
            alt=""
            fill
            unoptimized
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={onError}
            className={`object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
          <span
            aria-hidden="true"
            className={`absolute top-2 left-2 flex size-6 items-center justify-center rounded-full border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border/40 bg-background/80 text-muted-foreground backdrop-blur-sm'}`}
          >
            {checked && <Check className="size-4" />}
          </span>
        </button>
      )}
      <div className="space-y-0.5">
        <p className="truncate text-sm font-medium" title={result.styleName}>
          {result.styleName}
        </p>
        {dateLabel && (
          <time
            dateTime={result.createdAt}
            className="text-muted-foreground block text-xs"
          >
            {dateLabel}
          </time>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!expired && (
          <Button
            size="sm"
            variant="ghost"
            fullWidth
            className="min-w-0 flex-1"
            isDisabled={busy}
            onPress={onExport}
          >
            <span className="truncate">
              {canExport ? t('ui.export_hd') : t('ui.upgrade_export')}
            </span>
          </Button>
        )}
        <Tooltip>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            className="text-muted-foreground ml-auto shrink-0"
            aria-label={t('ui.remove_result')}
            isDisabled={busy}
            onPress={onRemove}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
          <Tooltip.Content>{t('ui.remove_result')}</Tooltip.Content>
        </Tooltip>
      </div>
    </article>
  );
}

function SavedBrowExportGallery({ refreshKey }: { refreshKey: string | null }) {
  const t = useTranslations('pages.ai-brow-tint');
  const locale = useLocale();
  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  });
  const access = useBrowExportAccess();
  const [results, setResults] = useState<SavedBrowResult[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [removing, setRemoving] = useState(false);
  const mutation = useRef(false);
  const requestVersion = useRef(0);
  const expiredSectionId = useId();

  useEffect(() => {
    if (mutation.current) return;
    const controller = new AbortController();
    const version = ++requestVersion.current;
    void fetch('/api/brow/results', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('results_failed');
        const payload = await response.json();
        if (!Array.isArray(payload.results)) throw new Error('results_failed');
        if (!controller.signal.aborted && version === requestVersion.current) {
          setResults(payload.results);
          setSelected([]);
          setFailedImages(new Set());
          setFailed(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && version === requestVersion.current)
          setFailed(true);
      });
    return () => controller.abort();
  }, [refreshKey, attempt]);

  const activeResults = results.filter(
    (item) => !item.expired && !failedImages.has(item.id)
  );
  const expiredResults = results.filter(
    (item) => item.expired || failedImages.has(item.id)
  );
  const first = activeResults.find((item) => item.id === selected[0]);

  function imageFailed(id: string) {
    setFailedImages((previous) => new Set(previous).add(id));
    setSelected((previous) =>
      previous.filter((selectedId) => selectedId !== id)
    );
  }

  async function removeResults(items: SavedBrowResult[], clearExpired = false) {
    if (mutation.current || !items.length) return;
    mutation.current = true;
    requestVersion.current++;
    setRemoving(true);
    const ids = new Set(items.map((item) => item.id));
    setResults((previous) => previous.filter((item) => !ids.has(item.id)));
    setSelected((previous) => previous.filter((id) => !ids.has(id)));
    async function remove(body: { taskId: string } | { expired: true }) {
      const response = await fetch('/api/brow/results', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok || !(await response.json()).ok)
        throw new Error('remove_failed');
    }
    try {
      const requests = clearExpired
        ? [
            remove({ expired: true }),
            ...items
              .filter((item) => !item.expired)
              .map((item) => remove({ taskId: item.id })),
          ]
        : items.map((item) => remove({ taskId: item.id }));
      // Runtime failures can be younger than 14 days; remove those by their owned IDs.
      const outcomes = await Promise.allSettled(requests);
      if (outcomes.some((outcome) => outcome.status === 'rejected'))
        throw new Error('remove_failed');
    } catch {
      setResults((previous) => [
        ...previous,
        ...items.filter(
          (item) => !previous.some((saved) => saved.id === item.id)
        ),
      ]);
      toast.error(t('ui.remove_result_failed'));
    } finally {
      mutation.current = false;
      setRemoving(false);
      // Reconcile partial failures, concurrent generations and newly rescued copies.
      setAttempt((value) => value + 1);
    }
  }

  if (!results.length && !failed && !removing) return null;
  const busy = access.downloading || removing;
  return (
    <section
      className="border-border/40 mt-8 space-y-4 rounded-2xl border p-4 sm:p-6"
      aria-label={t('ui.comparison_title')}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {t('ui.comparison_title')}
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
            {activeResults.length}
          </span>
        </h2>
        <Button
          size="sm"
          variant="ghost"
          isDisabled={removing}
          onPress={() => setAttempt((value) => value + 1)}
        >
          {t('ui.refresh_results')}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{t('ui.comparison_hint')}</p>
      {failed && (
        <p role="alert" className="text-danger text-sm">
          {t('ui.results_load_failed')}
        </p>
      )}
      {activeResults.length ? (
        <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-4">
          {activeResults.map((result) => {
            const checked = selected.includes(result.id);
            const unavailable =
              !checked &&
              (selected.length >= 4 ||
                (!!first &&
                  (first.photoGroup !== result.photoGroup ||
                    activeResults.some(
                      (item) =>
                        selected.includes(item.id) &&
                        item.styleId === result.styleId
                    ))));
            return (
              <ResultCard
                key={result.id}
                result={result}
                checked={checked}
                unavailable={unavailable}
                busy={busy}
                canExport={access.canExport}
                formatter={formatter}
                onToggle={() =>
                  setSelected((previous) =>
                    checked
                      ? previous.filter((id) => id !== result.id)
                      : [...previous, result.id]
                  )
                }
                onError={() => imageFailed(result.id)}
                onExport={() => void access.downloadTasks([result.id])}
                onRemove={() => void removeResults([result])}
              />
            );
          })}
        </div>
      ) : (
        <p className="bg-muted/50 text-muted-foreground rounded-xl p-4 text-sm">
          {t('ui.no_active_results')}
        </p>
      )}
      {expiredResults.length > 0 && (
        <div className="border-border/40 space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-muted-foreground mr-auto text-xs">
              {t('ui.expired_results_title', { n: expiredResults.length })}
            </p>
            <Button
              size="sm"
              variant="ghost"
              isDisabled={busy}
              onPress={() => void removeResults(expiredResults, true)}
            >
              {t('ui.clear_expired')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={expanded}
              aria-controls={expiredSectionId}
              onPress={() => setExpanded((value) => !value)}
            >
              {expanded ? t('ui.hide_expired') : t('ui.show_expired')}
              {expanded ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <div id={expiredSectionId} hidden={!expanded}>
            {expanded && (
              <div className="grid grid-cols-3 items-start gap-3 md:grid-cols-6">
                {expiredResults.map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    expired
                    busy={busy}
                    formatter={formatter}
                    onRemove={() => void removeResults([result])}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {activeResults.length >= 2 && (
        <div className="flex flex-wrap items-center gap-3">
          {access.canCompare ? (
            <Button
              variant="primary"
              isDisabled={selected.length < 2 || removing}
              isPending={access.downloading}
              onPress={() => void access.downloadTasks(selected)}
            >
              {t('ui.export_compare', { n: selected.length })}
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => access.openPurchase('compare')}
              className="text-sm font-semibold underline underline-offset-4"
            >
              {t('ui.upgrade_compare')}
            </button>
          )}
          <span className="text-muted-foreground text-xs tabular-nums">
            {selected.length}/4
          </span>
        </div>
      )}
    </section>
  );
}
