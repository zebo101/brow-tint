'use client';

import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Button, Card, Tooltip } from '@heroui/react';
import { PackageOpen, ShieldCheck, Upload } from 'lucide-react';
import { useLocale } from 'next-intl';

import { browText } from './copy';

import './welcome.css';

export interface BrowWelcomeProps {
  zh: boolean;
  disabled: boolean;
  onPickFile: () => void;
  onSelectSample: (source: string) => void;
  onOpenGuidelines: () => void;
  onDropFile: (file: File) => void;
}

const samples = ['/imgs/cases/2.jpg', '/imgs/cases/4.jpg'];

export function BrowWelcome({
  zh,
  disabled,
  onPickFile,
  onSelectSample,
  onOpenGuidelines,
  onDropFile,
}: BrowWelcomeProps) {
  const locale = useLocale();
  const headingId = useId();
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const steps = [
    browText(locale, 'Add photo', '选照片'),
    browText(locale, 'Refine brows', '调整眉型'),
    browText(locale, 'Try a look', '试色'),
  ];

  return (
    <Card
      className="brow-start"
      role="region"
      aria-labelledby={headingId}
      aria-busy={disabled || undefined}
      data-dragging={dragging && !disabled ? 'true' : undefined}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        dragDepth.current += 1;
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file && !disabled) onDropFile(file);
      }}
    >
      <ol
        className="brow-start-steps"
        aria-label={browText(locale, 'Brow preview steps', '试眉步骤')}
      >
        {steps.map((step, index) => (
          <li key={step} aria-current={index === 0 ? 'step' : undefined}>
            <span className="brow-start-step-number" aria-hidden="true">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <Card.Content className="brow-start-content">
        <div className="brow-start-intro">
          <div className="brow-start-placeholder" aria-hidden="true">
            <PackageOpen strokeWidth={1.35} />
          </div>
          <h2 id={headingId}>
            {browText(locale, 'Start with your photo', '从你的照片开始')}
          </h2>
          <p>
            {browText(
              locale,
              'Face the camera in even light, with your brows visible.',
              '正面、光线均匀，让眉毛清晰可见。'
            )}
          </p>
        </div>
        <div className="brow-start-upload">
          <Button variant="primary" onPress={onPickFile} isDisabled={disabled}>
            <Upload size={17} aria-hidden="true" />
            {disabled
              ? browText(locale, 'Preparing…', '正在准备…')
              : browText(locale, 'Choose photo', '选择照片')}
          </Button>
          <p className="brow-start-file-hint" aria-live="polite">
            {dragging && !disabled
              ? browText(
                  locale,
                  'Drop to use this photo',
                  '松开即可使用这张照片'
                )
              : browText(
                  locale,
                  'Or drop it here · JPG / PNG / WebP · Up to 15 MB',
                  '或拖放到这里 · JPG / PNG / WebP · 最大 15 MB'
                )}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="brow-start-guidelines"
            onPress={onOpenGuidelines}
            isDisabled={disabled}
          >
            {browText(locale, 'Photo tips', '照片建议')}
          </Button>
        </div>
      </Card.Content>

      <div className="brow-start-samples">
        <span>{browText(locale, 'Or try a sample', '也可以先试试')}</span>
        <div className="brow-start-sample-buttons">
          {samples.map((source, index) => {
            const label = browText(
              locale,
              'Use sample photo {n}',
              '使用示例照片 {n}'
            ).replace('{n}', String(index + 1));
            return (
              <Tooltip key={source} delay={200}>
                <Button
                  variant="ghost"
                  className="brow-start-sample"
                  aria-label={label}
                  isDisabled={disabled}
                  onPress={() => onSelectSample(source)}
                >
                  <Image
                    src={source}
                    alt=""
                    width={56}
                    height={64}
                    sizes="56px"
                  />
                </Button>
                <Tooltip.Content>{label}</Tooltip.Content>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <p className="brow-start-local">
        <ShieldCheck size={14} aria-hidden="true" />
        {browText(
          locale,
          'Brow analysis stays on your device until you generate a preview.',
          '眉形分析在本机完成，生成试色前不会上传照片。'
        )}
      </p>
    </Card>
  );
}
