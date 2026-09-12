'use client';

import { useEffect, useId, useState } from 'react';
import { Sheet } from '@heroui-pro/react';
import { Button, Checkbox, Modal, Tooltip } from '@heroui/react';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { photoGuidelinesConfig } from '@/config/photo-guidelines';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

import styles from './photo-guidelines-modal.module.css';

interface PhotoGuidelinesModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function PhotoGuidelinesModal({
  open,
  onClose,
  onConfirm,
}: PhotoGuidelinesModalProps) {
  const t = useTranslations('ai.image.generator.photoGuidelines');
  const isMobile = useIsMobile();
  const titleId = useId();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [shouldSkip, setShouldSkip] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shouldHide =
        localStorage.getItem(photoGuidelinesConfig.storageKey) === 'true';
      setShouldSkip(shouldHide);
    }
  }, []);

  useEffect(() => {
    if (open && shouldSkip) {
      onConfirm();
    }
  }, [open, shouldSkip, onConfirm]);

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem(photoGuidelinesConfig.storageKey, 'true');
    }
    onConfirm();
  };

  if (shouldSkip) return null;

  // Body content — shared by both desktop Modal and mobile Sheet.
  const body = (
    <>
      <Section
        variant="success"
        icon={<Check className="h-3 w-3" />}
        title={t('suitableTitle')}
        description={t('suitableDescription')}
        photos={photoGuidelinesConfig.suitablePhotos}
        altPrefix={t('suitableTitle')}
      />
      <Section
        variant="destructive"
        icon={<X className="h-3 w-3" />}
        title={t('unsuitableTitle')}
        description={t('unsuitableDescription')}
        photos={photoGuidelinesConfig.unsuitablePhotos}
        altPrefix={t('unsuitableTitle')}
      />
    </>
  );

  // Footer — shared.
  const footer = (
    <div className={styles.actions}>
      <Checkbox
        isSelected={dontShowAgain}
        onChange={setDontShowAgain}
        className={styles.preference}
      >
        <Checkbox.Control />
        <Checkbox.Content className={styles.preferenceText}>
          {t('dontShowAgain')}
        </Checkbox.Content>
      </Checkbox>
      <Button
        variant="primary"
        size="sm"
        onPress={handleConfirm}
        className={styles.confirm}
      >
        {t('confirm')}
      </Button>
    </div>
  );

  const dialogContent = (
    <div className={styles.content}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {t('title')}
        </h2>
        <Tooltip>
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            aria-label="Close"
            onPress={onClose}
            className={styles.close}
          >
            <X className="h-4 w-4" />
          </Button>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip>
      </div>
      <div className={styles.body}>{body}</div>
      <div className={styles.footer}>{footer}</div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet
        isOpen={open}
        onOpenChange={(isOpen) => !isOpen && onClose()}
        placement="bottom"
        shouldAutoFocus
      >
        <Sheet.Backdrop>
          <Sheet.Content className={styles.sheet}>
            <Sheet.Dialog
              aria-labelledby={titleId}
              className={styles.sheetDialog}
            >
              <Sheet.Handle />
              {dialogContent}
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    );
  }

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog aria-labelledby={titleId} className={styles.modal}>
            {dialogContent}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

type SectionVariant = 'success' | 'destructive';

function Section({
  variant,
  icon,
  title,
  description,
  photos,
  altPrefix,
}: {
  variant: SectionVariant;
  icon: React.ReactNode;
  title: string;
  description: string;
  photos: string[];
  altPrefix: string;
}) {
  return (
    <section>
      <div className={styles.sectionHeader}>
        <span
          className={cn(
            styles.status,
            variant === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
        <h3 className={styles.sectionTitle}>{title}</h3>
      </div>
      <p className={styles.description}>{description}</p>
      <div className={styles.photos}>
        {photos.map((photo, index) => (
          <figure key={`${altPrefix}-${index}`} className={styles.photo}>
            <img
              src={photo}
              alt={`${altPrefix} ${index + 1}`}
              width={600}
              height={600}
              className={styles.image}
              loading="lazy"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
