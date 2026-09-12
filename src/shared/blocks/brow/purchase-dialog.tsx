'use client';

import { useRef, useState } from 'react';
import { Button, Modal } from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';

import { hydrateBrowPricing } from '@/config/brow-pricing';
import { useAppContext } from '@/shared/contexts/app';
import {
  openBrowCheckout,
  requestBrowPurchaseCheckout,
  type BrowPurchaseId,
} from '@/shared/lib/brow-purchase';
import type { Pricing } from '@/shared/types/blocks/pricing';

import './workspace.css';
import './purchase-dialog.css';

export default function BrowPurchaseDialog({
  reason,
  onClose,
}: {
  reason: 'export' | 'compare' | 'credits';
  onClose: () => void;
}) {
  const t = useTranslations('pages.ai-brow-tint.purchase');
  const offerText = useTranslations('pages.ai-brow-tint.credit_offer');
  const ui = useTranslations('pages.ai-brow-tint.ui');
  const pricingText = useTranslations('pages.pricing');
  const pricing = hydrateBrowPricing(
    pricingText.raw('page.sections.pricing') as Pricing
  );
  const locale = useLocale();
  const { user, setIsShowSignModal } = useAppContext();
  const [group, setGroup] = useState(
    reason === 'compare' ? 'monthly' : 'one-time'
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const busy = useRef(false);

  async function checkout(id: string) {
    if (busy.current) return;
    if (!user) {
      setIsShowSignModal(true);
      return;
    }
    busy.current = true;
    setPending(id);
    setError(false);
    setCheckoutUrl(null);
    try {
      const fallback = await openBrowCheckout(() =>
        requestBrowPurchaseCheckout(id as BrowPurchaseId, locale)
      );
      setCheckoutUrl(fallback);
      setStarted(true);
    } catch (reason) {
      if (reason instanceof Error && reason.message === 'sign_in_required')
        setIsShowSignModal(true);
      else setError(true);
    } finally {
      busy.current = false;
      setPending(null);
    }
  }
  const groups = pricing.groups?.filter(
    (item) => reason !== 'compare' || item.name !== 'one-time'
  );
  const items = pricing.items?.filter(
    (item) =>
      item.amount > 0 &&
      item.group === group &&
      (reason !== 'compare' || item.product_id.startsWith('premium-'))
  );
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy.current) onClose();
      }}
      isDismissable={!pending}
      isKeyboardDismissDisabled={!!pending}
    >
      <Modal.Container size="lg" placement="center">
        <Modal.Dialog
          className="brow-workspace brow-purchase-dialog gap-5 p-5 sm:p-6"
          aria-label={t('title')}
        >
          {!pending && <Modal.CloseTrigger aria-label={ui('close')} />}
          <Modal.Header className="pr-8">
            <Modal.Heading>{t('title')}</Modal.Heading>
            <p className="text-muted text-sm">
              {t(reason === 'compare' ? 'compare_description' : 'description')}
            </p>
          </Modal.Header>
          <Modal.Body className="min-h-0 space-y-5">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={t('plans')}
            >
              {groups?.map((item) => (
                <Button
                  key={item.name}
                  size="sm"
                  variant={group === item.name ? 'primary' : 'secondary'}
                  aria-pressed={group === item.name}
                  isDisabled={!!pending}
                  onPress={() => setGroup(item.name!)}
                >
                  {item.title}
                </Button>
              ))}
            </div>
            <div
              className={`grid gap-4 ${items?.length === 3 ? 'md:grid-cols-3' : items?.length === 2 ? 'md:grid-cols-2' : ''}`}
            >
              {items?.map((item) => (
                <article
                  key={item.product_id}
                  className="border-border flex flex-col gap-4 rounded-2xl border p-4"
                >
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="tabular-nums">
                    <strong className="text-2xl">{item.price}</strong>{' '}
                    <span className="text-muted text-sm">{item.unit}</span>
                  </p>
                  <ul className="space-y-2 text-sm">
                    {item.features?.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <p className="text-muted text-xs leading-relaxed">
                    {item.tip}
                  </p>
                  <Button
                    className="mt-auto w-full"
                    isDisabled={!!pending}
                    isPending={pending === item.product_id}
                    onPress={() => void checkout(item.product_id)}
                  >
                    {pending === item.product_id
                      ? offerText('processing')
                      : item.button?.title}
                  </Button>
                </article>
              ))}
            </div>
            {error && (
              <p role="alert" className="text-danger text-sm">
                {offerText('error')}
              </p>
            )}
            {checkoutUrl && (
              <a
                className="block text-sm underline"
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('continue_checkout')}
              </a>
            )}
            {started && (
              <p role="status" className="text-muted text-sm">
                {t('return_note')}
              </p>
            )}
            <p className="text-muted text-xs">{t('checkout_note')}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" isDisabled={!!pending} onPress={onClose}>
              {t('back')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
