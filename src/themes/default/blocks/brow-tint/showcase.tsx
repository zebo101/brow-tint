'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import { Button, Card, Chip, Modal, Tooltip } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { annotate } from 'rough-notation';
import type { RoughAnnotation } from 'rough-notation/lib/model';

import { photoGuidelinesConfig } from '@/config/photo-guidelines';

import { BrowCatalogPanel } from './catalog-panel';
import { browShapeLabel } from './shape-label';
import { getShowcaseStyles } from './showcase-styles';
import type { BrowStyleItem } from './types';

import './showcase.css';

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

interface BrowShowcaseProps {
  styles: BrowStyleItem[];
  selectedStyleId: string | null;
  hasPhoto: boolean;
  disabled: boolean;
  loadingSample: boolean;
  preview: ReactNode;
  onPickFile: () => void;
  onDropFile: (file: File) => void;
  onSelectSample: (src: string) => void;
  onOpenGuidelines: () => void;
  onContinue: () => void;
  onClear: () => void;
  onSelectStyle: (style: BrowStyleItem) => void;
}

export function BrowShowcase({
  styles,
  selectedStyleId,
  hasPhoto,
  disabled,
  loadingSample,
  preview,
  onPickFile,
  onDropFile,
  onSelectSample,
  onOpenGuidelines,
  onContinue,
  onClear,
  onSelectStyle,
}: BrowShowcaseProps) {
  const locale = useLocale();
  const t = useTranslations('pages.ai-brow-tint');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const unavailable = disabled || loadingSample;
  const cannotOpenPhoto = !hasPhoto && unavailable;
  const desktopStyles = useMemo(() => getShowcaseStyles(styles, 16), [styles]);
  const mobileStyles = useMemo(() => getShowcaseStyles(styles, 6), [styles]);
  const selectedStyle = styles.find((style) => style.id === selectedStyleId);

  const renderStyle = (style: BrowStyleItem) => {
    const selected = style.id === selectedStyleId;
    return (
      <Button
        key={style.id}
        variant="ghost"
        className="brow-showcase__style"
        isDisabled={unavailable}
        aria-pressed={selected}
        aria-label={browShapeLabel(style, locale)}
        onPress={() => onSelectStyle(style)}
      >
        <span className="brow-showcase__style-image">
          {style.thumbnail ? (
            <Image
              src={style.thumbnail}
              alt=""
              width={300}
              height={200}
              sizes="(max-width: 760px) 28vw, (max-width: 1023px) 15vw, 150px"
              quality={75}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="brow-showcase__missing-image">
              {t('ui.no_sample_image')}
            </span>
          )}
          {selected && (
            <span className="brow-showcase__selected-badge">
              {t('ui.selected')}
            </span>
          )}
        </span>
        <span className="brow-showcase__style-name">
          {browShapeLabel(style, locale)}
        </span>
        <span className="brow-showcase__style-shade">
          {t('ui.eyebrow_filter')}
        </span>
      </Button>
    );
  };

  return (
    <div className="brow-showcase">
      <div className="brow-showcase__layout">
        <Card variant="secondary" className="brow-showcase__photo-card">
          <Card.Header className="brow-showcase__photo-header">
            <Button variant="ghost" size="sm" onPress={onOpenGuidelines}>
              {t('ui.photo_tips')}
            </Button>
          </Card.Header>
          <Card.Content className="brow-showcase__photo-content">
            <figure className="brow-showcase__polaroid">
              <div
                className="brow-showcase__photo-trigger"
                data-dragging={dragging || undefined}
                role="button"
                tabIndex={cannotOpenPhoto ? -1 : 0}
                aria-disabled={cannotOpenPhoto}
                aria-busy={loadingSample}
                aria-label={
                  hasPhoto
                    ? t('ui.continue_editing_your_photo')
                    : t('ui.upload_a_photo_or_drop_it_here')
                }
                onClick={() => {
                  if (!cannotOpenPhoto) (hasPhoto ? onContinue : onPickFile)();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (!cannotOpenPhoto)
                      (hasPhoto ? onContinue : onPickFile)();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!unavailable) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files[0];
                  if (file && !unavailable) onDropFile(file);
                }}
              >
                {hasPhoto ? (
                  <div className="brow-showcase__existing-photo">{preview}</div>
                ) : (
                  <div className="brow-showcase__example-photo">
                    <Image
                      className="brow-showcase__example-image"
                      src="/imgs/cases/2.jpg"
                      width={706}
                      height={941}
                      sizes="(max-width: 760px) 216px, 288px"
                      quality={75}
                      loading="eager"
                      fetchPriority="high"
                      alt={t('ui.example_photo_with_brow_mapping')}
                    />
                    <img
                      className="brow-showcase__example-mapping"
                      src="/imgs/cases/2-mapping.svg"
                      width={706}
                      height={941}
                      alt=""
                      aria-hidden="true"
                    />
                    <Chip
                      size="sm"
                      variant="soft"
                      className="brow-showcase__example-badge"
                    >
                      <Chip.Label>{t('ui.example_mapping')}</Chip.Label>
                    </Chip>
                  </div>
                )}
              </div>
              <figcaption className="font-display brow-showcase__caption">
                {hasPhoto ? t('ui.your_photo') : t('ui.make_it_yours')}
              </figcaption>
            </figure>
            {!hasPhoto && (
              <div className="brow-showcase__samples">
                <span>{t('ui.or_try_a_sample')}</span>
                {photoGuidelinesConfig.suitablePhotos.map((src, index) => (
                  <Tooltip key={src}>
                    <Button
                      isIconOnly
                      variant="ghost"
                      className="brow-showcase__sample"
                      aria-label={t('ui.use_sample', { n: index + 1 })}
                      isDisabled={unavailable}
                      onPress={() => onSelectSample(src)}
                    >
                      <Image
                        src={src}
                        alt=""
                        width={600}
                        height={600}
                        sizes="32px"
                        quality={75}
                      />
                    </Button>
                    <Tooltip.Content>
                      {t('ui.use_sample', { n: index + 1 })}
                    </Tooltip.Content>
                  </Tooltip>
                ))}
              </div>
            )}
          </Card.Content>
          <Card.Footer className="brow-showcase__photo-footer">
            <Button
              fullWidth
              variant="primary"
              data-brow-upload={!hasPhoto || undefined}
              data-brow-continue={hasPhoto || undefined}
              isDisabled={cannotOpenPhoto}
              onPress={hasPhoto ? onContinue : onPickFile}
            >
              {loadingSample
                ? t('ui.loading_sample')
                : hasPhoto
                  ? t('ui.continue_editing')
                  : t('ui.upload_photo_start_designing')}
            </Button>
            {hasPhoto ? (
              <div className="brow-showcase__photo-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={unavailable}
                  onPress={onPickFile}
                >
                  {t('ui.replace_photo')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={unavailable}
                  onPress={onClear}
                >
                  {t('ui.remove_photo')}
                </Button>
              </div>
            ) : (
              <p className="brow-showcase__specs">
                JPG · PNG · WebP · {t('ui.up_to_15_mb')}
              </p>
            )}
          </Card.Footer>
        </Card>

        <Card className="brow-showcase__gallery-card">
          <Card.Header className="brow-showcase__gallery-header">
            <h2 className="card__title font-display brow-showcase__gallery-title">
              {t('ui.find_your_brow_style')}
            </h2>
            <Card.Description>
              {t('ui.choose_a_look_then_try_it_on_your_photo')}
            </Card.Description>
          </Card.Header>
          <Card.Content className="brow-showcase__gallery-content">
            {styles.length ? (
              <>
                <div className="brow-showcase__grid brow-showcase__grid--desktop">
                  {desktopStyles.map(renderStyle)}
                </div>
                <div className="brow-showcase__grid brow-showcase__grid--mobile">
                  {mobileStyles.map(renderStyle)}
                </div>
              </>
            ) : (
              <p className="text-muted text-sm">
                {t(
                  'ui.styles_are_unavailable_you_can_still_upload_a_photo_to_map_your_b'
                )}
              </p>
            )}
          </Card.Content>
          <Card.Footer className="brow-showcase__gallery-footer">
            <p className="brow-showcase__selection-hint" role="status">
              {selectedStyle
                ? hasPhoto
                  ? t('ui.selected_continue', {
                      name: browShapeLabel(selectedStyle, locale),
                    })
                  : t('ui.selected_upload', {
                      name: browShapeLabel(selectedStyle, locale),
                    })
                : null}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="brow-showcase__browse-button"
              isDisabled={unavailable || !styles.length}
              onPress={() => setCatalogOpen(true)}
            >
              <GradientHighlighter
                colors={['#a78bfa', '#ddd6fe', '#ffffff']}
                strokeWidth={2.5}
              >
                {t('ui.browse_all_styles')}
              </GradientHighlighter>
              <ArrowRight aria-hidden="true" size={14} />
            </Button>
          </Card.Footer>
        </Card>
      </div>

      <Modal.Backdrop isOpen={catalogOpen} onOpenChange={setCatalogOpen}>
        <Modal.Container scroll="inside">
          <Modal.Dialog className="brow-showcase brow-showcase__catalog">
            <Modal.CloseTrigger aria-label={t('ui.close_style_gallery')} />
            <Modal.Header>
              <Modal.Heading>{t('ui.brow_style_gallery')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <BrowCatalogPanel
                styles={styles}
                selectedStyleId={selectedStyleId}
                confirmed={false}
                allowPreselection
                disabled={unavailable}
                onSelect={(style) => {
                  onSelectStyle(style);
                  setCatalogOpen(false);
                }}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="ghost">
                {t('ui.close')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
