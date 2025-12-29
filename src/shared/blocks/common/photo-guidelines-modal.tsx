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
  DialogTitle,
} from '@/shared/components/ui/dialog';
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
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [shouldSkip, setShouldSkip] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shouldHide =
        localStorage.getItem(photoGuidelinesConfig.storageKey) === 'true';
      setShouldSkip(shouldHide);
    }
  }, []);

  // Auto-confirm if user previously chose "don't show again"
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

  // Don't render if should skip
  if (shouldSkip) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-5xl overflow-y-auto p-0"
        showCloseButton={true}
      >
        <div className="p-6 md:p-10">
          {/* Title */}
          <DialogTitle className="mb-6 pr-8 text-center text-xl font-bold md:mb-10 md:text-3xl">
            {t('title')}
          </DialogTitle>

          {/* Suitable Photos Section */}
          <div className="mb-8 md:mb-10">
            <div className="mb-3 flex items-center gap-2 md:mb-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 md:h-7 md:w-7">
                <Check className="h-3.5 w-3.5 text-white md:h-4 md:w-4" />
              </div>
              <h3 className="text-lg font-semibold md:text-xl">
                {t('suitableTitle')}
              </h3>
            </div>
            <p className="text-muted-foreground mb-4 text-sm leading-relaxed md:mb-6 md:text-base">
              {t('suitableDescription')}
            </p>
            <div className="grid grid-cols-4 gap-2 md:gap-4">
              {photoGuidelinesConfig.suitablePhotos.map((photo, index) => (
                <div
                  key={`suitable-${index}`}
                  className="relative overflow-hidden rounded-xl border-2 border-emerald-400 shadow-sm transition-transform hover:scale-[1.02]"
                >
                  <img
                    src={photo}
                    alt={`${t('suitableTitle')} ${index + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded bg-emerald-500 shadow md:bottom-3 md:right-3 md:h-7 md:w-7">
                    <Check className="h-2.5 w-2.5 text-white md:h-4 md:w-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Unsuitable Photos Section */}
          <div className="mb-8 md:mb-10">
            <div className="mb-3 flex items-center gap-2 md:mb-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 md:h-7 md:w-7">
                <X className="h-3.5 w-3.5 text-white md:h-4 md:w-4" />
              </div>
              <h3 className="text-lg font-semibold md:text-xl">
                {t('unsuitableTitle')}
              </h3>
            </div>
            <p className="text-muted-foreground mb-4 text-sm leading-relaxed md:mb-6 md:text-base">
              {t('unsuitableDescription')}
            </p>
            <div className="grid grid-cols-4 gap-2 md:gap-4">
              {photoGuidelinesConfig.unsuitablePhotos.map((photo, index) => (
                <div
                  key={`unsuitable-${index}`}
                  className="relative overflow-hidden rounded-xl border-2 border-red-400 shadow-sm transition-transform hover:scale-[1.02]"
                >
                  <img
                    src={photo}
                    alt={`${t('unsuitableTitle')} ${index + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded bg-red-500 shadow md:bottom-3 md:right-3 md:h-7 md:w-7">
                    <X className="h-2.5 w-2.5 text-white md:h-4 md:w-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col items-center gap-3 pt-2 md:gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={dontShowAgain}
                onCheckedChange={(checked) =>
                  setDontShowAgain(checked as boolean)
                }
                className="border-gray-300"
              />
              <span className="text-muted-foreground text-sm">
                {t('dontShowAgain')}
              </span>
            </label>

            <Button
              onClick={handleConfirm}
              className="w-full rounded-lg px-8 py-2.5 font-medium md:w-auto"
            >
              {t('confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
