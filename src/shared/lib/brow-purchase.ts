import { BROW_OFFERS, getBrowOffer } from '@/config/brow-pricing';

export type BrowPurchaseId = Exclude<
  (typeof BROW_OFFERS)[number]['product_id'],
  'free-monthly'
>;

export async function requestBrowPurchaseCheckout(
  productId: BrowPurchaseId,
  locale: string,
  transport: typeof fetch = fetch
) {
  const offer = getBrowOffer(productId);
  if (!offer || offer.amount <= 0) throw new Error('invalid_offer');
  const response = await transport('/api/payment/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: offer.product_id,
      currency: 'USD',
      locale,
      metadata: { entry_point: 'brow-workspace-upgrade' },
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

// Reserve the tab during the click, before the async checkout request. Never
// navigate the editing tab: its local photo and draft must remain available.
export async function openBrowCheckout(
  request: () => Promise<string>,
  open: () => Window | null = () => window.open('about:blank', '_blank')
) {
  const checkout = open();
  if (checkout) checkout.opener = null;
  try {
    const url = await request();
    if (checkout && !checkout.closed) {
      checkout.location.replace(url);
      return null;
    }
    return url; // A visible, user-clicked link handles blocked popups.
  } catch (error) {
    checkout?.close();
    throw error;
  }
}
