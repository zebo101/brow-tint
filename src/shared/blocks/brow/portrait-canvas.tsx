'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { useLocale } from 'next-intl';

import type { BrowPhoto } from '@/shared/lib/brow-mapping/detector';
import { clamp, midpoint } from '@/shared/lib/brow-mapping/geometry';
import type {
  BrowAnalysis,
  BrowCandidate,
  Point,
} from '@/shared/lib/brow-mapping/types';
import {
  clientToImage,
  fitPortraitViewport,
  panViewport,
  zoomViewportAt,
  type FitInsets,
  type Viewport,
} from '@/shared/lib/brow-mapping/viewport';

import type { AnchorEditing } from './anchor-editor';
import { browText } from './copy';

export type PortraitView = 'contour' | 'mapping' | 'original' | 'result';

const anchorLabels: Record<string, string[]> = {
  ko: [
    '화면 왼쪽 눈썹 앞머리 기준점',
    '화면 왼쪽 눈썹산 기준점',
    '화면 왼쪽 눈썹 꼬리 기준점',
    '화면 오른쪽 눈썹 앞머리 기준점',
    '화면 오른쪽 눈썹산 기준점',
    '화면 오른쪽 눈썹 꼬리 기준점',
  ],
  ja: [
    '画像左側の眉頭の基準点',
    '画像左側の眉山の基準点',
    '画像左側の眉尻の基準点',
    '画像右側の眉頭の基準点',
    '画像右側の眉山の基準点',
    '画像右側の眉尻の基準点',
  ],
  de: [
    'Ankerpunkt am Brauenanfang links im Bild',
    'Ankerpunkt am Brauenbogen links im Bild',
    'Ankerpunkt am Brauenende links im Bild',
    'Ankerpunkt am Brauenanfang rechts im Bild',
    'Ankerpunkt am Brauenbogen rechts im Bild',
    'Ankerpunkt am Brauenende rechts im Bild',
  ],
  es: [
    'Punto de inicio de la ceja izquierda de la imagen',
    'Punto del arco de la ceja izquierda de la imagen',
    'Punto de la cola de la ceja izquierda de la imagen',
    'Punto de inicio de la ceja derecha de la imagen',
    'Punto del arco de la ceja derecha de la imagen',
    'Punto de la cola de la ceja derecha de la imagen',
  ],
  it: [
    'Punto iniziale del sopracciglio a sinistra nell’immagine',
    'Punto dell’arco del sopracciglio a sinistra nell’immagine',
    'Punto della coda del sopracciglio a sinistra nell’immagine',
    'Punto iniziale del sopracciglio a destra nell’immagine',
    'Punto dell’arco del sopracciglio a destra nell’immagine',
    'Punto della coda del sopracciglio a destra nell’immagine',
  ],
  pt: [
    'Ponto inicial da sobrancelha à esquerda da imagem',
    'Ponto do arco da sobrancelha à esquerda da imagem',
    'Ponto da cauda da sobrancelha à esquerda da imagem',
    'Ponto inicial da sobrancelha à direita da imagem',
    'Ponto do arco da sobrancelha à direita da imagem',
    'Ponto da cauda da sobrancelha à direita da imagem',
  ],
};

type PortraitCanvasProps = {
  anchorEditing?: AnchorEditing;
  photo: BrowPhoto;
  analysis: BrowAnalysis | null;
  candidate: BrowCandidate | null;
  view: PortraitView;
  zoom: number;
  guideStage: number;
  walkthrough?: boolean;
  replayKey?: number;
  resultUrl: string | null;
  split: number;
  zh: boolean;
  interactive?: boolean;
  onZoomChange?: (zoom: number) => void;
  resetKey?: string | number;
  /** CSS pixels reserved for floating tools, used only when fitting the photo. */
  fitInsets?: FitInsets;
  /** World-space region to fit; the complete photo remains freely navigable. */
  fitRegion?: Viewport;
};

export function PortraitCanvas(props: PortraitCanvasProps) {
  return (
    <PortraitCanvasSurface
      key={`${props.photo.url}:${props.resetKey ?? ''}`}
      {...props}
    />
  );
}

function PortraitCanvasSurface({
  photo,
  analysis,
  candidate,
  view,
  zoom,
  guideStage,
  walkthrough = false,
  replayKey = 0,
  resultUrl,
  split,
  zh,
  interactive = false,
  onZoomChange,
  fitInsets,
  fitRegion,
  anchorEditing,
}: PortraitCanvasProps) {
  const locale = useLocale();
  const clip = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [surface, setSurface] = useState({
    width: photo.width,
    height: photo.height,
  });
  const [center, setCenter] = useState<Point | null>(null);
  const [unitsPerPixel, setUnitsPerPixel] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const gestureCamera = useRef<{ box: Viewport; zoom: number } | null>(null);
  const anchorDrag = useRef<{
    pointerId: number;
    target: AnchorEditing['selected'];
    start: Point;
    origin: Point;
    box: Viewport;
  } | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSurface((previous) =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height }
        );
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const fitted = fitPortraitViewport(photo, surface, fitInsets, fitRegion);
  const unit = unitsPerPixel ?? fitted.width / surface.width;
  const base = useMemo(
    () => ({
      x: fitted.x,
      y: fitted.y,
      width: surface.width * unit,
      height: surface.height * unit,
    }),
    [fitted.x, fitted.y, surface.width, surface.height, unit]
  );
  const boundedZoom = clamp(Number.isFinite(zoom) ? zoom : 1, 0.25, 8);
  const width = base.width / boundedZoom,
    height = base.height / boundedZoom;
  const box = panViewport(
    {
      x: (center?.x ?? base.x + base.width / 2) - width / 2,
      y: (center?.y ?? base.y + base.height / 2) - height / 2,
      width,
      height,
    },
    photo,
    { x: 0, y: 0 }
  );
  const updateCamera = useCallback(
    (next: Viewport, nextZoom: number) => {
      gestureCamera.current = { box: next, zoom: nextZoom };
      setCenter({ x: next.x + next.width / 2, y: next.y + next.height / 2 });
      // After interacting, the camera is independent of tool insets and resize
      // preserves world scale rather than fitting the photo again.
      setUnitsPerPixel(unit);
      if (nextZoom !== boundedZoom) onZoomChange?.(nextZoom);
    },
    [boundedZoom, onZoomChange, unit]
  );
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !interactive || !onZoomChange) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? surface.height
            : 1);
      const nextZoom = clamp(boundedZoom * Math.exp(-delta * 0.002), 0.25, 8);
      const anchor = clientToImage(
        { x: event.clientX, y: event.clientY },
        svg.getBoundingClientRect(),
        box
      );
      updateCamera(
        zoomViewportAt(box, base, photo, nextZoom, anchor),
        nextZoom
      );
    };
    // React wheel handlers are passive; this listener prevents page scrolling
    // only while operating the interactive canvas.
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, [
    interactive,
    onZoomChange,
    boundedZoom,
    surface.height,
    box,
    base,
    photo,
    updateCamera,
  ]);
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (
      !interactive ||
      (event.pointerType === 'mouse' && event.button !== 0) ||
      pointers.current.size >= 2
    )
      return;
    if (anchorDrag.current) return;
    const handle = (event.target as Element).closest('[data-brow-anchor]');
    if (anchorEditing && candidate && handle && pointers.current.size === 0) {
      const side = handle.getAttribute(
        'data-side'
      ) as AnchorEditing['selected']['side'];
      const point = handle.getAttribute(
        'data-brow-anchor'
      ) as AnchorEditing['selected']['point'];
      const target = { side, point };
      anchorEditing.onSelect(target);
      anchorDrag.current = {
        pointerId: event.pointerId,
        target,
        start: clientToImage(
          { x: event.clientX, y: event.clientY },
          event.currentTarget.getBoundingClientRect(),
          box
        ),
        origin: candidate.brows[side === 'left' ? 0 : 1][point],
        box,
      };
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    event.preventDefault();
    if (pointers.current.size === 0)
      gestureCamera.current = { box, zoom: boundedZoom };
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const drag = anchorDrag.current;
    if (drag?.pointerId === event.pointerId) {
      event.preventDefault();
      const next = clientToImage(
        { x: event.clientX, y: event.clientY },
        event.currentTarget.getBoundingClientRect(),
        drag.box
      );
      anchorEditing?.onMove(drag.target, {
        x: drag.origin.x + next.x - drag.start.x,
        y: drag.origin.y + next.y - drag.start.y,
      });
      return;
    }
    if (!interactive || !pointers.current.has(event.pointerId)) return;
    event.preventDefault();
    const previous = [...pointers.current.values()];
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const current = [...pointers.current.values()];
    const camera = gestureCamera.current ?? { box, zoom: boundedZoom };
    const rect = event.currentTarget.getBoundingClientRect();
    let next = camera.box;
    let nextZoom = camera.zoom;
    const before =
      previous.length === 2 ? midpoint(previous[0], previous[1]) : previous[0];
    const after =
      current.length === 2 ? midpoint(current[0], current[1]) : current[0];
    if (previous.length === 2 && onZoomChange) {
      const oldDistance = Math.hypot(
        previous[0].x - previous[1].x,
        previous[0].y - previous[1].y
      );
      const newDistance = Math.hypot(
        current[0].x - current[1].x,
        current[0].y - current[1].y
      );
      if (oldDistance > 1 && newDistance > 1) {
        nextZoom = clamp((camera.zoom * newDistance) / oldDistance, 0.25, 8);
        next = zoomViewportAt(
          next,
          base,
          photo,
          nextZoom,
          clientToImage(before, rect, next)
        );
      }
    }
    const from = clientToImage(before, rect, next),
      to = clientToImage(after, rect, next);
    next = panViewport(next, photo, { x: from.x - to.x, y: from.y - to.y });
    updateCamera(next, nextZoom);
  };
  const pointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    if (anchorDrag.current?.pointerId === event.pointerId)
      anchorDrag.current = null;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size === 0) {
      gestureCamera.current = null;
      setDragging(false);
    }
  };
  const viewBox = `${box.x} ${box.y} ${box.width} ${box.height}`;
  const boundary = box.x + (box.width * split) / 100;
  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{
        touchAction: interactive ? 'none' : 'auto',
        cursor: interactive ? (dragging ? 'grabbing' : 'grab') : undefined,
        userSelect: interactive ? 'none' : undefined,
      }}
      onPointerDown={interactive ? pointerDown : undefined}
      onPointerMove={interactive ? pointerMove : undefined}
      onPointerUp={interactive ? pointerEnd : undefined}
      onPointerCancel={interactive ? pointerEnd : undefined}
      onLostPointerCapture={interactive ? pointerEnd : undefined}
      onDoubleClick={
        interactive && onZoomChange
          ? (event) => {
              event.preventDefault();
              const nextZoom =
                boundedZoom >= 7.9 ? 1 : Math.min(8, boundedZoom * 2);
              const anchor = clientToImage(
                { x: event.clientX, y: event.clientY },
                event.currentTarget.getBoundingClientRect(),
                box
              );
              updateCamera(
                zoomViewportAt(box, base, photo, nextZoom, anchor),
                nextZoom
              );
            }
          : undefined
      }
      className="brow-portrait"
      role={anchorEditing ? 'group' : 'img'}
      aria-label={browText(locale, 'Brow design preview', '眉形设计预览')}
    >
      <defs>
        <clipPath id={clip}>
          <rect
            x={box.x}
            y={box.y}
            width={(box.width * split) / 100}
            height={box.height}
          />
        </clipPath>
      </defs>
      <image href={photo.url} width={photo.width} height={photo.height} />
      {view === 'result' && resultUrl && (
        <>
          <image
            href={resultUrl}
            width={photo.width}
            height={photo.height}
            preserveAspectRatio="xMidYMid meet"
            clipPath={`url(#${clip})`}
          />
          <line
            x1={boundary}
            x2={boundary}
            y1={box.y}
            y2={box.y + box.height}
            stroke="white"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      {(view === 'contour' || view === 'mapping') && candidate && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {view === 'mapping' &&
            walkthrough &&
            analysis?.landmarks.map((point, index) => (
              <circle
                key={`landmark-${index}`}
                cx={point.x}
                cy={point.y}
                r={analysis.frame.scale * 0.009}
                fill="white"
                stroke="#6e514a"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          {view === 'mapping' &&
            analysis?.guides
              .filter(
                (g) =>
                  guideStage === 6 ||
                  (walkthrough ? g.stage <= guideStage : g.stage === guideStage)
              )
              .map((g) => (
                <path
                  key={`${replayKey}-${g.id}`}
                  className={walkthrough ? 'brow-guide-drawing' : undefined}
                  pathLength={1}
                  d={`M ${g.from.x} ${g.from.y} L ${g.to.x} ${g.to.y}`}
                  stroke="white"
                  opacity={0.65}
                  strokeWidth={0.8}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          {(!walkthrough || guideStage >= 6 || view !== 'mapping') &&
            candidate.brows.map((brow, i) => (
              <g key={i}>
                <path
                  d={brow.path}
                  stroke="#36201c"
                  opacity={0.25}
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={brow.path}
                  stroke="white"
                  fill="white"
                  fillOpacity={0.035}
                  strokeWidth={1.4}
                  vectorEffect="non-scaling-stroke"
                />
                {view === 'mapping' &&
                  [brow.head, brow.arch, brow.tail].map((p, j) =>
                    anchorEditing ? (
                      (() => {
                        const target: AnchorEditing['selected'] = {
                          side: i === 0 ? 'left' : 'right',
                          point: (['head', 'arch', 'tail'] as const)[j],
                        };
                        const selected =
                          anchorEditing.selected.side === target.side &&
                          anchorEditing.selected.point === target.point;
                        const pixel = box.width / surface.width;
                        return (
                          <g
                            key={j}
                            className="brow-anchor-handle"
                            data-side={target.side}
                            data-brow-anchor={target.point}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            aria-label={
                              zh
                                ? `${i === 0 ? '画面左' : '画面右'}${['眉头', '眉峰', '眉尾'][j]}定位点`
                                : (anchorLabels[locale.split('-')[0]]?.[
                                    i * 3 + j
                                  ] ??
                                  `${target.side} brow ${target.point} anchor`)
                            }
                            onFocus={() => anchorEditing.onSelect(target)}
                            onKeyDown={(event) => {
                              const moves: Record<string, Point> = {
                                ArrowLeft: { x: -1, y: 0 },
                                ArrowRight: { x: 1, y: 0 },
                                ArrowUp: { x: 0, y: -1 },
                                ArrowDown: { x: 0, y: 1 },
                              };
                              const delta = moves[event.key];
                              if (delta) {
                                event.preventDefault();
                                event.stopPropagation();
                                const step = event.shiftKey ? 5 : 1;
                                anchorEditing.onMove(target, {
                                  x: p.x + delta.x * step,
                                  y: p.y + delta.y * step,
                                });
                              } else if (
                                event.key === 'Enter' ||
                                event.key === ' '
                              ) {
                                event.preventDefault();
                                event.stopPropagation();
                                anchorEditing.onSelect(target);
                              }
                            }}
                          >
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={14 * pixel}
                              fill="transparent"
                              stroke="none"
                            />
                            <circle
                              className="brow-anchor-dot"
                              cx={p.x}
                              cy={p.y}
                              r={(selected ? 5 : 4) * pixel}
                              fill={selected ? '#7c3aed' : 'white'}
                              stroke="white"
                              strokeWidth={1.5}
                              vectorEffect="non-scaling-stroke"
                              pointerEvents="none"
                            />
                          </g>
                        );
                      })()
                    ) : (
                      <circle
                        key={j}
                        cx={p.x}
                        cy={p.y}
                        r={analysis ? analysis.frame.scale * 0.014 : 2}
                        fill="white"
                        stroke="#6e514a"
                        strokeWidth={0.75}
                        vectorEffect="non-scaling-stroke"
                      />
                    )
                  )}
              </g>
            ))}
        </g>
      )}
    </svg>
  );
}
