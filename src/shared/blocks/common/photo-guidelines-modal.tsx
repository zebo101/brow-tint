'use client';

import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { photoGuidelinesConfig } from '@/config/photo-guidelines';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="border-border/60 bg-background/95 flex max-h-[92vh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border p-0 shadow-[0_32px_90px_-36px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:max-w-xl md:max-w-3xl"
        showCloseButton={true}
      >
        <DialogHeader className="border-border/70 bg-background/95 shrink-0 border-b px-5 py-4 md:px-7 md:py-5">
          <DialogTitle className="pr-8 text-left text-base font-semibold tracking-tight md:text-lg">
            {t('title')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('title')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
          <Section
            variant="success"
            icon={<Check className="h-3 w-3" />}
            title={t('suitableTitle')}
            description={t('suitableDescription')}
            photos={photoGuidelinesConfig.suitablePhotos}
            badgeIcon={<Check className="h-2.5 w-2.5 md:h-3 md:w-3" />}
            altPrefix={t('suitableTitle')}
          />

          <div className="mt-6 md:mt-8">
            <Section
              variant="destructive"
              icon={<X className="h-3 w-3" />}
              title={t('unsuitableTitle')}
              description={t('unsuitableDescription')}
              photos={photoGuidelinesConfig.unsuitablePhotos}
              badgeIcon={<X className="h-2.5 w-2.5 md:h-3 md:w-3" />}
              altPrefix={t('unsuitableTitle')}
            />
          </div>
        </div>

        <div className="border-border/70 bg-background/95 flex shrink-0 flex-col-reverse items-stretch gap-3 border-t px-5 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between md:px-7">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={(checked) =>
                setDontShowAgain(checked as boolean)
              }
            />
            <span className="text-muted-foreground text-sm">
              {t('dontShowAgain')}
            </span>
          </label>
          <Button
            onClick={handleConfirm}
            className="sm:min-w-[140px]"
            size="sm"
          >
            {t('confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
          chipText: 'text-emerald-600 dark:text-emerald-400',
          chipRing: 'ring-emerald-500/30',
          cardBorder: 'border-emerald-500/25 hover:border-emerald-500/50',
          badgeBg: 'bg-emerald-500',
        }
      : {
          chipBg: 'bg-red-500/15',
          chipText: 'text-red-600 dark:text-red-400',
          chipRing: 'ring-red-500/30',
          cardBorder: 'border-red-500/25 hover:border-red-500/50',
          badgeBg: 'bg-red-500',
        };

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-inset ${tones.chipBg} ${tones.chipText} ${tones.chipRing}`}
        >
          {icon}
        </span>
        <h3 className="text-sm font-semibold md:text-base">{title}</h3>
      </div>
      <p className="text-muted-foreground mb-3.5 text-xs leading-relaxed md:text-sm">
        {description}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {photos.map((photo, index) => (
          <figure
            key={`${altPrefix}-${index}`}
            className={`group bg-background relative overflow-hidden rounded-xl border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${tones.cardBorder}`}
          >
            <img
              src={photo}
              alt={`${altPrefix} ${index + 1}`}
              className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              loading="lazy"
            />
            <span
              className={`absolute right-1.5 bottom-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-white shadow ring-1 ring-white/40 md:h-6 md:w-6 ${tones.badgeBg}`}
            >
              {badgeIcon}
            </span>
          </figure>
        ))}
      </div>
    </section>
  );
}
