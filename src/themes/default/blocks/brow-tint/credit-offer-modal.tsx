'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Modal } from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';

import { BROW_GENERATION_CREDITS, getBrowOffer } from '@/config/brow-pricing';
import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';
import { useBrowPurchase } from '@/shared/contexts/brow-purchase';
import {
  requestBrowOfferCheckout,
  type BrowCreditOfferId,
} from '@/shared/lib/brow-credit-offer';
import { openBrowCheckout } from '@/shared/lib/brow-purchase';

export function BrowCreditOfferModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const locale = useLocale();
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const { user, setIsShowSignModal, fetchUserCredits } = useAppContext();
  const userId = user?.id;
  const [trial, setTrial] = useState(false);
  const [pending, setPending] = useState<BrowCreditOfferId | null>(null);
  const [error, setError] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!open || !userId) return;
    const controller = new AbortController();
    const refresh = () => {
      void fetch('/api/brow/credit-offer', {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then(async (response) => {
          if (!response.ok) return;
          const status = await response.json();
          if (controller.signal.aborted) return;
          // Another tab may have spent or added credits. Refresh both cases so
          // closing the offer never leaves the Generate action with a stale balance.
          void fetchUserCredits();
          if (status.remainingCredits >= BROW_GENERATION_CREDITS) {
            onOpenChange(false);
          } else setTrial(status.freeTrialExhausted === true);
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
    };
  }, [
    open,
    userId,
    user?.credits?.remainingCredits,
    onOpenChange,
    fetchUserCredits,
  ]);

  async function checkout(id: BrowCreditOfferId) {
    if (busy.current) return;
    if (!user) {
      onOpenChange(false);
      setIsShowSignModal(true);
      return;
    }
    busy.current = true;
    setPending(id);
    setError(false);
    setCheckoutUrl(null);
    try {
      const fallback = await openBrowCheckout(() =>
        requestBrowOfferCheckout(id, locale)
      );
      setCheckoutUrl(fallback);
      busy.current = false;
      setPending(null);
    } catch (reason) {
      if (reason instanceof Error && reason.message === 'sign_in_required') {
        onOpenChange(false);
        setIsShowSignModal(true);
      } else setError(true);
      busy.current = false;
      setPending(null);
    }
  }

  return (
    <BrowCreditOfferDialog
      checkoutUrl={checkoutUrl}
      open={open && !!user}
      trial={trial}
      pending={pending}
      error={error}
      onCheckout={checkout}
      onOpenChange={(value) => {
        if (!busy.current) onOpenChange(value);
      }}
    />
  );
}

export function BrowCreditOfferDialog({
  checkoutUrl,
  open,
  trial,
  pending,
  error,
  onCheckout,
  onOpenChange,
}: {
  checkoutUrl?: string | null;
  open: boolean;
  trial: boolean;
  pending: BrowCreditOfferId | null;
  error: boolean;
  onCheckout: (id: BrowCreditOfferId) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('pages.ai-brow-tint.credit_offer');
  const ui = useTranslations('pages.ai-brow-tint.ui');
  const descriptionId = useId();
  const openPurchase = useBrowPurchase();
  const purchaseText = useTranslations('pages.ai-brow-tint.purchase');
  const topup = getBrowOffer('topup-24')!;
  const basic = getBrowOffer('basic-monthly')!;
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable={!pending}
      isKeyboardDismissDisabled={!!pending}
    >
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog
          className="space-y-4 p-6"
          aria-describedby={descriptionId}
        >
          {!pending && <Modal.CloseTrigger aria-label={ui('close')} />}
          <Modal.Header className="space-y-2 pr-5">
            <Modal.Heading>{t(trial ? 'trial_title' : 'title')}</Modal.Heading>
            <p id={descriptionId} className="text-muted-foreground text-sm">
              {t('description')}
            </p>
          </Modal.Header>
          <div className="flex flex-col gap-3">
            <Button
              className="min-h-12 w-full whitespace-normal"
              disabled={!!pending}
              onClick={() => onCheckout('topup-24')}
            >
              {pending === 'topup-24'
                ? t('processing')
                : t('topup', {
                    count: topup.credits / BROW_GENERATION_CREDITS,
                    price: topup.price,
                  })}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              {t('topup_note')}
            </p>
            <Button
              variant="outline"
              className="min-h-11 w-full whitespace-normal"
              disabled={!!pending}
              onClick={() => onCheckout('basic-monthly')}
            >
              {pending === 'basic-monthly'
                ? t('processing')
                : t('basic', { price: basic.price })}
            </Button>
            {pending ? (
              <span className="text-muted-foreground text-center text-sm">
                {t('pricing')}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  openPurchase('credits');
                }}
                className="text-muted-foreground py-2 text-center text-sm underline underline-offset-4"
              >
                {t('pricing')}
              </button>
            )}
            {checkoutUrl && (
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-sm underline"
              >
                {purchaseText('continue_checkout')}
              </a>
            )}
            <p className="text-muted-foreground text-xs">
              {purchaseText('checkout_note')}
            </p>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {t('error')}
              </p>
            )}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
