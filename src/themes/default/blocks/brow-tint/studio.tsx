'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ScanFace, Sparkles, Upload, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { ConfirmedBrowAnalysis } from '@/shared/blocks/brow/analysis-panel';
import {
  BrowPortraitPreview,
  type BrowPreviewState,
} from '@/shared/blocks/brow/portrait-preview';
import { BrowWorkspace } from '@/shared/blocks/brow/workspace';
import { PhotoGuidelinesModal } from '@/shared/blocks/common/photo-guidelines-modal';
import { useAppContext } from '@/shared/contexts/app';

import { BrowCatalogPanel } from './catalog-panel';
import { BrowFilterEditor } from './filter-editor';
import {
  BROW_MAPPING_CREDITS,
  BrowGenerationActions,
  BrowGenerationStatus,
} from './generation-actions';
import { validateBrowPhotoFile } from './generation-lifecycle';
import { browShapeLabel } from './shape-label';
import { BrowShowcase } from './showcase';
import { emptyStudioSession, studioSessionReducer } from './studio-session';
import type { BrowStyleItem } from './types';
import { useBrowGeneration } from './use-brow-generation';

const subscribeToMountedState = () => () => {};
const getClientMountedState = () => true;
const getServerMountedState = () => false;

type PendingPhoto =
  | { kind: 'file'; file: File }
  | { kind: 'sample'; src: string }
  | { kind: 'picker' }
  | null;

export function BrowTintStudio({
  styles,
  mode = 'home',
}: {
  styles: BrowStyleItem[];
  mode?: 'home' | 'filter';
}) {
  const t = useTranslations('pages.ai-brow-tint');
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isMounted = useSyncExternalStore(
    subscribeToMountedState,
    getClientMountedState,
    getServerMountedState
  );
  const { user, isCheckSign, setIsShowSignModal, fetchUserCredits } =
    useAppContext();
  const remainingCredits = user?.credits?.remainingCredits ?? 0;
  const [session, dispatch] = useReducer(
    studioSessionReducer,
    emptyStudioSession
  );
  const {
    file: photoFile,
    rawUrl: photoPreview,
    confirmed: confirmedAnalysis,
    selectedStyleId,
  } = session;
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const sampleRequestRef = useRef<AbortController | null>(null);
  const selectedStyle = useMemo(
    () => styles.find((style) => style.id === selectedStyleId) ?? null,
    [styles, selectedStyleId]
  );
  const translateServerError = useCallback(
    (code: string) =>
      code === 'moderation_denied' || code === 'moderation_unavailable'
        ? t(`errors.${code}`)
        : code,
    [t]
  );
  const generation = useBrowGeneration({
    onCreditsChanged: fetchUserCredits,
    translateServerError,
  });
  const { isLocked, reset } = generation;

  // Studio owns the raw preview; Workspace keeps the normalized URL alive
  // across confirmation and generation. Neither photo is uploaded here.
  useEffect(
    () => () => {
      sampleRequestRef.current?.abort();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  const selectLocalFile = useCallback(
    (file: File) => {
      if (isLocked) return;
      const error = validateBrowPhotoFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const preview = URL.createObjectURL(file);
      objectUrlRef.current = preview;
      reset();
      dispatch({ type: 'accept-photo', file, rawUrl: preview });
    },
    [isLocked, reset]
  );

  const loadSample = useCallback(
    async (src: string) => {
      sampleRequestRef.current?.abort();
      const controller = new AbortController();
      sampleRequestRef.current = controller;
      setLoadingSample(true);
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to load sample');
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        selectLocalFile(
          new File([blob], src.split('/').pop() || 'sample.jpg', {
            type: blob.type || 'image/jpeg',
          })
        );
      } catch {
        if (!controller.signal.aborted)
          toast.error(t('ui.could_not_load_this_sample_please_try_again'));
      } finally {
        if (!controller.signal.aborted) setLoadingSample(false);
      }
    },
    [t, selectLocalFile]
  );

  const requestPhoto = useCallback(
    (next: PendingPhoto) => {
      if (isLocked || loadingSample) return;
      if (next?.kind === 'file') {
        const error = validateBrowPhotoFile(next.file);
        if (error) {
          toast.error(error);
          return;
        }
      }
      setPendingPhoto(next);
      setShowGuidelines(true);
    },
    [isLocked, loadingSample]
  );

  const closeGuidelines = useCallback(() => {
    setShowGuidelines(false);
    setPendingPhoto(null);
  }, []);

  const confirmGuidelines = useCallback(() => {
    setShowGuidelines(false);
    setPendingPhoto(null);
    if (isLocked || loadingSample) return;
    if (pendingPhoto?.kind === 'file') selectLocalFile(pendingPhoto.file);
    if (pendingPhoto?.kind === 'sample') void loadSample(pendingPhoto.src);
    if (pendingPhoto?.kind === 'picker') inputRef.current?.click();
  }, [isLocked, loadingSample, pendingPhoto, selectLocalFile, loadSample]);

  const clearPhoto = useCallback(() => {
    if (isLocked || loadingSample) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    reset();
    dispatch({ type: 'remove' });
  }, [isLocked, loadingSample, reset]);

  const invalidateAnalysis = useCallback(() => {
    if (isLocked) return;
    dispatch({ type: 'invalidate' });
    reset();
  }, [isLocked, reset]);

  const selectStyle = useCallback(
    (style: BrowStyleItem) => {
      if (isLocked || loadingSample) return;
      reset();
      dispatch({ type: 'select-style', id: style.id });
    },
    [isLocked, loadingSample, reset]
  );

  const setEditorOpen = useCallback((open: boolean) => {
    dispatch({ type: 'set-open', open });
    if (!open)
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            '#ai-brow-tint-studio [data-brow-continue]'
          )
          ?.focus();
      });
  }, []);
  const confirmAnalysis = useCallback(
    (value: ConfirmedBrowAnalysis) => dispatch({ type: 'confirm', value }),
    []
  );
  const updatePreview = useCallback(
    (rawUrl: string, preview: BrowPreviewState) =>
      dispatch({ type: 'preview', rawUrl, preview }),
    []
  );

  const generate = useCallback(async () => {
    if (isLocked || loadingSample) return;
    if (!user) {
      setIsShowSignModal(true);
      return;
    }
    if (!selectedStyle || !confirmedAnalysis) return;
    if (remainingCredits < BROW_MAPPING_CREDITS) {
      toast.error(t('ui.insufficient_credits'));
      return;
    }
    await generation.start({
      styleId: selectedStyle.id,
      styleSlug: selectedStyle.slug,
      photo: confirmedAnalysis.photo.blob,
      guide: confirmedAnalysis.guide,
    });
  }, [
    isLocked,
    loadingSample,
    user,
    selectedStyle,
    confirmedAnalysis,
    remainingCredits,
    t,
    setIsShowSignModal,
    generation,
  ]);

  return (
    <section
      id="ai-brow-tint-studio"
      className="bg-background w-full scroll-mt-20"
    >
      <div
        id="brow-app"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-24 pb-10 md:pt-28 md:pb-24"
      >
        <header className="mb-5 text-center md:mb-8">
          <div>
            <h1 className="font-display text-foreground mx-auto max-w-4xl text-2xl leading-tight font-semibold tracking-tight md:text-4xl lg:text-[44px]">
              {mode === 'filter' ? t('ui.filter_title') : t('studio.title')}
            </h1>
            <p className="text-foreground/75 mx-auto mt-3 max-w-xl text-xs leading-relaxed md:text-base">
              {mode === 'filter'
                ? t('ui.filter_subtitle')
                : t('studio.subtitle')}
            </p>
          </div>
        </header>
        <div className="mb-6 flex flex-col items-center gap-2">
          <button
            type="button"
            data-brow-upload
            disabled={isLocked || loadingSample}
            onClick={() => requestPhoto({ kind: 'picker' })}
            className="bg-primary text-primary-foreground focus-visible:outline-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50"
          >
            <Upload aria-hidden="true" className="size-4" />
            {t('ui.upload')}
          </button>
          <p className="text-muted-foreground text-xs">
            JPG · PNG · WebP · {t('ui.up_to_15_mb')}
          </p>
        </div>
        <input
          ref={inputRef}
          id="brow-photo-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={isLocked || loadingSample}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) selectLocalFile(file);
          }}
        />
        {mode === 'filter' ? (
          <BrowFilterEditor
            key={photoPreview ?? 'empty'}
            file={photoFile}
            styles={styles}
            disabled={isLocked || loadingSample}
            confirmed={!!confirmedAnalysis}
            resultUrl={generation.state.resultUrl}
            onConfirm={confirmAnalysis}
            onInvalidate={invalidateAnalysis}
            onSelectStyle={selectStyle}
            onTryAnother={invalidateAnalysis}
            action={
              <BrowGenerationActions
                confirmationLabel={t('ui.choose_a_shape')}
                authenticated={!!user}
                checkingAuth={!isMounted || isCheckSign}
                remainingCredits={remainingCredits}
                confirmed={!!confirmedAnalysis}
                selected={!!selectedStyle}
                locked={isLocked || loadingSample}
                state={generation.state}
                onGenerate={generate}
                onSignIn={() => setIsShowSignModal(true)}
              />
            }
            status={
              <BrowGenerationStatus
                state={generation.state}
                styleSlug={null}
                onRetryQuery={generation.retryQuery}
                loadingSample={loadingSample}
              />
            }
          />
        ) : (
          <>
            <BrowShowcase
              styles={styles}
              selectedStyleId={selectedStyleId}
              hasPhoto={!!photoFile}
              disabled={isLocked || loadingSample}
              loadingSample={loadingSample}
              preview={
                photoPreview ? (
                  <BrowPortraitPreview
                    preview={session.preview}
                    rawUrl={photoPreview}
                    resultUrl={generation.state.resultUrl}
                    zh={isZh}
                  />
                ) : null
              }
              onPickFile={() => requestPhoto({ kind: 'picker' })}
              onDropFile={(file) => requestPhoto({ kind: 'file', file })}
              onSelectSample={(src) => requestPhoto({ kind: 'sample', src })}
              onOpenGuidelines={() => requestPhoto(null)}
              onContinue={() => setEditorOpen(true)}
              onClear={clearPhoto}
              onSelectStyle={selectStyle}
            />
            <BrowWorkspace
              open={session.editorOpen}
              onOpenChange={setEditorOpen}
              onPreviewChange={updatePreview}
              file={photoFile}
              rawPhotoUrl={photoPreview}
              confirmed={!!confirmedAnalysis}
              disabled={isLocked || loadingSample}
              onConfirm={confirmAnalysis}
              onInvalidate={invalidateAnalysis}
              onPickFile={() => requestPhoto({ kind: 'picker' })}
              onDropFile={(file) => requestPhoto({ kind: 'file', file })}
              onSelectSample={(src) => requestPhoto({ kind: 'sample', src })}
              onClear={clearPhoto}
              onOpenGuidelines={() => requestPhoto(null)}
              selectedStyle={
                selectedStyle
                  ? {
                      name: browShapeLabel(selectedStyle, locale),
                      thumbnail: selectedStyle.thumbnail,
                    }
                  : null
              }
              resultUrl={generation.state.resultUrl}
              catalog={
                <BrowCatalogPanel
                  styles={styles}
                  selectedStyleId={selectedStyleId}
                  confirmed={!!confirmedAnalysis}
                  disabled={isLocked || loadingSample}
                  onSelect={selectStyle}
                />
              }
              action={
                <BrowGenerationActions
                  authenticated={!!user}
                  checkingAuth={!isMounted || isCheckSign}
                  remainingCredits={remainingCredits}
                  confirmed={!!confirmedAnalysis}
                  selected={!!selectedStyle}
                  locked={isLocked || loadingSample}
                  state={generation.state}
                  onGenerate={generate}
                  onSignIn={() => setIsShowSignModal(true)}
                />
              }
              status={
                <BrowGenerationStatus
                  state={generation.state}
                  styleSlug={generation.resultStyleSlug}
                  onRetryQuery={generation.retryQuery}
                  loadingSample={loadingSample}
                />
              }
            />
          </>
        )}
        {mode === 'home' && (
          <ul
            id="features"
            className="mt-12 mb-4 grid scroll-mt-24 gap-4 sm:grid-cols-3 md:mt-20 md:mb-6"
            style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          >
            {[
              {
                icon: ScanFace,
                title: t('ui.feature_analysis'),
                text: t('ui.feature_analysis_text'),
              },
              {
                icon: Sparkles,
                title: t('ui.feature_filter'),
                text: t('ui.feature_filter_text'),
              },
              {
                icon: Users,
                title: t('ui.feature_personal'),
                text: t('ui.feature_personal_text'),
              },
            ].map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="border-border/40 bg-background flex items-start gap-3 rounded-3xl border p-5 sm:p-6"
              >
                <Icon
                  aria-hidden="true"
                  className="text-muted-foreground mt-0.5 size-5 shrink-0"
                />
                <div>
                  <p className="text-foreground text-sm font-medium">{title}</p>
                  <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PhotoGuidelinesModal
        open={showGuidelines}
        onClose={closeGuidelines}
        onConfirm={confirmGuidelines}
      />
    </section>
  );
}
