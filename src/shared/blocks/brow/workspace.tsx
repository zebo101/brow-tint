'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Segment } from '@heroui-pro/react';
import {
  Button,
  Card,
  Label,
  Modal,
  Slider,
  Spinner,
  Tooltip,
} from '@heroui/react';
import {
  ArrowRight,
  ChartNoAxesColumn,
  Check,
  Download,
  Expand,
  Images,
  Minus,
  Plus,
  RotateCcw,
  Scan,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { measureBrows } from '@/shared/lib/brow-mapping/report';
import type {
  BrowAdjustments,
  BrowControls,
  BrowStyle,
} from '@/shared/lib/brow-mapping/types';

import type { ConfirmedBrowAnalysis } from './analysis-panel';
import { AnchorEditor, type AnchorEditing } from './anchor-editor';
import { browText, getBrowCopy } from './copy';
import { useBrowExportAccess } from './export-access';
import { MobileBrowEditor } from './mobile-editor';
import { PortraitCanvas, type PortraitView } from './portrait-canvas';
import type { BrowPreviewState } from './portrait-preview';
import { BrowResultHistory } from './result-history';
import { useBrowAnalysis } from './use-brow-analysis';

import './workspace.css';

export interface BrowWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreviewChange: (rawUrl: string, preview: BrowPreviewState) => void;
  file: File | null;
  rawPhotoUrl: string | null;
  confirmed: boolean;
  disabled: boolean;
  onConfirm: (value: ConfirmedBrowAnalysis) => void;
  onInvalidate: () => void;
  onPickFile: () => void;
  onDropFile: (file: File) => void;
  onSelectSample: (source: string) => void;
  onClear: () => void;
  onOpenGuidelines: () => void;
  catalog: ReactNode;
  action: ReactNode;
  status: ReactNode;
  resultUrl: string | null;
  selectedStyle: { name: string; thumbnail: string | null } | null;
}

type Panel = 'adjust' | 'report' | 'catalog';
type Scope = 'both' | 'left' | 'right';
const subscribeMobile = (notify: () => void) => {
  const media = window.matchMedia('(max-width: 760px)');
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const getMobile = () => window.matchMedia('(max-width: 760px)').matches;
const getServerMobile = () => false;

export function BrowWorkspace(props: BrowWorkspaceProps) {
  if (!props.file) return null;
  return <BrowWorkspaceContent key={props.rawPhotoUrl ?? 'empty'} {...props} />;
}

function BrowWorkspaceContent(props: BrowWorkspaceProps) {
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    getMobile,
    getServerMobile
  );
  const locale = useLocale();
  const zh = locale.startsWith('zh');
  const c = getBrowCopy(locale);
  const t = useTranslations('pages.ai-brow-tint');
  const exportAccess = useBrowExportAccess();
  const local = useBrowAnalysis(props.file, props.onInvalidate);
  const [panel, setPanel] = useState<Panel>('adjust');
  const [view, setView] = useState<PortraitView>('mapping');
  const [seenResult, setSeenResult] = useState(props.resultUrl);
  const [zoom, setZoom] = useState(1);
  const [split, setSplit] = useState(50);
  const [scope, setScope] = useState<Scope>('both');
  const [advanced, setAdvanced] = useState(false);
  const [guideStage, setGuideStage] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [editingAnchors, setEditingAnchors] = useState(false);
  const [selectedAnchor, setSelectedAnchor] = useState<
    AnchorEditing['selected']
  >({ side: 'left', point: 'head' });
  const [walkthrough, setWalkthrough] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const focused = true;
  const [expandedTools, setExpandedTools] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const [fitInsets, setFitInsets] = useState({
    left: 16,
    top: 66,
    right: 360,
    bottom: 68,
  });
  const [mobileControl, setMobileControl] =
    useState<keyof BrowAdjustments>('thickness');
  const { photo, analysis, candidate } = local;
  const { onPreviewChange, rawPhotoUrl } = props;
  useEffect(() => {
    if (rawPhotoUrl)
      onPreviewChange(rawPhotoUrl, { photo, analysis, candidate });
  }, [photo, analysis, candidate, rawPhotoUrl, onPreviewChange]);
  const locked = props.disabled || local.exporting || exportAccess.downloading;
  function changeOpen(open: boolean) {
    if (!open) setZoom(1);
    props.onOpenChange(open);
  }
  const report = useMemo(
    () => (local.analysis ? measureBrows(local.analysis) : null),
    [local.analysis]
  );
  useEffect(() => {
    const grid = gridRef.current;
    const tools = grid?.querySelector('.brow-controls-column');
    const dock = grid?.querySelector('.brow-mobile-dock');
    if (!grid || !tools) return;
    const observer = new ResizeObserver(() => {
      const stage = grid.getBoundingClientRect();
      const panel = tools.getBoundingClientRect();
      const mobile =
        stage.width <= 760 &&
        !(
          focused &&
          expandedTools &&
          stage.height <= 520 &&
          stage.width > stage.height
        );
      const next = mobile
        ? {
            left: 12,
            top: 60,
            right: 12,
            bottom: Math.max(
              80,
              stage.bottom -
                (expandedTools
                  ? panel.top
                  : (dock?.getBoundingClientRect().top ?? panel.top)) +
                66
            ),
          }
        : {
            left: 16,
            top: 66,
            right: Math.max(16, stage.right - panel.left + 24),
            bottom: 76,
          };
      setFitInsets((previous) =>
        Object.keys(next).every(
          (key) =>
            previous[key as keyof typeof next] ===
            next[key as keyof typeof next]
        )
          ? previous
          : next
      );
    });
    observer.observe(grid);
    observer.observe(tools);
    if (dock) observer.observe(dock);
    return () => observer.disconnect();
  }, [focused, expandedTools, isMobile, props.open]);

  if (seenResult !== props.resultUrl) {
    setSeenResult(props.resultUrl);
    setView(props.resultUrl ? 'result' : 'mapping');
    setZoom(1);
  }
  useEffect(() => {
    if (!playing || guideStage >= 6 || !props.open || panel !== 'report')
      return;
    // Reduced motion removes stroke animation, not the user-requested explanation steps.
    const timer = setTimeout(() => {
      setGuideStage((value) => value + 1);
      if (guideStage >= 5) setPlaying(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [playing, guideStage, props.open, panel]);
  useEffect(() => {
    if (!props.open || panel !== 'report') {
      setPlaying(false);
      setWalkthrough(false);
      setGuideStage(6);
    }
  }, [props.open, panel]);

  function updateStyle(style: BrowStyle) {
    if (locked) return;
    local.update(style, local.controls);
    setView((current) => (current === 'mapping' ? current : 'contour'));
  }
  function updateControl(
    key: keyof BrowAdjustments,
    value: number,
    targetScope = scope
  ) {
    if (locked) return;
    const next: Partial<BrowControls> =
      targetScope === 'both'
        ? { ...local.controls, [key]: value }
        : {
            ...local.controls,
            [targetScope]: { ...local.controls[targetScope], [key]: value },
          };
    local.update(local.style, next);
    setView((current) => (current === 'mapping' ? current : 'contour'));
  }
  const activeControls =
    scope === 'both' ? local.controls : (local.controls[scope] ?? {});
  const anchorEditing: AnchorEditing = {
    active: editingAnchors,
    selected: selectedAnchor,
    onActiveChange: (active) => {
      setEditingAnchors(active);
      if (active) {
        setPlaying(false);
        setWalkthrough(false);
        setGuideStage(6);
        setView('mapping');
      }
    },
    onSelect: setSelectedAnchor,
    onMove: (target, position) => {
      if (!locked) local.moveAnchor(target, position);
    },
    onReset: (target) => {
      if (locked) return;
      const offsets = { ...local.controls.anchorOffsets };
      if (target) {
        offsets[target.side] = { ...offsets[target.side] };
        delete offsets[target.side]![target.point];
      }
      local.update(local.style, {
        ...local.controls,
        anchorOffsets: target ? offsets : undefined,
      });
    },
  };
  const mobileControls = [
    {
      key: 'thickness',
      label: browText(locale, 'Width', '粗细'),
      min: 75,
      max: 125,
      scale: 100,
      defaultValue: 1,
      suffix: '%',
    },
    {
      key: 'arch',
      label: browText(locale, 'Arch', '眉峰'),
      min: -25,
      max: 25,
      scale: 1000,
      defaultValue: 0,
      suffix: '',
    },
    {
      key: 'length',
      label: browText(locale, 'Length', '长度'),
      min: 85,
      max: 115,
      scale: 100,
      defaultValue: 1,
      suffix: '%',
    },
    {
      key: 'vertical',
      label: browText(locale, 'Height', '高度'),
      min: -40,
      max: 40,
      scale: 1000,
      defaultValue: 0,
      suffix: '',
    },
    {
      key: 'spacing',
      label: browText(locale, 'Spacing', '间距'),
      min: -35,
      max: 35,
      scale: 1000,
      defaultValue: 0,
      suffix: '',
    },
    {
      key: 'rotation',
      label: browText(locale, 'Angle', '角度'),
      min: -8,
      max: 8,
      scale: 1,
      defaultValue: 0,
      suffix: '°',
    },
  ] as const;
  const currentMobile = mobileControls.find(
    (control) => control.key === mobileControl
  )!;
  async function confirm() {
    if (locked) return false;
    const value = await local.exportImage(false);
    if (value) {
      props.onConfirm(value);
      setPanel('catalog');
      setExpandedTools(true);
      return true;
    }
    return false;
  }
  async function download(withReferences = view === 'mapping') {
    if (locked) return;
    await exportAccess.downloadLocal(
      async () => (await local.exportImage(withReferences))?.guide ?? null
    );
  }
  const error =
    local.error === 'export'
      ? c.downloadError
      : local.error
        ? (c.errors[local.error as keyof typeof c.errors] ?? c.errors.unknown)
        : null;

  const workspace = isMobile ? (
    <MobileBrowEditor
      anchorEditing={anchorEditing}
      zh={zh}
      photo={local.photo}
      analysis={local.analysis}
      candidate={local.candidate}
      style={local.style}
      controls={local.controls}
      error={error}
      status={local.status ? c[local.status] : null}
      exporting={local.exporting}
      disabled={props.disabled}
      confirmed={props.confirmed}
      onStyleChange={updateStyle}
      onControlChange={(targetScope, key, value) =>
        updateControl(key, value, targetScope)
      }
      onConfirm={confirm}
      onRetry={local.retry}
      onPickFile={props.onPickFile}
      catalog={props.catalog}
      action={props.action}
      statusContent={props.status}
      resultUrl={props.resultUrl}
      view={view}
      onViewChange={setView}
      zoom={zoom}
      onZoomChange={setZoom}
      resetKey={resetKey}
      onReset={() => {
        setZoom(1);
        setResetKey((key) => key + 1);
      }}
      focused={focused}
      onToggleFocus={() => changeOpen(false)}
      onResetAdjustments={() => {
        local.update('natural', {});
        setView('mapping');
      }}
      onDownload={() => download(true)}
      downloadLabel={
        exportAccess.canExport ? t('ui.export_hd') : t('ui.upgrade_export')
      }
    />
  ) : (
    <Card
      className={`brow-workspace brow-workspace-card ${props.file ? 'brow-editor' : ''} ${focused ? 'brow-editor-focused' : ''} ${expandedTools ? 'brow-tools-expanded' : ''}`}
    >
      <div className="brow-workspace-grid" ref={gridRef}>
        <div className="brow-canvas-column">
          <div className="brow-canvas-topbar">
            <span className="text-sm font-medium">
              {props.file
                ? browText(locale, 'Your brow canvas', '你的眉形画布')
                : browText(locale, 'Start with your photo', '从你的照片开始')}
            </span>
            {props.file && (
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => changeOpen(false)}
                >
                  <Expand className="size-4" />
                  {browText(locale, 'Back to studio', '返回展示')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={locked}
                  onPress={props.onPickFile}
                >
                  {c.replace}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={locked}
                  onPress={props.onClear}
                >
                  {browText(locale, 'Remove', '移除')}
                </Button>
              </div>
            )}
          </div>

          <div
            className={`brow-canvas ${dragging ? 'brow-canvas-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!locked) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file && !locked) props.onDropFile(file);
            }}
          >
            {local.photo ? (
              <PortraitCanvas
                photo={local.photo}
                analysis={local.analysis}
                candidate={local.candidate}
                view={view}
                zoom={zoom}
                guideStage={guideStage}
                walkthrough={walkthrough}
                replayKey={replayKey}
                anchorEditing={
                  editingAnchors && panel === 'adjust' && !locked
                    ? anchorEditing
                    : undefined
                }
                resultUrl={props.resultUrl}
                split={split}
                zh={zh}
                interactive
                onZoomChange={setZoom}
                resetKey={resetKey}
                fitInsets={fitInsets}
              />
            ) : (
              <img
                className="brow-empty-portrait"
                src={props.rawPhotoUrl ?? '/imgs/cases/2.jpg'}
                alt={
                  props.file
                    ? browText(locale, 'Photo to analyze', '待分析照片')
                    : browText(locale, 'Example portrait', '示例人像')
                }
              />
            )}

            {!props.file && (
              <div className="brow-empty-caption">
                <span className="text-xs">
                  {browText(locale, 'Example portrait', '示例照片')}
                </span>
                <p>
                  {browText(
                    locale,
                    'Brows that feel like you.',
                    '让眉形，适合你。'
                  )}
                </p>
              </div>
            )}
            {local.status && (
              <div className="brow-analysis-loading" role="status">
                <Spinner size="sm" />
                <span>{c[local.status]}</span>
              </div>
            )}
            {error && (
              <div className="brow-analysis-error" role="alert">
                <p>{error}</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button
                    variant="secondary"
                    isDisabled={locked}
                    onPress={local.retry}
                  >
                    {c.retry}
                  </Button>
                  <Button
                    variant="ghost"
                    isDisabled={locked}
                    onPress={props.onPickFile}
                  >
                    {c.replace}
                  </Button>
                </div>
              </div>
            )}

            {local.analysis && (
              <>
                <div className="brow-canvas-label">
                  {view === 'original'
                    ? browText(locale, 'Original photo', '原始照片')
                    : view === 'result'
                      ? browText(
                          locale,
                          'AI result · slide to compare',
                          'AI 效果 · 拖动对比'
                        )
                      : view === 'mapping'
                        ? browText(locale, 'Mapping guides', '定位参考')
                        : browText(locale, 'Contour preview', '轮廓预览')}
                </div>
                {props.selectedStyle && (
                  <div className="brow-sample-reference">
                    {props.selectedStyle.thumbnail && (
                      <img
                        src={props.selectedStyle.thumbnail}
                        alt={props.selectedStyle.name}
                      />
                    )}
                    <span>
                      {browText(locale, 'Selected sample', '所选样本')}
                    </span>
                  </div>
                )}
                <BrowResultHistory refreshKey={props.resultUrl} />
                <div className="brow-floating-toolbar">
                  <ToolButton
                    label={browText(locale, 'Zoom out', '缩小')}
                    disabled={zoom <= 0.25}
                    onPress={() =>
                      setZoom((value) => Math.max(0.25, value - 0.25))
                    }
                  >
                    <Minus />
                  </ToolButton>
                  <span className="min-w-10 text-center text-xs tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                  <ToolButton
                    label={browText(locale, 'Zoom into brows', '放大眉部')}
                    disabled={zoom >= 8}
                    onPress={() =>
                      setZoom((value) => Math.min(8, value + 0.25))
                    }
                  >
                    <Plus />
                  </ToolButton>
                  <ToolButton
                    label={browText(locale, 'Fit portrait', '适应画布')}
                    onPress={() => {
                      setZoom(1);
                      setResetKey((key) => key + 1);
                    }}
                  >
                    <Scan />
                  </ToolButton>
                  <ToolButton
                    label={
                      exportAccess.canExport
                        ? t('ui.export_hd')
                        : t('ui.upgrade_export')
                    }
                    disabled={locked}
                    onPress={() => void download()}
                  >
                    <Download />
                  </ToolButton>
                </div>
              </>
            )}
            {dragging && (
              <div className="brow-drop-label">
                {browText(locale, 'Drop to analyze photo', '松开以分析照片')}
              </div>
            )}
          </div>

          <div className="brow-viewbar">
            {local.analysis ? (
              <Segment
                aria-label={browText(
                  locale,
                  'Photo display mode',
                  '照片显示模式'
                )}
                selectedKey={view}
                onSelectionChange={(key) =>
                  setView(String(key) as PortraitView)
                }
              >
                <Segment.Item id="contour">
                  {browText(locale, 'Contour', '眉形')}
                </Segment.Item>
                <Segment.Item id="mapping">
                  {browText(locale, 'Mapping', '定位线')}
                </Segment.Item>
                <Segment.Item id="original">
                  {browText(locale, 'Original', '原图')}
                </Segment.Item>
                {props.resultUrl && (
                  <Segment.Item id="result">
                    {browText(locale, 'Result', '效果')}
                  </Segment.Item>
                )}
              </Segment>
            ) : (
              <span className="text-muted text-xs">
                {browText(
                  locale,
                  'Front-facing · eyes open · brows visible',
                  '清晰正面 · 双眼睁开 · 眉毛无遮挡'
                )}
              </span>
            )}
          </div>
          {view === 'result' && props.resultUrl && (
            <div className="brow-result-comparison px-5 pb-3">
              <Slider
                aria-label={browText(
                  locale,
                  'Before and after comparison',
                  '原图效果对比'
                )}
                value={split}
                onChange={(value) => setSplit(Number(value))}
              >
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
            </div>
          )}
        </div>

        <div className="brow-controls-column" data-panel={panel}>
          {props.file && (
            <Button
              className="brow-tools-handle"
              variant="ghost"
              size="sm"
              aria-expanded={expandedTools}
              onPress={() => setExpandedTools(!expandedTools)}
            >
              {expandedTools
                ? browText(locale, 'Collapse tools', '收起工具')
                : browText(locale, 'Expand tools', '展开工具')}
            </Button>
          )}
          {!props.file ? (
            <div className="brow-welcome">
              <span className="text-accent text-xs font-medium">
                {browText(
                  locale,
                  'Your personal brow design',
                  '属于你的眉形设计'
                )}
              </span>
              <h2>
                {browText(locale, 'See it. Then decide.', '先看见，再决定。')}
              </h2>
              <p className="text-muted text-sm leading-relaxed">
                {browText(
                  locale,
                  'Understand your natural brows, refine the placement, then choose a style from the collection.',
                  '分析你的自然眉形，微调适合的位置，再从样图库挑选喜欢的款式。'
                )}
              </p>
              <Button onPress={props.onPickFile}>
                <Upload className="size-4" />
                {c.choose}
              </Button>
              <p className="text-muted text-center text-xs">{c.formats}</p>
              <div className="brow-example-row">
                <span className="text-muted text-xs">
                  {browText(locale, 'Or try an example', '或试试示例')}
                </span>
                <div className="flex gap-3">
                  {[2, 4].map((n, i) => (
                    <button
                      key={n}
                      className="brow-example"
                      aria-label={browText(
                        locale,
                        'Try example {n}',
                        '体验示例 {n}'
                      ).replace('{n}', String(i + 1))}
                      onClick={() =>
                        props.onSelectSample(`/imgs/cases/${n}.jpg`)
                      }
                    >
                      <img src={`/imgs/cases/${n}.jpg`} alt="" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="brow-welcome-steps">
                {[
                  browText(locale, 'Analyze your brows', '分析自然眉形'),
                  browText(locale, 'Refine and confirm', '微调并确认位置'),
                  browText(
                    locale,
                    'Choose a style and generate',
                    '选款，生成试妆'
                  ),
                ].map((text, i) => (
                  <div key={text}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
              <Button variant="ghost" onPress={props.onOpenGuidelines}>
                {browText(
                  locale,
                  'What makes a good photo?',
                  '什么照片更适合？'
                )}
              </Button>
            </div>
          ) : (
            <>
              <div className="brow-panel-tabs">
                <Segment
                  aria-label={browText(locale, 'Design tools', '设计工具')}
                  selectedKey={panel}
                  onSelectionChange={(key) => setPanel(String(key) as Panel)}
                  className="w-full"
                >
                  <Segment.Item id="adjust">
                    {browText(locale, 'Adjust', '调整眉形')}
                  </Segment.Item>
                  <Segment.Item id="report">
                    {browText(locale, 'Analysis', '分析报告')}
                  </Segment.Item>
                  <Segment.Item id="catalog">
                    {browText(locale, 'Styles', '选择款式')}
                  </Segment.Item>
                </Segment>
              </div>

              <div className="brow-panel-body">
                {!local.analysis ? (
                  <div className="brow-panel-placeholder">
                    <SlidersHorizontal className="text-muted size-7" />
                    <h2>
                      {browText(
                        locale,
                        'Finding your natural brows',
                        '先识别你的自然眉形'
                      )}
                    </h2>
                    <p className="text-muted text-sm">
                      {error ??
                        browText(
                          locale,
                          'Your controls will appear once analysis is ready.',
                          '照片准备好后，就可以开始调整。'
                        )}
                    </p>
                  </div>
                ) : (
                  <>
                    {panel === 'adjust' && (
                      <div className="brow-adjust-content space-y-5">
                        <div className="brow-adjust-heading">
                          <h2 className="text-lg font-semibold">
                            {browText(
                              locale,
                              'Find your balance',
                              '找到舒服的眉形'
                            )}
                          </h2>
                          <p className="text-muted mt-1 text-xs leading-relaxed">
                            {browText(
                              locale,
                              'Start with your own brows and refine the fit.',
                              '从自然眉形开始，边看边调整。'
                            )}
                          </p>
                        </div>
                        <Segment
                          aria-label={browText(
                            locale,
                            'Brow direction',
                            '眉形方向'
                          )}
                          isDisabled={locked}
                          selectedKey={local.style}
                          onSelectionChange={(key) =>
                            updateStyle(String(key) as BrowStyle)
                          }
                          className="w-full"
                        >
                          <Segment.Item id="natural">{c.natural}</Segment.Item>
                          <Segment.Item id="soft">{c.soft}</Segment.Item>
                          <Segment.Item id="lifted">{c.lifted}</Segment.Item>
                        </Segment>
                        <AnchorEditor
                          editing={anchorEditing}
                          candidate={local.candidate}
                          disabled={locked}
                          zh={zh}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted text-xs">
                            {browText(locale, 'Apply to', '调整范围')}
                          </span>
                          <Segment
                            aria-label={browText(
                              locale,
                              'Adjustment side',
                              '调整哪一侧'
                            )}
                            size="sm"
                            selectedKey={scope}
                            onSelectionChange={(key) =>
                              setScope(String(key) as Scope)
                            }
                          >
                            <Segment.Item id="both">
                              {browText(locale, 'Both', '双眉')}
                            </Segment.Item>
                            <Segment.Item id="left">
                              {browText(locale, 'Left', '画面左')}
                            </Segment.Item>
                            <Segment.Item id="right">
                              {browText(locale, 'Right', '画面右')}
                            </Segment.Item>
                          </Segment>
                        </div>
                        <div className="brow-mobile-adjustment">
                          <div
                            className="brow-control-picker"
                            aria-label={browText(
                              locale,
                              'Adjustment parameter',
                              '调整参数'
                            )}
                          >
                            {mobileControls.map((control) => (
                              <Button
                                key={control.key}
                                size="sm"
                                variant={
                                  mobileControl === control.key
                                    ? 'secondary'
                                    : 'ghost'
                                }
                                aria-pressed={mobileControl === control.key}
                                onPress={() => setMobileControl(control.key)}
                              >
                                {control.label}
                              </Button>
                            ))}
                          </div>
                          <Adjustment
                            className="brow-mobile-slider"
                            label={currentMobile.label}
                            value={Math.round(
                              (activeControls[currentMobile.key] ??
                                currentMobile.defaultValue) *
                                currentMobile.scale
                            )}
                            min={currentMobile.min}
                            max={currentMobile.max}
                            suffix={currentMobile.suffix}
                            disabled={locked}
                            onChange={(value) =>
                              updateControl(
                                currentMobile.key,
                                value / currentMobile.scale
                              )
                            }
                          />
                        </div>
                        <Adjustment
                          label={c.thickness}
                          value={Math.round(
                            (activeControls.thickness ?? 1) * 100
                          )}
                          min={75}
                          max={125}
                          suffix="%"
                          disabled={locked}
                          onChange={(value) =>
                            updateControl('thickness', value / 100)
                          }
                        />
                        <Adjustment
                          label={c.arch}
                          value={Math.round((activeControls.arch ?? 0) * 1000)}
                          min={-25}
                          max={25}
                          disabled={locked}
                          onChange={(value) =>
                            updateControl('arch', value / 1000)
                          }
                        />
                        <Button
                          className="brow-desktop-fine"
                          variant="ghost"
                          size="sm"
                          onPress={() => setAdvanced((value) => !value)}
                          aria-expanded={advanced}
                        >
                          <SlidersHorizontal className="size-4" />
                          {advanced
                            ? browText(
                                locale,
                                'Less adjustment',
                                '收起精细调整'
                              )
                            : browText(
                                locale,
                                'Fine-tune placement',
                                '精细调整'
                              )}
                        </Button>
                        {advanced && (
                          <div className="brow-desktop-fine space-y-5">
                            <Adjustment
                              label={browText(
                                locale,
                                'Brow length',
                                '眉毛长度'
                              )}
                              value={Math.round(
                                (activeControls.length ?? 1) * 100
                              )}
                              min={85}
                              max={115}
                              suffix="%"
                              disabled={locked}
                              onChange={(value) =>
                                updateControl('length', value / 100)
                              }
                            />
                            <Adjustment
                              label={browText(
                                locale,
                                'Vertical position',
                                '上下位置'
                              )}
                              value={Math.round(
                                (activeControls.vertical ?? 0) * 1000
                              )}
                              min={-40}
                              max={40}
                              disabled={locked}
                              onChange={(value) =>
                                updateControl('vertical', value / 1000)
                              }
                            />
                            <Adjustment
                              label={browText(
                                locale,
                                'Brow spacing',
                                '眉间距离'
                              )}
                              value={Math.round(
                                (activeControls.spacing ?? 0) * 1000
                              )}
                              min={-35}
                              max={35}
                              disabled={locked}
                              onChange={(value) =>
                                updateControl('spacing', value / 1000)
                              }
                            />
                            <Adjustment
                              label={browText(locale, 'Tail angle', '眉尾角度')}
                              value={activeControls.rotation ?? 0}
                              min={-8}
                              max={8}
                              suffix="°"
                              disabled={locked}
                              onChange={(value) =>
                                updateControl('rotation', value)
                              }
                            />
                          </div>
                        )}
                        <div className="brow-adjust-note">
                          <p>
                            {browText(
                              locale,
                              'Position and spacing are relative to the photo. Left and right refer to the image.',
                              '位置与间距按照片比例微调；左右以画面为准。'
                            )}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            isDisabled={locked}
                            onPress={() => {
                              local.update('natural', {});
                              setView((current) =>
                                current === 'mapping' ? current : 'contour'
                              );
                            }}
                          >
                            <RotateCcw className="size-3.5" />
                            {browText(
                              locale,
                              'Reset to natural',
                              '恢复自然眉形'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {panel === 'report' && report && (
                      <div className="space-y-5">
                        <div>
                          <h2 className="text-lg font-semibold">
                            {browText(
                              locale,
                              'Understand your brows',
                              '读懂你的眉形'
                            )}
                          </h2>
                          <p className="text-muted mt-1 text-xs leading-relaxed">
                            {browText(
                              locale,
                              'Measured from your original brows, preserving natural differences.',
                              '基于这张照片的原眉测量，保留自然的左右差异。'
                            )}
                          </p>
                        </div>
                        <div className="brow-metrics">
                          {[
                            [
                              browText(
                                locale,
                                'Arch height difference',
                                '眉峰高度差'
                              ),
                              report.archHeightDifference,
                            ],
                            [
                              browText(
                                locale,
                                'Brow length difference',
                                '两侧眉长差'
                              ),
                              report.lengthDifference,
                            ],
                            [
                              browText(
                                locale,
                                'Distance between brow heads',
                                '眉头间距'
                              ),
                              report.headGap,
                            ],
                          ].map(([label, value]) => (
                            <div key={String(label)}>
                              <span>{label}</span>
                              <strong>
                                {Number(value).toFixed(1)} <small>px</small>
                              </strong>
                            </div>
                          ))}
                        </div>
                        <p className="text-muted text-xs leading-relaxed">
                          {browText(
                            locale,
                            'Values are image pixels, not millimeters or a beauty score. Pose, expression and lighting affect measurement.',
                            '数值是图片像素，不代表实际毫米或审美评分。拍摄角度、表情和光线都会影响测量。'
                          )}
                        </p>
                        <div>
                          <h3 className="mb-2 text-sm font-medium">
                            {browText(
                              locale,
                              'Explore the mapping',
                              '看看定位依据'
                            )}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {[2, 3, 4, 5, 6].map((stage) => (
                              <Button
                                key={stage}
                                size="sm"
                                variant={
                                  view === 'mapping' && guideStage === stage
                                    ? 'secondary'
                                    : 'ghost'
                                }
                                onPress={() => {
                                  setPlaying(false);
                                  setWalkthrough(false);
                                  setView('mapping');
                                  setGuideStage(stage);
                                }}
                              >
                                {stage === 6
                                  ? browText(locale, 'All', '全部')
                                  : c.steps[stage]}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="brow-process" data-stage={guideStage}>
                          <p className="text-sm">
                            {walkthrough
                              ? c.steps[guideStage]
                              : browText(
                                  locale,
                                  'Every guide has a purpose',
                                  '每条线，都有依据'
                                )}
                          </p>
                          <p className="text-muted text-xs leading-relaxed">
                            {c.explanations[guideStage]}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onPress={() => {
                                setView('mapping');
                                setGuideStage(0);
                                setWalkthrough(true);
                                setReplayKey((value) => value + 1);
                                setPlaying(true);
                              }}
                            >
                              {walkthrough
                                ? browText(locale, 'Replay', '重新播放')
                                : browText(
                                    locale,
                                    'Play mapping walkthrough',
                                    '播放定位过程'
                                  )}
                            </Button>
                            {playing && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onPress={() => setPlaying(false)}
                              >
                                {c.pause}
                              </Button>
                            )}
                            {walkthrough && !playing && guideStage < 6 && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onPress={() => setPlaying(true)}
                              >
                                {c.continue}
                              </Button>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          onPress={() => void download(true)}
                          isDisabled={locked}
                        >
                          <Download className="size-4" />
                          {exportAccess.canExport
                            ? t('ui.export_hd')
                            : t('ui.upgrade_export')}
                        </Button>
                      </div>
                    )}
                    {panel === 'catalog' &&
                      (props.confirmed ? (
                        props.catalog
                      ) : (
                        <div className="brow-catalog-locked">
                          <Check className="text-accent size-8" />
                          <h2>
                            {browText(
                              locale,
                              'Confirm the fit, then choose a style',
                              '先确认位置，再挑款式'
                            )}
                          </h2>
                          <p className="text-muted text-sm leading-relaxed">
                            {browText(
                              locale,
                              'Confirm your contour to explore the sample collection.',
                              '满意后确认当前轮廓，即可从现有样图库选择。'
                            )}
                          </p>
                          <Button
                            variant="secondary"
                            onPress={() => setPanel('adjust')}
                          >
                            {browText(
                              locale,
                              'Back to adjustments',
                              '返回调整'
                            )}
                          </Button>
                        </div>
                      ))}
                  </>
                )}
              </div>

              <div className="brow-panel-footer">
                {props.status}
                {!props.confirmed ? (
                  <Button
                    fullWidth
                    isDisabled={!local.analysis || locked}
                    isPending={local.exporting}
                    onPress={() => void confirm()}
                  >
                    {browText(
                      locale,
                      'Confirm brows & choose a style',
                      '确认眉形，选择款式'
                    )}
                    <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <>
                    <div className="mb-3 flex items-center gap-2 text-xs">
                      <Check className="text-accent size-4" />
                      <span>
                        {browText(
                          locale,
                          'Brow placement confirmed',
                          '眉形位置已确认'
                        )}
                      </span>
                    </div>
                    {props.action}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <div
          className="brow-mobile-dock"
          role="toolbar"
          aria-label={browText(locale, 'Canvas tools', '画布工具')}
        >
          {(
            [
              {
                id: 'adjust',
                label: browText(locale, 'Adjust', '调整'),
                icon: SlidersHorizontal,
              },
              {
                id: 'report',
                label: browText(locale, 'Analysis', '分析'),
                icon: ChartNoAxesColumn,
              },
              {
                id: 'catalog',
                label: browText(locale, 'Styles', '样本'),
                icon: Images,
              },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={expandedTools && panel === id ? 'secondary' : 'ghost'}
              onPress={() => {
                setPanel(id);
                setExpandedTools(!(expandedTools && panel === id));
              }}
              aria-pressed={expandedTools && panel === id}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className="brow-workspace-bottom">
        <ShieldCheck className="size-3.5" />
        <span>
          {browText(
            locale,
            'Analysis stays on your device. Photos upload only when you generate.',
            '分析在本机完成，生成效果时才上传照片。'
          )}
        </span>
      </div>
    </Card>
  );
  // Keep the hook above mounted while hiding the dialog. Its worker, normalized
  // photo URL, and adjustments survive closing, including during analysis.
  if (!props.open) return null;
  return (
    <Modal.Backdrop isOpen onOpenChange={changeOpen} isDismissable={false}>
      <Modal.Container size="full" className="brow-editor-modal-container">
        <Modal.Dialog
          aria-label={browText(locale, 'Brow editing canvas', '眉形编辑画布')}
          className="brow-editor-modal"
        >
          {workspace}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ToolButton({
  label,
  children,
  onPress,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip delay={200}>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        aria-label={label}
        onPress={onPress}
        isDisabled={disabled}
      >
        {children}
      </Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

function Adjustment({
  className = 'brow-desktop-adjustment',
  label,
  value,
  min,
  max,
  suffix = '',
  disabled,
  onChange,
}: {
  className?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Slider
      value={value}
      minValue={min}
      maxValue={max}
      step={1}
      onChange={(next) => onChange(Number(next))}
      isDisabled={disabled}
      className={`brow-adjustment ${className}`}
    >
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-muted text-xs tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  );
}
