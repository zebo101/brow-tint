'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';
import { useBrowExportAccess } from '@/shared/blocks/brow/export-access';
import { useAppContext } from '@/shared/contexts/app';

interface SavedBrowResult {
  id: string;
  styleId: string;
  styleName: string;
  photoGroup: string;
  previewUrl: string;
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

function SavedBrowExportGallery({ refreshKey }: { refreshKey: string | null }) {
  const t = useTranslations('pages.ai-brow-tint');
  const access = useBrowExportAccess();
  const [results, setResults] = useState<SavedBrowResult[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/brow/results', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('results_failed');
        const payload = await response.json();
        if (!controller.signal.aborted) {
          setResults(payload.results);
          setSelected([]);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [refreshKey, attempt]);
  if (!results.length && !failed) return null;
  const first = results.find((item) => item.id === selected[0]);
  return (
    <section
      className="border-border/40 mt-8 space-y-4 rounded-2xl border p-4 sm:p-6"
      aria-label={t('ui.comparison_title')}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{t('ui.comparison_title')}</h2>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => setAttempt((value) => value + 1)}
        >
          {t('ui.refresh_results')}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{t('ui.comparison_hint')}</p>
      {failed && (
        <p role="alert" className="text-danger text-sm">
          {t('ui.download_failed_please_try_again')}
        </p>
      )}
      <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-4">
        {results.map((result) => {
          const checked = selected.includes(result.id);
          const unavailable =
            !checked &&
            (selected.length >= 4 ||
              (!!first &&
                (first.photoGroup !== result.photoGroup ||
                  results.some(
                    (item) =>
                      selected.includes(item.id) &&
                      item.styleId === result.styleId
                  ))));
          return (
            <article
              key={result.id}
              className="border-border/40 space-y-2 rounded-2xl border p-2"
            >
              <label
                className={`block space-y-2 ${unavailable ? 'opacity-40' : ''}`}
              >
                <Image
                  src={result.previewUrl}
                  alt={result.styleName}
                  width={480}
                  height={640}
                  unoptimized
                  className="block h-auto w-full rounded-lg"
                />
                <span className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={unavailable || access.downloading}
                    onChange={() =>
                      setSelected((previous) =>
                        checked
                          ? previous.filter((id) => id !== result.id)
                          : [...previous, result.id]
                      )
                    }
                  />
                  {result.styleName}
                </span>
              </label>
              <Button
                size="sm"
                variant="ghost"
                isDisabled={access.downloading}
                onPress={() => void access.downloadTasks([result.id])}
              >
                {access.canExport ? t('ui.export_hd') : t('ui.upgrade_export')}
              </Button>
            </article>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {access.canCompare ? (
          <Button
            variant="primary"
            isDisabled={selected.length < 2}
            isPending={access.downloading}
            onPress={() => void access.downloadTasks(selected)}
          >
            {t('ui.export_compare', { n: selected.length })}
          </Button>
        ) : (
          <Link
            href="/pricing"
            className="text-sm font-semibold underline underline-offset-4"
          >
            {t('ui.upgrade_compare')}
          </Link>
        )}
        <span className="text-muted-foreground text-xs">
          {selected.length}/4
        </span>
      </div>
    </section>
  );
}
