'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button, Modal, Spinner } from '@heroui/react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useAppContext } from '@/shared/contexts/app';
import {
  loadBrowResultHistory,
  type BrowHistoryResult,
} from '@/shared/lib/brow-result-history';

import { useBrowExportAccess } from './export-access';

import './result-history.css';

export function BrowResultHistory({
  refreshKey,
  horizontal = false,
}: {
  refreshKey: string | null;
  horizontal?: boolean;
}) {
  const { user } = useAppContext();
  if (!user) return null;
  return (
    <SavedHistory
      key={user.id}
      refreshKey={refreshKey}
      horizontal={horizontal}
    />
  );
}

function SavedHistory({
  refreshKey,
  horizontal,
}: {
  refreshKey: string | null;
  horizontal: boolean;
}) {
  const [results, setResults] = useState<BrowHistoryResult[]>([]);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${refreshKey ?? ''}:${attempt}`;
  const [settled, setSettled] = useState<{
    key: string;
    failed: boolean;
  } | null>(null);
  const loading = settled?.key !== requestKey;
  const failed = !loading && !!settled?.failed;
  const access = useBrowExportAccess();
  useEffect(() => {
    const controller = new AbortController();
    void loadBrowResultHistory(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setResults(next);
          setSettled({ key: requestKey, failed: false });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setSettled({ key: requestKey, failed: true });
      });
    return () => controller.abort();
  }, [requestKey]);
  return (
    <BrowResultHistoryView
      results={results}
      loading={loading}
      failed={failed}
      horizontal={horizontal}
      onRefresh={() => setAttempt((value) => value + 1)}
      canExport={!!access.canExport}
      downloading={access.downloading}
      onDownload={(id) => void access.downloadTasks([id])}
    />
  );
}

// The viewer never replaces the studio's source photo, selected style or draft.
// Results from different original photos must not enter its before/after slider.
export function BrowResultHistoryView({
  results,
  loading,
  failed,
  horizontal,
  onRefresh,
  canExport,
  downloading,
  onDownload,
}: {
  results: BrowHistoryResult[];
  loading: boolean;
  failed: boolean;
  horizontal: boolean;
  onRefresh: () => void;
  canExport: boolean;
  downloading: boolean;
  onDownload: (id: string) => void;
}) {
  const t = useTranslations('pages.ai-brow-tint');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const index = results.findIndex((result) => result.id === selectedId);
  const selected = results[index];
  if (!results.length && !loading && !failed) return null;
  return (
    <>
      <section
        className={`brow-history ${horizontal ? 'brow-history-horizontal' : 'brow-history-rail'}`}
        aria-label={t('history.title')}
      >
        <div className="brow-history-heading">
          <h3>{t('history.title')}</h3>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t('ui.refresh_results')}
            isDisabled={loading}
            onPress={onRefresh}
          >
            <RefreshCw className="size-3" />
          </Button>
        </div>
        {loading && !results.length && (
          <div role="status" className="brow-history-notice">
            <Spinner size="sm" />
            <span>{t('history.loading')}</span>
          </div>
        )}
        {failed && (
          <p role="alert" className="brow-history-notice">
            {t('history.failed')}
          </p>
        )}
        <div className="brow-history-list">
          {results.map((result, i) => (
            <button
              key={result.id}
              type="button"
              className="brow-history-thumbnail"
              aria-label={t('history.open_result', {
                n: i + 1,
                style: result.styleName,
              })}
              aria-haspopup="dialog"
              onClick={() => setSelectedId(result.id)}
            >
              <Image
                src={result.previewUrl}
                alt=""
                width={84}
                height={100}
                unoptimized
                loading="lazy"
              />
              <span title={result.styleName}>{result.styleName}</span>
            </button>
          ))}
        </div>
      </section>
      <Modal.Backdrop
        isOpen={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog
            className="brow-workspace brow-history-dialog"
            aria-label={t('history.title')}
          >
            <Modal.CloseTrigger aria-label={t('history.close')} />
            {selected && (
              <>
                <Modal.Header className="pr-10">
                  <Modal.Heading>{selected.styleName}</Modal.Heading>
                  <p className="text-muted text-xs">
                    {t('history.saved_preview')} · {index + 1}/{results.length}
                  </p>
                </Modal.Header>
                <Modal.Body className="min-h-0">
                  <HistoryImage key={selected.id} result={selected} />
                </Modal.Body>
                <Modal.Footer className="flex-wrap justify-between gap-2">
                  <div className="flex gap-1">
                    <Button
                      isIconOnly
                      variant="ghost"
                      aria-label={t('history.previous')}
                      isDisabled={index <= 0}
                      onPress={() => setSelectedId(results[index - 1].id)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      isIconOnly
                      variant="ghost"
                      aria-label={t('history.next')}
                      isDisabled={index >= results.length - 1}
                      onPress={() => setSelectedId(results[index + 1].id)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  <Button
                    variant="primary"
                    isPending={downloading}
                    isDisabled={downloading}
                    onPress={() => onDownload(selected.id)}
                  >
                    {canExport ? t('ui.export_hd') : t('ui.upgrade_export')}
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

function HistoryImage({ result }: { result: BrowHistoryResult }) {
  const t = useTranslations('pages.ai-brow-tint');
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <p role="alert" className="py-10 text-center text-sm">
        {t('history.image_failed')}
      </p>
    );
  return (
    <Image
      src={result.previewUrl}
      alt={result.styleName}
      width={1024}
      height={1024}
      unoptimized
      className="brow-history-image"
      onError={() => setFailed(true)}
    />
  );
}
