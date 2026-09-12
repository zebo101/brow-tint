import {
  BROW_FREE_TRIAL_CREDITS,
  BROW_GENERATION_CREDITS,
  getBrowOffer,
} from '@/config/brow-pricing';

export function isFreeTrialExhausted({
  remainingCredits,
  grants,
  successfulGenerations,
  paidOrders,
}: {
  remainingCredits: number;
  grants: {
    credits: number;
    remainingCredits: number;
    transactionScene: string | null;
    status: string;
    expiresAt: Date | null;
  }[];
  successfulGenerations: number;
  paidOrders: number;
}) {
  const grant = grants[0];
  return (
    remainingCredits === 0 &&
    paidOrders === 0 &&
    grants.length === 1 &&
    grant.credits === BROW_FREE_TRIAL_CREDITS &&
    grant.remainingCredits === 0 &&
    grant.transactionScene === 'gift' &&
    grant.status === 'active' &&
    !grant.expiresAt &&
    successfulGenerations >= BROW_FREE_TRIAL_CREDITS / BROW_GENERATION_CREDITS
  );
}

export function shouldShowBrowCreditOffer({
  authenticated,
  remainingCredits,
  phase,
  message,
}: {
  authenticated: boolean;
  remainingCredits?: number;
  phase: string;
  message?: string | null;
}) {
  if (!authenticated) return false;
  if (phase === 'failed' && /^insufficient credits/i.test(message || ''))
    return true;
  return (
    phase === 'success' &&
    remainingCredits !== undefined &&
    remainingCredits < BROW_GENERATION_CREDITS
  );
}

export type BrowCreditOfferId = 'topup-24' | 'basic-monthly';

export async function requestBrowOfferCheckout(
  productId: BrowCreditOfferId,
  locale: string,
  transport: typeof fetch = fetch
) {
  if (!['topup-24', 'basic-monthly'].includes(productId))
    throw new Error('invalid_offer');
  const offer = getBrowOffer(productId)!;
  const response = await transport('/api/payment/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: offer.product_id,
      currency: 'USD',
      locale,
      metadata: { entry_point: 'brow-credit-limit' },
    }),
  });
  if (response.status === 401) throw new Error('sign_in_required');
  if (!response.ok) throw new Error('checkout_failed');
  const payload = await response.json();
  if (payload.code !== 0) {
    if (/no auth/i.test(payload.message || ''))
      throw new Error('sign_in_required');
    throw new Error('checkout_failed');
  }
  const url = payload.data?.checkoutUrl;
  if (typeof url !== 'string' || new URL(url).protocol !== 'https:')
    throw new Error('checkout_failed');
  return url;
}
