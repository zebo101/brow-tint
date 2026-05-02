'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { annotate } from 'rough-notation';
import type { RoughAnnotation } from 'rough-notation/lib/model';
import {
  ArrowRight,
  Coins,
  Download,
  Image as ImageIcon,
  Info,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Button,
  Card,
  Chip,
  Modal,
  ScrollShadow,
  SearchField,
  Separator,
  Spinner,
} from '@heroui/react';
import { EmptyState, Sheet } from '@heroui-pro/react';

import { Link } from '@/core/i18n/navigation';
import { PhotoGuidelinesModal } from '@/shared/blocks/common/photo-guidelines-modal';
import { useAppContext } from '@/shared/contexts/app';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

import type { BrowStyleItem } from './types';
import { resizeImageForUpload } from './resize-image';

const POLL_INTERVAL_MS = 5000;
const GENERATION_TIMEOUT_MS = 180_000;
const MAX_POLL_ERRORS = 3;
const PHOTO_STORAGE_KEY = 'brow:photoUrl';
const SAMPLE_PHOTOS: { key: 'light' | 'medium' | 'deep'; src: string }[] = [
  { key: 'light', src: '/imgs/cases/1.jpg' },
  { key: 'medium', src: '/imgs/cases/4.jpg' },
  { key: 'deep', src: '/imgs/cases/7.jpg' },
];

type GenerationStatus = 'idle' | 'generating' | 'success' | 'failed';

function extractResultUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const extractResultJsonUrls = (resultJson: any): string[] => {
      let value = resultJson;
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          return [];
        }
      }

      const resultUrls = value?.resultUrls;
      if (!Array.isArray(resultUrls)) return [];

      return resultUrls.filter(
        (url: any): url is string => typeof url === 'string' && url.length > 0
      );
    };

    const resultJsonUrls = extractResultJsonUrls(
      parsed?.data?.resultJson ?? parsed?.resultJson
    );
    if (resultJsonUrls.length > 0) return resultJsonUrls;

    const output =
      parsed?.output ?? parsed?.images ?? parsed?.data ?? parsed?.image;
    if (typeof output === 'string') return [output];
    if (Array.isArray(output)) {
      return output
        .map((item: any) =>
          typeof item === 'string'
            ? item
            : item?.url ??
              item?.uri ??
              item?.src ??
              item?.image ??
              item?.imageUrl ??
              null
        )
        .filter(Boolean);
    }
    if (output && typeof output === 'object') {
      const url =
        output.url ??
        output.uri ??
        output.src ??
        output.image ??
        output.imageUrl;
      if (typeof url === 'string') return [url];
    }
  } catch {
    // not valid JSON
  }
  return [];
}

/**
 * Same hand-drawn underline pattern as the shared Highlighter (ref + useEffect
 * + rough-notation), but with the `stroke` post-processed to use an SVG
 * linearGradient so we can do a pink-to-white gradient. rough-notation itself
 * accepts only a single `color`, so after `.show()` we walk into the rendered
 * `<svg.rough-annotation>` and rewrite each path's stroke attr to point at a
 * gradient we inject under `<defs>`.
 */
function GradientHighlighter({
  children,
  colors,
  strokeWidth = 2,
  padding = 3,
}: {
  children: React.ReactNode;
  colors: [string, string, ...string[]];
  strokeWidth?: number;
  padding?: number;
}) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const annotationRef = useRef<RoughAnnotation | null>(null);
  const reactId = useId();
  const gradId = `bt-grad-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const annotation = annotate(element, {
      type: 'underline',
      color: '#000', // placeholder — overridden by gradient below
      strokeWidth,
      animationDuration: 600,
      iterations: 2,
      padding,
      multiline: true,
    });
    annotation.show();
    annotationRef.current = annotation;

    const applyGradient = () => {
      const parent = element.parentElement;
      if (!parent) return;
      const ns = 'http://www.w3.org/2000/svg';
      parent
        .querySelectorAll<SVGSVGElement>('svg.rough-annotation')
        .forEach((svg) => {
          // Don't double-inject if React re-runs the effect.
          if (svg.querySelector(`#${gradId}`)) return;
          let defs = svg.querySelector('defs');
          if (!defs) {
            defs = document.createElementNS(ns, 'defs');
            svg.insertBefore(defs, svg.firstChild);
          }
          const grad = document.createElementNS(ns, 'linearGradient');
          grad.setAttribute('id', gradId);
          grad.setAttribute('x1', '0%');
          grad.setAttribute('y1', '0%');
          grad.setAttribute('x2', '100%');
          grad.setAttribute('y2', '0%');
          colors.forEach((color, i) => {
            const stop = document.createElementNS(ns, 'stop');
            stop.setAttribute(
              'offset',
              `${Math.round((i / (colors.length - 1)) * 100)}%`
            );
            stop.setAttribute('stop-color', color);
            grad.appendChild(stop);
          });
          defs.appendChild(grad);
          svg.querySelectorAll('path').forEach((path) => {
            path.setAttribute('stroke', `url(#${gradId})`);
          });
        });
    };

    // rough-notation paints over animationDuration; re-apply once at the
    // start (some browsers paint immediately) and again after it settles.
    requestAnimationFrame(applyGradient);
    const t = setTimeout(applyGradient, 650);

    const ro = new ResizeObserver(() => {
      annotation.hide();
      annotation.show();
      requestAnimationFrame(applyGradient);
    });
    ro.observe(element);

    return () => {
      clearTimeout(t);
      ro.disconnect();
      annotation.remove();
    };
  }, [gradId, strokeWidth, padding, colors]);

  return (
    <span ref={elementRef} className="relative inline-block">
      {children}
    </span>
  );
}

interface BrowTintStudioProps {
  styles: BrowStyleItem[];
}

export function BrowTintStudio({ styles }: BrowTintStudioProps) {
  const t = useTranslations('pages.ai-brow-tint');
  const { user, isCheckSign, setIsShowSignModal, fetchUserCredits } =
    useAppContext();
  const remainingCredits = user?.credits?.remainingCredits ?? 0;

  // Photo state
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  type UploadPhase = 'idle' | 'resizing' | 'uploading';
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadKB, setUploadKB] = useState<number | null>(null);
  const isUploading = uploadPhase !== 'idle';
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingSampleSrc, setPendingSampleSrc] = useState<string | null>(null);
  // Tracks whether the modal was opened to gate the file-picker click
  // (vs. gating an already-chosen file from drag-drop / sample). When set,
  // confirming the guidelines triggers the hidden input → opens the picker.
  const [pendingAction, setPendingAction] = useState<'pickFile' | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // Anchor for the right-side styles panel. On stacked (< lg) layouts we
  // auto-scroll here after a successful photo upload so the user can pick a
  // style without an extra swipe down.
  const stylesAnchorRef = useRef<HTMLElement>(null);

  // Style state
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const selectedStyle = useMemo(
    () => styles.find((s) => s.id === selectedStyleId) ?? null,
    [styles, selectedStyleId]
  );
  const [stylesDrawerOpen, setStylesDrawerOpen] = useState(false);

  // Generation state. genTokenRef is bumped on every new generate() call AND
  // on any photo/style change. Stale polls compare the captured token against
  // the current ref and bail out — this prevents the four race conditions
  // around mid-generation photo/style changes.
  const [genStatus, setGenStatus] = useState<GenerationStatus>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultStyleSlug, setResultStyleSlug] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationStartTimeRef = useRef<number | null>(null);
  const pollErrorCountRef = useRef(0);
  const genTokenRef = useRef(0);
  const isMountedRef = useRef(true);

  // Hydrate photo from sessionStorage on mount; <img onError> in the preview
  // tags will clear the slot if the R2 link 404s.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem(PHOTO_STORAGE_KEY);
    if (stored) {
      setPhotoUrl(stored);
      setPhotoPreview(stored);
    }
  }, []);

  // Cleanup on unmount: revoke blob URL, clear poll, kill any in-flight gen.
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      genTokenRef.current += 1;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // Inline picker tiles for the right-panel grid. Trending first, then
  // popular, then the rest — capped at 12 (3 rows × 4 cols on desktop)
  // so the right card balances visually against the photo card on the
  // left. Users can still hit "Browse all" to open the full picker.
  // We always include the currently selected style so it's reachable
  // from the inline grid even if it's outside the curated top 12.
  const emptyStateStyles = useMemo(() => {
    if (styles.length === 0) return [];
    const trending = styles.filter((s) => s.trending);
    const popular = styles.filter((s) => s.popular && !s.trending);
    const rest = styles.filter((s) => !s.popular && !s.trending);
    const top = [...trending, ...popular, ...rest].slice(0, 16);
    if (
      selectedStyleId &&
      !top.some((s) => s.id === selectedStyleId)
    ) {
      const sel = styles.find((s) => s.id === selectedStyleId);
      if (sel) top.push(sel);
    }
    return top;
  }, [styles, selectedStyleId]);

  // ---------------------- Upload flow ----------------------

  const uploadFile = useCallback(async (file: File) => {
    isMountedRef.current = true;
    setUploadPhase('resizing');
    setUploadKB(null);
    // 90s ceiling so a stuck request (R2 unreachable / slow network)
    // surfaces as a real error rather than an infinite spinner.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    const startedAt = Date.now();
    console.log('[upload] start', {
      name: file.name,
      type: file.type,
      sizeKB: Math.round(file.size / 1024),
    });
    try {
      const resized = await resizeImageForUpload(file, {
        maxEdge: 1600,
        quality: 0.85,
      });
      console.log('[upload] resize', {
        originalKB: Math.round(file.size / 1024),
        resizedKB: Math.round(resized.size / 1024),
        skipped: resized === file,
      });
      setUploadKB(Math.round(resized.size / 1024));
      setUploadPhase('uploading');
      const formData = new FormData();
      formData.append('files', resized);
      const resp = await fetch('/api/storage/upload-image', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      console.log(
        '[upload] response received',
        resp.status,
        `${Date.now() - startedAt}ms`
      );
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(
          `Upload failed (HTTP ${resp.status})${text ? `: ${text}` : ''}`
        );
      }
      const { data } = await resp.json();
      const url = data?.urls?.[0] || data?.url || data?.src;
      if (!url) throw new Error('No URL returned');
      console.log('[upload] success', url);

      // Bail out if we unmounted while waiting on the network.
      if (!isMountedRef.current) {
        console.warn('[upload] skipped state update after unmount', url);
        return;
      }

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const localPreview = URL.createObjectURL(file);
      objectUrlRef.current = localPreview;

      setPhotoUrl(url);
      setPhotoPreview(localPreview);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(PHOTO_STORAGE_KEY, url);
        // On stacked layouts (< lg breakpoint, where the grid collapses to
        // a single column), bring the styles card into view so the user
        // doesn't have to scroll down to pick a brow look. Keyed to the
        // exact `lg` breakpoint at which `lg:grid-cols-[...]` activates.
        if (window.matchMedia('(max-width: 1023px)').matches) {
          requestAnimationFrame(() => {
            stylesAnchorRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          });
        }
      }
    } catch (err: any) {
      const elapsed = Date.now() - startedAt;
      console.error('[upload] failed', err, `${elapsed}ms`);
      if (isMountedRef.current) {
        const msg =
          err?.name === 'AbortError'
            ? 'Upload timed out after 90s. Check your network or try a smaller file.'
            : err?.message || 'Upload failed';
        toast.error(msg);
      }
    } finally {
      clearTimeout(timeoutId);
      if (isMountedRef.current) {
        setUploadPhase('idle');
        setUploadKB(null);
      }
    }
  }, []);

  const uploadSample = useCallback(
    async (src: string) => {
      try {
        const resp = await fetch(src);
        if (!resp.ok) throw new Error('Failed to load sample');
        const blob = await resp.blob();
        const file = new File([blob], src.split('/').pop() || 'sample.jpg', {
          type: blob.type || 'image/jpeg',
        });
        await uploadFile(file);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load sample');
      }
    },
    [uploadFile]
  );

  const validateFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return false;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File must be under 25 MB.');
      return false;
    }
    return true;
  }, []);

  // Drag-drop path: file is already chosen, show modal then upload on
  // confirm. This still presents guidelines AFTER the drop because the
  // drop gesture itself is the file submission.
  const handleFileSelect = useCallback(
    (file: File) => {
      if (!validateFile(file)) return;
      setPendingFile(file);
      setPendingSampleSrc(null);
      setPendingAction(null);
      setShowGuidelines(true);
    },
    [validateFile]
  );

  // File-picker path: user has already passed the modal before the picker
  // opened, so a successfully picked file uploads immediately — no second
  // modal. Triggered from the hidden input's onChange.
  const handleFileDirect = useCallback(
    (file: File) => {
      if (!validateFile(file)) return;
      uploadFile(file);
    },
    [validateFile, uploadFile]
  );

  // Click-to-pick path: show guidelines first, then open the file picker
  // on confirm. This is the "modal before submit" flow the user wanted.
  const handleOpenPicker = useCallback(() => {
    setPendingFile(null);
    setPendingSampleSrc(null);
    setPendingAction('pickFile');
    setShowGuidelines(true);
  }, []);

  const handleSampleSelect = useCallback((src: string) => {
    setPendingSampleSrc(src);
    setPendingFile(null);
    setPendingAction(null);
    setShowGuidelines(true);
  }, []);

  const handleGuidelinesConfirm = useCallback(() => {
    setShowGuidelines(false);
    if (pendingFile) {
      uploadFile(pendingFile);
      setPendingFile(null);
    } else if (pendingSampleSrc) {
      uploadSample(pendingSampleSrc);
      setPendingSampleSrc(null);
    } else if (pendingAction === 'pickFile') {
      setPendingAction(null);
      // Programmatic click is allowed because we're still inside the user
      // gesture chain that opened the modal. The id is owned by InputCard.
      const input = document.getElementById(
        'brow-photo-input'
      ) as HTMLInputElement | null;
      input?.click();
    }
  }, [pendingFile, pendingSampleSrc, pendingAction, uploadFile, uploadSample]);

  const handleGuidelinesClose = useCallback(() => {
    setShowGuidelines(false);
    setPendingFile(null);
    setPendingSampleSrc(null);
    setPendingAction(null);
  }, []);

  const handleClearPhoto = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPhotoUrl(null);
    setPhotoPreview(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(PHOTO_STORAGE_KEY);
    }
  }, []);

  // ---------------------- Generation flow ----------------------

  const generate = useCallback(async () => {
    if (!user) {
      setIsShowSignModal(true);
      return;
    }
    if (!selectedStyle || !photoUrl) return;
    if (remainingCredits < selectedStyle.credits) {
      toast.error('Insufficient credits');
      return;
    }

    const clearPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    clearPoll();
    genTokenRef.current += 1;
    const myToken = genTokenRef.current;
    const myStyleSlug = selectedStyle.slug;

    generationStartTimeRef.current = Date.now();
    pollErrorCountRef.current = 0;
    setGenStatus('generating');
    setResultUrl(null);
    setResultStyleSlug(null);

    try {
      const resp = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'kie',
          mediaType: 'image',
          model: 'nano-banana-pro',
          scene: 'image-to-image',
          styleId: selectedStyle.id,
          options: { image_input: [photoUrl] },
        }),
      });

      if (genTokenRef.current !== myToken || !isMountedRef.current) return;

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'Generation failed');
      }

      const { data } = await resp.json();
      if (!data) throw new Error('No task data returned');

      const taskId = data.id;
      pollRef.current = setInterval(async () => {
        if (genTokenRef.current !== myToken) {
          clearPoll();
          return;
        }

        const startTime = generationStartTimeRef.current;
        if (startTime && Date.now() - startTime > GENERATION_TIMEOUT_MS) {
          clearPoll();
          setGenStatus('failed');
          toast.error('Generation timed out. Please try again.');
          fetchUserCredits();
          return;
        }

        try {
          const pollResp = await fetch('/api/ai/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId }),
          });
          if (genTokenRef.current !== myToken) return;
          if (!pollResp.ok) {
            throw new Error(`Query failed with status ${pollResp.status}`);
          }

          const { code, message, data: task } = await pollResp.json();
          if (genTokenRef.current !== myToken) return;
          if (code !== 0 || !task) {
            throw new Error(message || 'Query task failed');
          }

          pollErrorCountRef.current = 0;
          const taskStatus = task.status;

          if (taskStatus === 'success') {
            clearPoll();
            const urls = [
              ...extractResultUrls(task.taskInfo),
              ...extractResultUrls(task.taskResult),
            ];
            if (urls.length > 0) {
              setResultUrl(urls[0]);
              setResultStyleSlug(myStyleSlug);
              setGenStatus('success');
            } else {
              setGenStatus('failed');
              toast.error('Could not extract result image');
            }
            fetchUserCredits();
          } else if (taskStatus === 'failed') {
            clearPoll();
            setGenStatus('failed');
            toast.error('Generation failed');
            fetchUserCredits();
          }
        } catch (err: any) {
          if (genTokenRef.current !== myToken) return;
          pollErrorCountRef.current += 1;
          if (pollErrorCountRef.current >= MAX_POLL_ERRORS) {
            clearPoll();
            setGenStatus('failed');
            toast.error(
              err?.message ||
                'Generation status check failed. Please try again.'
            );
            fetchUserCredits();
          }
        }
      }, POLL_INTERVAL_MS);
    } catch (err: any) {
      if (genTokenRef.current !== myToken || !isMountedRef.current) return;
      setGenStatus('failed');
      toast.error(err.message || 'Generation failed');
    }
  }, [
    user,
    selectedStyle,
    photoUrl,
    remainingCredits,
    setIsShowSignModal,
    fetchUserCredits,
  ]);

  // Cancel any in-flight generation when photo/style changes; reset visible
  // result so a stale result can never bleed into a now-stale UI.
  useEffect(() => {
    genTokenRef.current += 1;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setGenStatus('idle');
    setResultUrl(null);
    setResultStyleSlug(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStyleId, photoUrl]);

  const handleSelectStyle = useCallback((style: BrowStyleItem) => {
    setSelectedStyleId(style.id);
    setStylesDrawerOpen(false);
  }, []);

  // ---------------------- Render ----------------------

  return (
    <section id="ai-brow-tint-studio" className="bg-background w-full scroll-mt-20">
      <div className="mx-auto flex max-w-6xl flex-col justify-center px-4 pt-6 pb-10 md:min-h-[calc(100vh-4rem)] md:pt-20 md:pb-24">
        <header className="mb-6 text-center md:mb-14">
          <h1 className="font-display text-foreground text-3xl font-semibold leading-[1.1] tracking-tight md:text-4xl lg:text-[44px]">
            {t('studio.title')}
          </h1>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm md:text-base">
            {t('studio.subtitle')}
          </p>
        </header>

        <div className="grid items-stretch gap-4 md:gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* LEFT: input — single Card with Photo + Generate sections */}
          <aside>
            <InputCard
              t={t}
              photoPreview={photoPreview}
              isUploading={isUploading}
              uploadPhase={uploadPhase}
              uploadKB={uploadKB}
              onSelectFile={handleFileSelect}
              onUploadDirect={handleFileDirect}
              onOpenPicker={handleOpenPicker}
              onSelectSample={handleSampleSelect}
              onClear={handleClearPhoto}
              onOpenGuidelines={() => setShowGuidelines(true)}
              onPreviewError={handleClearPhoto}
              isCheckSign={isCheckSign}
              user={user}
              remainingCredits={remainingCredits}
              selectedStyle={selectedStyle}
              hasPhoto={!!photoUrl}
              isGenerating={genStatus === 'generating'}
              onGenerate={generate}
              onSignIn={() => setIsShowSignModal(true)}
            />
          </aside>

          {/* RIGHT: preview */}
          <aside ref={stylesAnchorRef} className="scroll-mt-20">
            <ResultPanel
              t={t}
              genStatus={genStatus}
              resultUrl={resultUrl}
              resultStyleSlug={resultStyleSlug}
              photoPreview={photoPreview}
              selectedStyle={selectedStyle}
              emptyStateStyles={emptyStateStyles}
              onPickStyle={handleSelectStyle}
              onOpenAll={() => setStylesDrawerOpen(true)}
              onRegenerate={generate}
              onTryAnother={() => {
                setSelectedStyleId(null);
                setStylesDrawerOpen(true);
              }}
              onPreviewError={handleClearPhoto}
            />
          </aside>
        </div>
      </div>

      <StylesPicker
        t={t}
        open={stylesDrawerOpen}
        onClose={() => setStylesDrawerOpen(false)}
        styles={styles}
        selectedStyleId={selectedStyleId}
        onSelect={handleSelectStyle}
      />

      <PhotoGuidelinesModal
        open={showGuidelines}
        onClose={handleGuidelinesClose}
        onConfirm={handleGuidelinesConfirm}
      />
    </section>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface InputCardProps {
  t: ReturnType<typeof useTranslations>;
  photoPreview: string | null;
  isUploading: boolean;
  uploadPhase: 'idle' | 'resizing' | 'uploading';
  uploadKB: number | null;
  /** Drag-drop path: file is already chosen, parent gates with modal. */
  onSelectFile: (file: File) => void;
  /** File-picker path: parent already showed modal; upload directly. */
  onUploadDirect: (file: File) => void;
  /** Click-to-pick path: parent shows modal, then triggers picker. */
  onOpenPicker: () => void;
  onSelectSample: (src: string) => void;
  onClear: () => void;
  onOpenGuidelines: () => void;
  onPreviewError: () => void;
  isCheckSign: boolean;
  user: ReturnType<typeof useAppContext>['user'];
  remainingCredits: number;
  selectedStyle: BrowStyleItem | null;
  hasPhoto: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onSignIn: () => void;
}

/**
 * Single-card input panel for the studio. Combines the photo upload zone
 * (drop area / preview thumbnail / sample chips) with the Generate CTA in
 * one Card so the left column stays compact and the Generate button stays
 * above the fold on a 900-tall viewport.
 */
function InputCard({
  t,
  photoPreview,
  isUploading,
  uploadPhase,
  uploadKB,
  onSelectFile,
  onUploadDirect,
  onOpenPicker,
  onSelectSample,
  onClear,
  onOpenGuidelines,
  onPreviewError,
  isCheckSign,
  user,
  remainingCredits,
  selectedStyle,
  hasPhoto,
  isGenerating,
  onGenerate,
  onSignIn,
}: InputCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Photo frame matches the user's uploaded image aspect ratio so the photo
  // displays at native dimensions — no crop, no letterbox. Clamped to a wide
  // sane range [9/16, 16/9] so a freak panorama can't squash the studio.
  const [photoAspect, setPhotoAspect] = useState<number | null>(null);
  useEffect(() => {
    if (!photoPreview) setPhotoAspect(null);
  }, [photoPreview]);
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const ratio = img.naturalWidth / img.naturalHeight;
      setPhotoAspect(Math.min(Math.max(ratio, 9 / 16), 16 / 9));
    }
  };

  const credits = selectedStyle?.credits ?? 0;
  const canGenerate =
    !!user && !!selectedStyle && hasPhoto && remainingCredits >= credits;

  return (
    <Card className="relative flex h-full min-h-[420px] flex-col bg-gray-100 md:min-h-[680px]">
      {/* Photo tips — tucked into the top-right corner, kept small and soft
          so it doesn't compete with the polaroid. The polaroid caption
          ("your photo" / "before") replaces the redundant Card title. */}
      <button
        type="button"
        onClick={onOpenGuidelines}
        className="text-default-400 hover:text-default-600 absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-[10px] font-normal tracking-wide transition-colors"
      >
        <Info className="h-3 w-3" />
        {t('studio.left.photo_tips')}
      </button>

      <Card.Content className="flex flex-1 flex-col justify-center gap-4 px-5 pt-10 pb-4">
        {photoPreview ? (
          // Polaroid frame: white photo paper with soft shadow + handwritten
          // caption. Clicking the preview re-opens the file picker (parity
          // with the empty DropZone state). The X button stops propagation
          // so it clears the photo without immediately re-prompting upload.
          <div className="group rounded-sm bg-white p-3 pb-8 shadow-lg ring-1 ring-black/5 transition-all duration-300 hover:-rotate-1 hover:scale-[1.01] hover:shadow-xl">
            <div
              style={{ aspectRatio: photoAspect ?? 3 / 4 }}
              className={cn(
                'bg-default-50 relative flex w-full items-center justify-center overflow-hidden',
                isUploading ? 'cursor-wait' : 'cursor-pointer'
              )}
              role="button"
              tabIndex={isUploading ? -1 : 0}
              aria-busy={isUploading || undefined}
              onClick={() => {
                if (isUploading) return;
                inputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (isUploading) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              aria-label={t('studio.left.photo_change')}
            >
              <img
                src={photoPreview}
                alt="Your photo"
                onLoad={handleImageLoad}
                className={cn(
                  'block h-full w-full object-cover transition-opacity',
                  isUploading && 'opacity-40'
                )}
                onError={onPreviewError}
              />
              {/* Hover affordance — hidden while a replacement upload is in flight */}
              {!isUploading && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-black shadow-md">
                    <Upload className="h-3.5 w-3.5" />
                    {t('studio.left.photo_change')}
                  </span>
                </div>
              )}
              {/* Replace-in-progress overlay so the user gets feedback while
                  resize+upload runs (the preview branch always renders when
                  photoPreview is set, so the DropZone's own spinner never
                  shows during a replacement). */}
              {isUploading && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 backdrop-blur-[1px]">
                  <Spinner color="accent" size="lg" />
                  <span className="text-foreground text-xs font-medium">
                    {uploadPhase === 'resizing'
                      ? t('studio.left.resizing')
                      : uploadKB
                        ? t('studio.left.uploading_size', { kb: uploadKB })
                        : t('studio.left.uploading')}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                disabled={isUploading}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 disabled:opacity-40"
                aria-label={t('studio.left.photo_clear')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Polaroid caption — handwritten "before" sets up the
                before/after pairing with the right-side result. */}
            <p className="font-display text-default-400 mt-4 text-center text-[13px] italic tracking-wide">
              before
            </p>
          </div>
        ) : (
          // Click-handler wrapper instead of <label htmlFor> so we can
          // show the guidelines modal BEFORE the file picker opens. The
          // label-based trigger fires the picker on any click before
          // React state can settle. Drag-drop still goes through onDrop
          // and gates with the modal AFTER the file is chosen.
          // Polaroid frame for the empty state — clean photo area (no dashed
          // border; the polaroid itself is the visual cue). Uses native HTML5
          // drag/drop on the inner div instead of the HeroUI Pro DropZone so
          // we get full control over the visual without its default
          // .drop-zone__area padding/border injection.
          <div className="group rounded-sm bg-white p-3 pb-8 shadow-lg ring-1 ring-black/5 transition-all duration-300 hover:-rotate-1 hover:scale-[1.01] hover:shadow-xl">
            <div
              role="button"
              tabIndex={0}
              onClick={onOpenPicker}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenPicker();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) onSelectFile(file);
              }}
              aria-label={t('studio.left.photo_drop')}
              style={{ aspectRatio: 3 / 4 }}
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden bg-neutral-800 text-center"
            >
              {isUploading ? (
                <>
                  <Spinner color="accent" size="lg" />
                  <p className="font-display text-xs text-white/70">
                    {uploadPhase === 'resizing'
                      ? t('studio.left.resizing')
                      : uploadKB
                        ? t('studio.left.uploading_size', { kb: uploadKB })
                        : t('studio.left.uploading')}
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-white" />
                  <p className="font-display text-sm font-medium tracking-tight text-white">
                    {t('studio.left.photo_drop')}
                  </p>
                  <p className="font-display text-xs text-white/70">
                    {t('studio.left.photo_drop_sub')}
                  </p>
                </>
              )}
            </div>
            {/* Polaroid caption — handwritten placeholder. Sets the
                before/after pairing once the user uploads. */}
            <p className="font-display text-default-400 mt-4 text-center text-[13px] italic tracking-wide">
              your photo
            </p>
          </div>
        )}

        {!photoPreview && (
          // Polaroid is vertically centered via justify-center on Card.Content;
          // samples sit just below the polaroid as a coherent "upload or pick
          // a sample" group.
          <div className="flex items-center gap-2">
            <span className="text-default-500 shrink-0 text-[10px] font-medium uppercase tracking-wider">
              {t('studio.left.photo_sample_label')}
            </span>
            <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
              {SAMPLE_PHOTOS.map((sample) => (
                <button
                  key={sample.key}
                  type="button"
                  onClick={() => onSelectSample(sample.src)}
                  disabled={isUploading}
                  aria-label={t(`step1.samples.${sample.key}`)}
                  className="border-default-200 hover:border-default-400 h-7 w-7 shrink-0 rounded-full border bg-cover bg-center transition-colors disabled:opacity-50"
                  style={{ backgroundImage: `url(${sample.src})` }}
                />
              ))}
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          id="brow-photo-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Direct upload — the guidelines modal already ran before
            // the picker opened (or on the photo-preview re-upload path
            // the user has already seen guidelines once this session).
            if (file) onUploadDirect(file);
            e.target.value = '';
          }}
        />
      </Card.Content>

      <Separator />

      <Card.Footer className="flex flex-col gap-2 px-5 py-4">
        {/* Primary CTA — branches by auth + readiness */}
        {isCheckSign ? (
          <Button
            isDisabled
            fullWidth
            size="lg"
            className="!bg-primary !text-primary-foreground"
          >
            <Spinner size="sm" />
            {t('studio.checking')}
          </Button>
        ) : !user ? (
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onPress={onSignIn}
            className="!bg-primary !text-primary-foreground hover:!bg-primary/85"
          >
            {t('buttons.signin')}
          </Button>
        ) : !hasPhoto ? (
          <Button
            isDisabled
            fullWidth
            size="lg"
            className="!bg-primary !text-primary-foreground"
          >
            {t('studio.cta.need_photo')}
          </Button>
        ) : !selectedStyle ? (
          <Button
            isDisabled
            fullWidth
            size="lg"
            className="!bg-primary !text-primary-foreground"
          >
            {t('studio.cta.need_style')}
          </Button>
        ) : remainingCredits < credits ? (
          <Link href="/pricing" className="block">
            <Button variant="danger" fullWidth size="lg">
              {t('buttons.no_credits')}
            </Button>
          </Link>
        ) : (
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onPress={onGenerate}
            isDisabled={isGenerating || !canGenerate}
            isPending={isGenerating}
            className="!bg-primary !text-primary-foreground hover:!bg-primary/85"
          >
            {isGenerating ? (
              t('studio.cta.generating')
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t('buttons.generate', { credits })}
              </>
            )}
          </Button>
        )}

        {/* Credits balance — single-line subtle text below the CTA */}
        {!isCheckSign && user && (
          <Link
            href={remainingCredits < credits ? '/pricing' : '/settings/credits'}
            className="text-default-500 hover:text-foreground inline-flex items-center justify-center gap-1 text-center text-[11px] transition-colors"
          >
            <Coins className="h-3 w-3" />
            {t('header.credits', { n: remainingCredits })}
          </Link>
        )}
      </Card.Footer>
    </Card>
  );
}

interface ResultPanelProps {
  t: ReturnType<typeof useTranslations>;
  genStatus: GenerationStatus;
  resultUrl: string | null;
  resultStyleSlug: string | null;
  photoPreview: string | null;
  selectedStyle: BrowStyleItem | null;
  emptyStateStyles: BrowStyleItem[];
  onPickStyle: (style: BrowStyleItem) => void;
  onOpenAll: () => void;
  onRegenerate: () => void;
  onTryAnother: () => void;
  onPreviewError: () => void;
}

function ResultPanel({
  t,
  genStatus,
  resultUrl,
  resultStyleSlug,
  photoPreview,
  selectedStyle,
  emptyStateStyles,
  onPickStyle,
  onOpenAll,
  onRegenerate,
  onTryAnother,
  onPreviewError,
}: ResultPanelProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const updateSlider = useCallback((clientX: number) => {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100)
    );
    setSliderPos(pct);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!resultUrl) return;
    try {
      const fetchUrl = resultUrl.startsWith('/')
        ? resultUrl
        : `/api/proxy/file?url=${encodeURIComponent(resultUrl)}`;
      const resp = await fetch(fetchUrl);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brow-tint-${resultStyleSlug ?? selectedStyle?.slug ?? 'preview'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 200);
    } catch {
      toast.error('Download failed');
    }
  }, [resultUrl, resultStyleSlug, selectedStyle?.slug]);

  return (
    <Card className="flex h-full min-h-[420px] flex-col md:min-h-[680px]">
      <Card.Content className="flex flex-1 flex-col p-4">
        {/* SUCCESS — defensive fallback when photo was cleared mid-gen */}
        {genStatus === 'success' && resultUrl && !photoPreview && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <img
              src={resultUrl}
              alt={t('step3.after')}
              className="rounded-large max-h-[480px] w-auto"
            />
            <p className="text-default-500 text-xs">
              {t('studio.right.success_orphan')}
            </p>
          </div>
        )}

        {/* SUCCESS — before/after slider */}
        {genStatus === 'success' && resultUrl && photoPreview && (
          <div className="flex flex-1 flex-col gap-4">
            <div
              ref={sliderRef}
              className="rounded-large relative flex-1 select-none overflow-hidden"
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => {
                setIsDragging(true);
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                updateSlider(e.clientX);
              }}
              onPointerMove={(e) => {
                if (!isDragging) return;
                updateSlider(e.clientX);
              }}
              onPointerUp={() => setIsDragging(false)}
            >
              <img
                src={resultUrl}
                alt={t('step3.after')}
                className="block h-full w-full object-contain"
                draggable={false}
              />
              <div
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img
                  src={photoPreview}
                  alt={t('step3.before')}
                  className="block h-full w-full object-contain"
                  draggable={false}
                  onError={onPreviewError}
                />
              </div>
              <div
                className="absolute bottom-0 top-0 z-10 w-0.5 bg-white shadow-lg"
                style={{
                  left: `${sliderPos}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-white/95 shadow-lg">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4.5 3L1 8L4.5 13M11.5 3L15 8L11.5 13"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-default-700"
                    />
                  </svg>
                </div>
              </div>
              <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-medium text-white">
                {t('step3.before')}
              </span>
              <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-medium text-white">
                {t('step3.after')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onPress={onTryAnother}
                className="!h-9 !min-w-0 !gap-1 !px-2 !text-[11px]"
              >
                <RefreshCw className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {t('studio.right.try_another')}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={onRegenerate}
                className="!h-9 !min-w-0 !gap-1 !px-2 !text-[11px]"
              >
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate">{t('step3.regenerate')}</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onPress={handleDownload}
                className="!h-9 !min-w-0 !gap-1 !px-2 !text-[11px]"
              >
                <Download className="h-3 w-3 shrink-0" />
                <span className="truncate">{t('step3.download')}</span>
              </Button>
            </div>
          </div>
        )}

        {/* GENERATING */}
        {genStatus === 'generating' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <Spinner size="lg" color="accent" />
            <div>
              <p className="text-foreground text-sm font-medium">
                {t('studio.right.generating_title')}
              </p>
              <p className="text-default-500 mt-1 text-xs">
                {selectedStyle
                  ? t('studio.right.generating_subtitle', {
                      style: selectedStyle.name,
                    })
                  : ''}
              </p>
            </div>
          </div>
        )}

        {/* IDLE: ready (both inputs present). Anchors "photo + style →
            result" via two thumbnails with an arrow between them, so
            the right panel adds info instead of duplicating the photo
            already shown in the left InputCard. */}
        {genStatus === 'idle' && photoPreview && selectedStyle && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="flex w-full max-w-md items-center justify-center gap-3">
              <div className="border-default-200 flex w-32 flex-col items-center gap-1.5 overflow-hidden rounded-2xl border bg-white sm:w-40">
                <img
                  src={photoPreview}
                  alt="Your photo"
                  className="block aspect-[3/4] w-full object-cover"
                  onError={onPreviewError}
                />
              </div>
              <ArrowRight
                className="text-default-400 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <div className="border-default-200 bg-default-50 flex w-40 flex-col items-center justify-center overflow-hidden rounded-2xl border sm:w-56">
                {selectedStyle.thumbnail ? (
                  <img
                    src={selectedStyle.thumbnail}
                    alt={selectedStyle.name}
                    className="block aspect-[3/2] w-full object-contain p-2"
                    style={{
                      imageRendering:
                        '-webkit-optimize-contrast' as any,
                    }}
                  />
                ) : (
                  <div className="flex aspect-[3/2] w-full items-center justify-center">
                    <Sparkles className="text-default-400 h-6 w-6" />
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className="text-foreground text-sm font-medium">
                {t('studio.right.ready_title', { name: selectedStyle.name })}
              </p>
              <p className="text-default-500 mt-1 text-xs">
                {t('studio.right.ready_subtitle')}
              </p>
            </div>
            {/* Style chip + change-style affordance. Without this the user
                has no obvious way back into the picker once a style is
                selected — onOpenAll preserves the current selection so
                they can browse and swap freely. */}
            <button
              type="button"
              onClick={onOpenAll}
              className="text-default-700 hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium underline-offset-4 transition-colors hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('studio.right.try_another')}
            </button>
          </div>
        )}

        {/* IDLE: missing one or both inputs — single picker EmptyState. The
            user's photo is already visible in the left InputCard, so this
            panel never re-renders it; it focuses purely on what's still
            missing (style and/or photo). */}
        {genStatus === 'idle' && (!photoPreview || !selectedStyle) && (
          <div className="flex flex-1 items-center justify-center px-4">
            <EmptyState size="lg" className="w-full max-w-2xl">
              <EmptyState.Header>
                {/* Icon + title intentionally omitted — the description
                    alone reads as a clear inline prompt above the grid. */}
                <EmptyState.Description>
                  {!photoPreview && selectedStyle
                    ? t('studio.right.empty_style_picked_subtitle')
                    : t('studio.right.empty_subtitle')}
                </EmptyState.Description>
              </EmptyState.Header>
              <EmptyState.Content className="w-full">
                {emptyStateStyles.length > 0 && (
                  // Multi-row grid (3-4 cols × 4 rows). Real CSS mask-image
                  // fades the *tiles themselves* into transparency at the
                  // bottom edge — the last row becomes a teaser hinting
                  // there's more in the modal. Cleaner than an overlay
                  // because the fade respects each tile's actual pixels.
                  <div
                    className="grid w-full grid-cols-3 gap-3 sm:grid-cols-4"
                    style={{
                      maskImage:
                        'linear-gradient(to bottom, black 55%, transparent 100%)',
                      WebkitMaskImage:
                        'linear-gradient(to bottom, black 55%, transparent 100%)',
                    }}
                  >
                    {emptyStateStyles.map((style) => {
                        const isSelected = style.id === selectedStyle?.id;
                        return (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => onPickStyle(style)}
                            aria-pressed={isSelected}
                            className="group flex flex-col items-center gap-1"
                          >
                            <div
                              className={cn(
                                'rounded-large bg-default-50 aspect-[3/2] w-full overflow-hidden border transition-transform group-hover:-translate-y-0.5',
                                isSelected
                                  ? 'border-primary ring-primary ring-2 ring-offset-2'
                                  : 'border-default-200'
                              )}
                            >
                              {style.thumbnail && (
                                <img
                                  src={style.thumbnail}
                                  alt={style.name}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                                  loading="lazy"
                                  decoding="async"
                                  style={{
                                    imageRendering:
                                      '-webkit-optimize-contrast' as any,
                                  }}
                                />
                              )}
                            </div>
                            <p
                              className={cn(
                                'line-clamp-1 text-[10px] font-medium',
                                isSelected
                                  ? 'text-primary'
                                  : 'text-foreground'
                              )}
                            >
                              {style.name}
                            </p>
                          </button>
                        );
                      })}
                  </div>
                )}
                {/* Same Highlighter pattern as hero's highlight_text —
                    a span wrapping the text with a rough-notation
                    underline drawn over it on mount. Color is the brand
                    pink fading to white via the GradientHighlighter
                    helper above (which post-processes the SVG stroke to
                    use a linearGradient — rough-notation only takes a
                    single color natively). Arrow sits outside the
                    annotated span so it isn't underlined. */}
                <button
                  type="button"
                  onClick={onOpenAll}
                  className="text-foreground group mt-2 inline-flex items-center gap-1.5 self-center text-sm font-medium"
                >
                  <GradientHighlighter
                    colors={['#a78bfa', '#ddd6fe', '#ffffff']}
                    strokeWidth={2.5}
                  >
                    {t('studio.right.empty_browse_all')}
                  </GradientHighlighter>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </EmptyState.Content>
            </EmptyState>
          </div>
        )}

        {/* FAILED */}
        {genStatus === 'failed' && (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState size="lg">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <X className="h-6 w-6 text-danger" />
                </EmptyState.Media>
                <EmptyState.Title>{t('studio.right.failed_title')}</EmptyState.Title>
                <EmptyState.Description>
                  {t('studio.right.failed_subtitle')}
                </EmptyState.Description>
              </EmptyState.Header>
              <EmptyState.Content>
                <Button variant="outline" size="sm" onPress={onRegenerate}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t('studio.right.failed_retry')}
                </Button>
              </EmptyState.Content>
            </EmptyState>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

interface StylesPickerProps {
  t: ReturnType<typeof useTranslations>;
  open: boolean;
  onClose: () => void;
  styles: BrowStyleItem[];
  selectedStyleId: string | null;
  onSelect: (style: BrowStyleItem) => void;
}

/**
 * Style browser shown when the user taps "Browse all styles". Renders
 * a wide centered Modal on desktop and a bottom Sheet with snap-points
 * on mobile — both share the same internal state (search / shade filter
 * / tentative selection) and a fixed footer so the Apply CTA stays in
 * view while the grid scrolls.
 */
function StylesPicker({
  t,
  open,
  onClose,
  styles,
  selectedStyleId,
  onSelect,
}: StylesPickerProps) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [shadeFilter, setShadeFilter] = useState<string | null>(null);
  // Tentative selection lives inside the picker so users can preview a few
  // styles before committing. We sync it with the parent's `selectedStyleId`
  // each time the picker opens so reopening preserves their last choice.
  const [tentativeId, setTentativeId] = useState<string | null>(
    selectedStyleId
  );

  useEffect(() => {
    if (open) {
      setTentativeId(selectedStyleId);
      setSearch('');
      setShadeFilter(null);
    }
  }, [open, selectedStyleId]);

  const shades = useMemo(() => {
    const set = new Set(styles.map((s) => s.shade));
    return Array.from(set).sort();
  }, [styles]);

  const filtered = useMemo(() => {
    let list = styles;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.shade.toLowerCase().includes(q) ||
          s.shape.toLowerCase().includes(q)
      );
    }
    if (shadeFilter) {
      list = list.filter((s) => s.shade === shadeFilter);
    }
    return list;
  }, [styles, search, shadeFilter]);

  const tentativeStyle = useMemo(
    () => styles.find((s) => s.id === tentativeId) ?? null,
    [styles, tentativeId]
  );

  const handleApply = useCallback(() => {
    if (tentativeStyle) {
      onSelect(tentativeStyle);
    } else {
      onClose();
    }
  }, [tentativeStyle, onSelect, onClose]);

  // Filter chips + search field — shared by both shells.
  const filterControls = (
    <>
      <SearchField
        value={search}
        onChange={setSearch}
        aria-label={t('studio.drawer.search')}
      >
        <SearchField.Input placeholder={t('studio.drawer.search')} />
      </SearchField>
      <ScrollShadow hideScrollBar orientation="horizontal" className="-mx-1">
        <div className="flex items-center gap-1.5 px-1 py-0.5">
          <FilterChip
            active={!shadeFilter}
            onPress={() => setShadeFilter(null)}
          >
            {t('studio.drawer.all_shades')}
          </FilterChip>
          {shades.map((shade) => (
            <FilterChip
              key={shade}
              active={shadeFilter === shade}
              onPress={() => setShadeFilter(shade)}
            >
              {shade}
            </FilterChip>
          ))}
        </div>
      </ScrollShadow>
    </>
  );

  // Style grid — scrolls inside Modal.Body / Sheet.Body. Tile click sets
  // tentativeId only; commit happens via the footer CTA so users can browse
  // multiple shades without immediately closing the picker.
  const grid = (gridCols: string) =>
    filtered.length === 0 ? (
      <p className="text-default-500 py-12 text-center text-xs">
        {t('studio.drawer.empty')}
      </p>
    ) : (
      <div className={cn('grid gap-3', gridCols)}>
        {filtered.map((style) => (
          <StyleTile
            key={style.id}
            style={style}
            isSelected={style.id === tentativeId}
            onPress={() => setTentativeId(style.id)}
          />
        ))}
      </div>
    );

  // Pinned footer: shows tentative selection + Apply CTA. Apply is disabled
  // until the user actually picks something, so an empty press can't commit.
  const footer = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        {tentativeStyle ? (
          <div className="flex items-center gap-2 truncate">
            <span className="text-default-500 shrink-0 text-[10px] uppercase tracking-wider">
              {t('studio.drawer.selected_label')}
            </span>
            <span className="text-foreground truncate text-xs font-medium">
              {tentativeStyle.name}
            </span>
          </div>
        ) : (
          <span className="text-default-500 text-[11px]">
            {t('studio.drawer.select_hint')}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" onPress={onClose}>
          {t('studio.drawer.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onPress={handleApply}
          isDisabled={!tentativeStyle}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t('studio.drawer.apply')}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet
        isOpen={open}
        onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
        // snap=1 fully reveals whatever height Sheet.Content has. We
        // cap Sheet.Content to 4/5 viewport (h-[80vh]) so the dialog is
        // 80vh tall, not the snap fraction of a 100vh dialog. The sheet
        // then covers the bottom 4/5 of the screen with the footer
        // always within the visible area.
        snapPoints={[1]}
        activeSnapPoint={1}
        placement="bottom"
      >
        <Sheet.Backdrop>
          <Sheet.Content className="mx-auto h-[80vh] w-full max-w-2xl">
            {/* Sheet.Dialog needs flex h-full flex-col so Sheet.Body
                can be flex-1 and provide a real height for our inner
                column layout. Without it, the inner footer ends up
                below the visible viewport. */}
            <Sheet.Dialog className="flex h-full flex-col">
              <Sheet.Handle />
              <Sheet.Body className="min-h-0 flex-1 overflow-hidden p-0">
                <div className="flex h-full flex-col">
                  <div className="border-divider flex shrink-0 flex-col gap-3 border-b px-4 pb-3 pt-1">
                    <div className="flex flex-row items-center justify-between gap-2">
                      <h2 className="text-base font-semibold leading-tight">
                        {t('studio.drawer.title')}
                      </h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        aria-label="Close"
                        onPress={onClose}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {filterControls}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    {grid('grid-cols-2 sm:grid-cols-3')}
                  </div>
                  <div className="bg-background border-divider shrink-0 rounded-b-large border-t px-4 py-3">
                    {footer}
                  </div>
                </div>
              </Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    );
  }

  return (
    <Modal
      isOpen={open}
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden">
            {/* Plain divs — Modal.Header / Modal.Footer compounds stack
                children into a column by default and ignore inline
                flex-row overrides, which left the close button on a
                second line on desktop. */}
            <div className="flex h-full flex-col">
              <div className="border-divider shrink-0 space-y-2.5 border-b px-5 pb-3 pt-4">
                <div className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold leading-tight">
                      {t('studio.drawer.title')}
                    </h2>
                    <p className="text-default-500 mt-0.5 text-[11px] leading-tight">
                      {t('studio.drawer.subtitle')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    aria-label="Close"
                    onPress={onClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {filterControls}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {grid('grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6')}
              </div>
              <div className="bg-background border-divider shrink-0 rounded-b-large border-t px-5 py-3">
                {footer}
              </div>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function FilterChip({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium capitalize transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-default-200 text-default-700 hover:bg-default-100'
      )}
    >
      {children}
    </button>
  );
}

function StyleTile({
  style,
  isSelected,
  onPress,
}: {
  style: BrowStyleItem;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={isSelected}
      className={cn(
        'group rounded-large border-default-200 bg-content1 hover:border-default-400 hover:shadow-md flex cursor-pointer flex-col overflow-hidden border text-left transition-all',
        isSelected && 'border-primary ring-primary ring-2 ring-offset-2'
      )}
    >
      <div className="bg-default-50 relative aspect-[3/2] overflow-hidden">
        {style.thumbnail && (
          <img
            src={style.thumbnail}
            alt={style.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            loading="lazy"
            decoding="async"
            style={{ imageRendering: '-webkit-optimize-contrast' as any }}
          />
        )}
        {(style.popular || style.trending) && (
          <span
            className={cn(
              'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm',
              style.trending ? 'bg-rose-500' : 'bg-amber-500'
            )}
          >
            {style.trending ? (
              <>
                <TrendingUp className="h-2.5 w-2.5" />
                Trending
              </>
            ) : (
              <>
                <Star className="h-2.5 w-2.5" />
                Popular
              </>
            )}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-2.5 py-2">
        <span className="text-foreground line-clamp-2 text-[11px] font-medium leading-tight">
          {style.name}
        </span>
        <span className="text-default-500 truncate text-[10px] capitalize">
          {style.shade} · {style.shape}
        </span>
      </div>
    </button>
  );
}
