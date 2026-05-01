'use client';

import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button, Checkbox, Modal } from '@heroui/react';
import { Sheet } from '@heroui-pro/react';

import { photoGuidelinesConfig } from '@/config/photo-guidelines';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

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
        badgeIcon={<Check className="h-2.5 w-2.5" />}
        altPrefix={t('suitableTitle')}
      />
      <Section
        variant="destructive"
        icon={<X className="h-3 w-3" />}
        title={t('unsuitableTitle')}
        description={t('unsuitableDescription')}
        photos={photoGuidelinesConfig.unsuitablePhotos}
        badgeIcon={<X className="h-2.5 w-2.5" />}
        altPrefix={t('unsuitableTitle')}
      />
    </>
  );

  // Footer — shared.
  const footer = (
    <div className="flex w-full items-center justify-between gap-3">
      <Checkbox
        isSelected={dontShowAgain}
        onChange={setDontShowAgain}
        className="flex cursor-pointer items-center gap-2"
      >
        <Checkbox.Control />
        <Checkbox.Content className="text-default-500 text-xs">
          {t('dontShowAgain')}
        </Checkbox.Content>
      </Checkbox>
      <Button
        variant="primary"
        size="sm"
        onPress={handleConfirm}
        className="min-w-[120px]"
      >
        {t('confirm')}
      </Button>
    </div>
  );

  // Inline header/body/footer composition shared by both shells. Plain
  // divs only — Modal.Header / Sheet.Header / Modal.Footer / Sheet.Footer
  // ship with column-stacking defaults that override flex-row on icon-
  // only close buttons and don't reliably pin the footer at the bottom.
  const dialogContent = (paddingX: string) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'border-divider flex shrink-0 flex-row items-center justify-between gap-2 border-b pb-3 pt-3',
          paddingX
        )}
      >
        <h2 className="text-base font-semibold leading-tight">
          {t('title')}
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
      <div
        className={cn(
          'min-h-0 flex-1 space-y-5 overflow-y-auto py-4',
          paddingX
        )}
      >
        {body}
      </div>
      <div
        className={cn(
          'bg-background border-divider shrink-0 border-t py-3',
          paddingX
        )}
      >
        {footer}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet
        isOpen={open}
        onOpenChange={(isOpen) => !isOpen && onClose()}
        // snap=1 fully opens whatever height Sheet.Content has. We cap
        // Sheet.Content to 4/5 viewport (h-[80vh]) so the *dialog
        // itself* is 80vh tall, not the snap fraction of a 100vh
        // dialog. Result: sheet covers the bottom 4/5 of the screen
        // and the footer is always within that visible area.
        snapPoints={[1]}
        activeSnapPoint={1}
        placement="bottom"
      >
        <Sheet.Backdrop>
          <Sheet.Content className="mx-auto h-[80vh] w-full max-w-2xl">
            <Sheet.Dialog className="flex h-full flex-col">
              <Sheet.Handle />
              <Sheet.Body className="min-h-0 flex-1 overflow-hidden p-0">
                {dialogContent('px-4')}
              </Sheet.Body>
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
          <Modal.Dialog className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden">
            {dialogContent('px-5')}
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
  badgeIcon,
  altPrefix,
}: {
  variant: SectionVariant;
  icon: React.ReactNode;
  title: string;
  description: string;
  photos: string[];
  badgeIcon: React.ReactNode;
  altPrefix: string;
}) {
  const tones =
    variant === 'success'
      ? {
          chipBg: 'bg-emerald-500/15',
          chipText: 'text-emerald-600',
          chipRing: 'ring-emerald-500/30',
          cardBorder: 'border-emerald-500/25 hover:border-emerald-500/50',
          badgeBg: 'bg-emerald-500',
        }
      : {
          chipBg: 'bg-red-500/15',
          chipText: 'text-red-600',
          chipRing: 'ring-red-500/30',
          cardBorder: 'border-red-500/25 hover:border-red-500/50',
          badgeBg: 'bg-red-500',
        };

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
            tones.chipBg,
            tones.chipText,
            tones.chipRing
          )}
        >
          {icon}
        </span>
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-default-500 mb-3 text-xs leading-relaxed">
        {description}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <figure
            key={`${altPrefix}-${index}`}
            className={cn(
              'group bg-content1 relative overflow-hidden rounded-xl border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
              tones.cardBorder
            )}
          >
            <img
              src={photo}
              alt={`${altPrefix} ${index + 1}`}
              className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              loading="lazy"
            />
            <span
              className={cn(
                'absolute right-1.5 bottom-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-white shadow ring-1 ring-white/40',
                tones.badgeBg
              )}
            >
              {badgeIcon}
            </span>
          </figure>
        ))}
      </div>
    </section>
  );
}
