'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Segment } from '@heroui-pro/react';
import { Button, Slider, Spinner, Tooltip } from '@heroui/react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useLocale } from 'next-intl';

import type { BrowPhoto } from '@/shared/lib/brow-mapping/detector';
import { measureBrows } from '@/shared/lib/brow-mapping/report';
import type {
  BrowAdjustments,
  BrowAnalysis,
  BrowCandidate,
  BrowControls,
  BrowStyle,
} from '@/shared/lib/brow-mapping/types';
import { browFocusRegion } from '@/shared/lib/brow-mapping/viewport';

import { AnchorEditor, type AnchorEditing } from './anchor-editor';
import { browText } from './copy';
import { PortraitCanvas, type PortraitView } from './portrait-canvas';
import { BrowResultHistory } from './result-history';

import './mobile-editor.css';

type Scope = 'both' | 'left' | 'right';
type Tool = 'adjust' | 'report' | 'catalog';

export interface MobileBrowEditorProps {
  anchorEditing: AnchorEditing;
  zh: boolean;
  photo: BrowPhoto | null;
  analysis: BrowAnalysis | null;
  candidate: BrowCandidate | null;
  style: BrowStyle;
  controls: Partial<BrowControls>;
  error: string | null;
  status: string | null;
  exporting: boolean;
  disabled: boolean;
  confirmed: boolean;
  onStyleChange: (style: BrowStyle) => void;
  onControlChange: (
    scope: Scope,
    key: keyof BrowAdjustments,
    value: number
  ) => void;
  onConfirm: () => Promise<boolean>;
  onRetry?: () => void;
  onPickFile: () => void;
  onResetAdjustments?: () => void;
  onDownload?: () => void | Promise<void>;
  downloadLabel?: string;
  catalog: ReactNode;
  action: ReactNode;
  statusContent: ReactNode;
  resultUrl: string | null;
  view: PortraitView;
  onViewChange: (view: PortraitView) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  resetKey: string | number;
  onReset: () => void;
  focused: boolean;
  onToggleFocus: () => void;
}

const parameters = [
  {
    key: 'thickness',
    zh: '粗细',
    en: 'Width',
    min: 75,
    max: 125,
    scale: 100,
    initial: 1,
    suffix: '%',
  },
  {
    key: 'arch',
    zh: '眉峰',
    en: 'Arch',
    min: -25,
    max: 25,
    scale: 1000,
    initial: 0,
    suffix: '',
  },
  {
    key: 'length',
    zh: '长度',
    en: 'Length',
    min: 85,
    max: 115,
    scale: 100,
    initial: 1,
    suffix: '%',
  },
  {
    key: 'vertical',
    zh: '高度',
    en: 'Height',
    min: -40,
    max: 40,
    scale: 1000,
    initial: 0,
    suffix: '',
  },
  {
    key: 'spacing',
    zh: '间距',
    en: 'Spacing',
    min: -35,
    max: 35,
    scale: 1000,
    initial: 0,
    suffix: '',
  },
  {
    key: 'rotation',
    zh: '角度',
    en: 'Angle',
    min: -8,
    max: 8,
    scale: 1,
    initial: 0,
    suffix: '°',
  },
] as const;

export function MobileBrowEditor(props: MobileBrowEditorProps) {
  const locale = useLocale();
  const { zh, photo, analysis, candidate, confirmed, focused, view } = props;
  const [tool, setTool] = useState<Tool>('adjust');
  const [scope, setScope] = useState<Scope>('both');
  const [parameterKey, setParameterKey] =
    useState<keyof BrowAdjustments>('thickness');
  const [seenConfirmed, setSeenConfirmed] = useState(confirmed);
  const [split, setSplit] = useState(50);
  if (seenConfirmed !== confirmed) {
    setSeenConfirmed(confirmed);
    if (confirmed) setTool('catalog');
  }
  const locked = props.disabled || props.exporting;
  const canAdjust = !!analysis && !!candidate && !locked;
  const active = parameters.find(
    (parameter) => parameter.key === parameterKey
  )!;
  const scopedControls =
    scope === 'both' ? props.controls : (props.controls[scope] ?? {});
  const parameterValue = Math.round(
    (scopedControls[parameterKey] ?? active.initial) * active.scale
  );
  const report = useMemo(
    () => (analysis ? measureBrows(analysis) : null),
    [analysis]
  );
  const closeView = view === 'mapping' || view === 'contour';
  const fitRegion = useMemo(
    () =>
      analysis && photo && closeView
        ? browFocusRegion(analysis, photo)
        : undefined,
    [analysis, photo, closeView]
  );

  function changeView(next: PortraitView) {
    props.onViewChange(next);
    if ((next === 'original' || next === 'result') === closeView)
      props.onReset();
  }

  async function confirmMapping() {
    if (confirmed || (await props.onConfirm())) setTool('catalog');
  }

  return (
    <section
      className={['brow-workspace', 'mb-editor', focused && 'mb-editor-focused']
        .filter(Boolean)
        .join(' ')}
      aria-label={browText(locale, 'Brow editor', '手机眉型编辑器')}
      data-tool={tool}
    >
      <header className="mb-topbar">
        <span className="mb-title">
          {props.status
            ? browText(locale, 'Analyzing…', '正在分析…')
            : browText(locale, 'Brow canvas', '眉型画布')}
        </span>
        <div className="mb-top-actions">
          <BrowResultHistory refreshKey={props.resultUrl} />
          <Button
            size="sm"
            variant="ghost"
            isDisabled={locked}
            onPress={props.onPickFile}
          >
            {browText(locale, 'Replace', '换照片')}
          </Button>
          <Button size="sm" variant="ghost" onPress={props.onToggleFocus}>
            {focused
              ? browText(locale, 'Done', '完成')
              : browText(locale, 'Fullscreen', '全屏')}
          </Button>
        </div>
      </header>

      <div className="mb-preview-area">
        <div className="mb-preview">
          {photo ? (
            <PortraitCanvas
              photo={photo}
              analysis={analysis}
              candidate={candidate}
              view={view}
              zoom={props.zoom}
              guideStage={6}
              anchorEditing={
                tool === 'adjust' && props.anchorEditing.active && canAdjust
                  ? props.anchorEditing
                  : undefined
              }
              resultUrl={props.resultUrl}
              split={split}
              zh={zh}
              interactive
              onZoomChange={props.onZoomChange}
              resetKey={`${props.resetKey}:${closeView ? 'brows' : 'photo'}`}
              fitRegion={fitRegion}
            />
          ) : (
            <p className="mb-preparing" role="status">
              {props.error ||
                browText(locale, 'Preparing your photo…', '正在准备照片…')}
            </p>
          )}
          {photo && props.status && (
            <div className="mb-analysis-progress" role="status">
              <Spinner size="sm" />
              <span>{props.status}</span>
            </div>
          )}
        </div>
        <div className="mb-viewbar">
          <div className="mb-zoom-tools">
            <IconButton
              label={browText(locale, 'Zoom out', '缩小')}
              disabled={!photo || props.zoom <= 0.25}
              onPress={() =>
                props.onZoomChange(Math.max(0.25, props.zoom - 0.25))
              }
            >
              <Minus />
            </IconButton>
            <span className="mb-zoom-value">
              {Math.round(props.zoom * 100)}%
            </span>
            <IconButton
              label={browText(locale, 'Zoom in', '放大')}
              disabled={!photo || props.zoom >= 8}
              onPress={() => props.onZoomChange(Math.min(8, props.zoom + 0.25))}
            >
              <Plus />
            </IconButton>
            <IconButton
              label={browText(locale, 'Reset view', '重置视图')}
              disabled={!photo}
              onPress={props.onReset}
            >
              <RotateCcw />
            </IconButton>
          </div>
          <Segment
            size="sm"
            aria-label={browText(locale, 'Preview mode', '预览模式')}
            selectedKey={view}
            onSelectionChange={(key) => changeView(key as PortraitView)}
          >
            <Segment.Item id="original">
              {browText(locale, 'Photo', '原图')}
            </Segment.Item>
            <Segment.Item id="contour">
              {browText(locale, 'Contour', '轮廓')}
            </Segment.Item>
            <Segment.Item id="mapping">
              {browText(locale, 'Mapping', '定位')}
            </Segment.Item>
            {props.resultUrl && (
              <Segment.Item id="result">
                {browText(locale, 'Result', '效果')}
              </Segment.Item>
            )}
          </Segment>
        </div>
      </div>

      <div className="mb-tools">
        <Segment
          className="mb-tool-tabs"
          size="sm"
          aria-label={browText(locale, 'Editing tools', '编辑工具')}
          selectedKey={tool}
          onSelectionChange={(key) => setTool(key as Tool)}
        >
          <Segment.Item id="adjust">
            {browText(locale, 'Adjust', '调整')}
          </Segment.Item>
          <Segment.Item id="report">
            {browText(locale, 'Analysis', '分析')}
          </Segment.Item>
          <Segment.Item id="catalog">
            {browText(locale, 'Styles', '样本')}
          </Segment.Item>
        </Segment>

        <div className={`mb-tool-body mb-tool-${tool}`}>
          {tool === 'adjust' && (
            <>
              <AnchorEditor
                editing={props.anchorEditing}
                candidate={candidate}
                disabled={!canAdjust}
                zh={zh}
              />
              {!props.anchorEditing.active && (
                <>
                  <div className="mb-option-row">
                    <span>{browText(locale, 'Shape', '方向')}</span>
                    <Segment
                      size="sm"
                      aria-label={browText(
                        locale,
                        'Brow direction',
                        '眉型方向'
                      )}
                      selectedKey={props.style}
                      isDisabled={!canAdjust}
                      onSelectionChange={(key) =>
                        props.onStyleChange(key as BrowStyle)
                      }
                    >
                      <Segment.Item id="natural">
                        {browText(locale, 'Natural', '自然')}
                      </Segment.Item>
                      <Segment.Item id="soft">
                        {browText(locale, 'Soft', '柔和')}
                      </Segment.Item>
                      <Segment.Item id="lifted">
                        {browText(locale, 'Lifted', '上扬')}
                      </Segment.Item>
                    </Segment>
                  </div>
                  <div className="mb-option-row">
                    <span>{browText(locale, 'Side', '范围')}</span>
                    <Segment
                      size="sm"
                      aria-label={browText(
                        locale,
                        'Select image side',
                        '按照片左右选择'
                      )}
                      selectedKey={scope}
                      onSelectionChange={(key) => setScope(key as Scope)}
                    >
                      <Segment.Item id="both">
                        {browText(locale, 'Both', '两侧')}
                      </Segment.Item>
                      <Segment.Item id="left">
                        {browText(locale, 'Left', '图左')}
                      </Segment.Item>
                      <Segment.Item id="right">
                        {browText(locale, 'Right', '图右')}
                      </Segment.Item>
                    </Segment>
                  </div>
                  <Segment
                    className="mb-parameters"
                    size="sm"
                    aria-label={browText(
                      locale,
                      'Adjustment parameter',
                      '选择调整参数'
                    )}
                    selectedKey={parameterKey}
                    onSelectionChange={(key) =>
                      setParameterKey(key as keyof BrowAdjustments)
                    }
                  >
                    {parameters.map((parameter) => (
                      <Segment.Item key={parameter.key} id={parameter.key}>
                        {browText(locale, parameter.en, parameter.zh)}
                      </Segment.Item>
                    ))}
                  </Segment>
                  <Slider
                    className="mb-slider"
                    aria-label={browText(locale, active.en, active.zh)}
                    value={parameterValue}
                    minValue={active.min}
                    maxValue={active.max}
                    step={1}
                    isDisabled={!canAdjust}
                    onChange={(value) =>
                      props.onControlChange(
                        scope,
                        active.key,
                        Number(value) / active.scale
                      )
                    }
                  >
                    <div className="mb-slider-label">
                      <span>{browText(locale, active.en, active.zh)}</span>
                      <span>
                        {parameterValue}
                        {active.suffix}
                      </span>
                    </div>
                    <Slider.Track>
                      <Slider.Fill />
                      <Slider.Thumb />
                    </Slider.Track>
                  </Slider>
                </>
              )}
            </>
          )}
          {tool === 'report' && (
            <div className="mb-scroll-content">
              {report ? (
                <>
                  <table className="mb-report-table">
                    <thead>
                      <tr>
                        <th>
                          {browText(locale, 'Photo measurements', '照片测量')}
                        </th>
                        <th>{browText(locale, 'Left', '图左')}</th>
                        <th>{browText(locale, 'Right', '图右')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th>{browText(locale, 'Length', '眉长')}</th>
                        <td>{report.left.length.toFixed(1)}</td>
                        <td>{report.right.length.toFixed(1)}</td>
                      </tr>
                      <tr>
                        <th>{browText(locale, 'Arch rise', '眉峰高度')}</th>
                        <td>{report.left.archRise.toFixed(1)}</td>
                        <td>{report.right.archRise.toFixed(1)}</td>
                      </tr>
                      <tr>
                        <th>{browText(locale, 'Thickness', '眉厚')}</th>
                        <td>{report.left.thickness.toFixed(1)}</td>
                        <td>{report.right.thickness.toFixed(1)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mb-report-note">
                    {browText(
                      locale,
                      'Brow gap {n} px · Original brow measurements',
                      '眉间距 {n} px · 原始眉毛测量'
                    ).replace('{n}', report.headGap.toFixed(1))}
                  </p>
                  {props.resultUrl && (
                    <Slider
                      className="mb-slider"
                      aria-label={browText(
                        locale,
                        'Before and after',
                        '前后对比'
                      )}
                      value={split}
                      minValue={0}
                      maxValue={100}
                      onChange={(value) => {
                        setSplit(Number(value));
                        changeView('result');
                      }}
                    >
                      <Slider.Track>
                        <Slider.Fill />
                        <Slider.Thumb />
                      </Slider.Track>
                    </Slider>
                  )}
                </>
              ) : (
                <p className="mb-report-note">
                  {props.error ||
                    browText(
                      locale,
                      'Measurements appear after analysis.',
                      '分析完成后显示测量。'
                    )}
                </p>
              )}
            </div>
          )}
          {tool === 'catalog' && (
            <div className="mb-scroll-content">{props.catalog}</div>
          )}
        </div>

        <footer className="mb-footer">
          {props.error && analysis && (
            <p className="mb-error" role="alert">
              {props.error}
            </p>
          )}
          {props.error && !analysis && props.onRetry ? (
            <div className="mb-analysis-recovery">
              <p className="mb-error" role="alert">
                {props.error}
              </p>
              <p className="text-muted text-xs">
                {browText(
                  locale,
                  'Your photo is kept. Reload analysis to try again.',
                  '照片已保留，点击重新加载分析即可重试。'
                )}
              </p>
              <div className="mb-confirm-row">
                <Button
                  fullWidth
                  size="sm"
                  variant="primary"
                  isDisabled={locked}
                  onPress={props.onRetry}
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  {browText(locale, 'Reload analysis', '重新加载分析')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={locked}
                  onPress={props.onPickFile}
                >
                  {browText(locale, 'Replace', '换照片')}
                </Button>
              </div>
            </div>
          ) : tool === 'catalog' && confirmed ? (
            props.action
          ) : (
            <div className="mb-confirm-row">
              {tool === 'report' && props.onDownload && (
                <Button
                  size="sm"
                  variant="ghost"
                  isDisabled={locked || !analysis}
                  onPress={props.onDownload}
                >
                  {props.downloadLabel ?? browText(locale, 'Export', '导出')}
                </Button>
              )}
              {tool === 'adjust' && props.onResetAdjustments && (
                <Button
                  size="sm"
                  variant="ghost"
                  isDisabled={!canAdjust}
                  onPress={props.onResetAdjustments}
                >
                  {browText(locale, 'Reset', '重置')}
                </Button>
              )}
              <Button
                fullWidth
                size="sm"
                variant="primary"
                isDisabled={!canAdjust}
                isPending={props.exporting}
                onPress={confirmMapping}
              >
                {props.exporting
                  ? browText(locale, 'Confirming…', '正在确认…')
                  : confirmed
                    ? browText(locale, 'Choose a style', '继续选样本')
                    : browText(locale, 'Confirm mapping', '确认定位，选样本')}
              </Button>
            </div>
          )}
          {tool === 'catalog' && props.statusContent && (
            <div className="mb-status">{props.statusContent}</div>
          )}
        </footer>
      </div>
    </section>
  );
}

function IconButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip delay={200}>
      <Button
        className="mb-icon-button"
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={label}
        isDisabled={disabled}
        onPress={onPress}
      >
        {children}
      </Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
