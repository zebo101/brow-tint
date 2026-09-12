import type { Pricing, PricingItem } from '@/shared/types/blocks/pricing';

export const BROW_GENERATION_CREDITS = 2;
export const BROW_FREE_TRIAL_CREDITS = 4;

// Billing amounts are cents. Localized copy must never determine what is charged
// or how many credits a payment grants. Existing orders retain their snapshots.
export const BROW_OFFERS = [
  {
    product_id: 'free-monthly',
    product_name: 'Free',
    amount: 0,
    credits: BROW_FREE_TRIAL_CREDITS,
    interval: 'month',
    valid_days: 0,
    group: 'monthly',
    price: '$0',
  },
  {
    product_id: 'basic-monthly',
    product_name: 'Basic Monthly',
    amount: 1290,
    credits: 100,
    interval: 'month',
    valid_days: 30,
    group: 'monthly',
    price: '$12.9',
  },
  {
    product_id: 'premium-monthly',
    product_name: 'Premium Monthly',
    amount: 2490,
    credits: 300,
    interval: 'month',
    valid_days: 30,
    group: 'monthly',
    price: '$24.9',
  },
  {
    product_id: 'basic-yearly',
    product_name: 'Basic Annual',
    amount: 15900,
    credits: 2400,
    interval: 'year',
    valid_days: 365,
    group: 'yearly',
    price: '$159',
  },
  {
    product_id: 'premium-yearly',
    product_name: 'Premium Annual',
    amount: 23900,
    credits: 3600,
    interval: 'year',
    valid_days: 365,
    group: 'yearly',
    price: '$239',
  },
  {
    product_id: 'topup-24',
    product_name: 'Browlens 24 Credits',
    amount: 599,
    credits: 24,
    interval: 'one-time',
    valid_days: 0,
    group: 'one-time',
    price: '$5.99',
  },
  {
    product_id: 'topup-60',
    product_name: 'Browlens 60 Credits',
    amount: 1199,
    credits: 60,
    interval: 'one-time',
    valid_days: 0,
    group: 'one-time',
    price: '$11.99',
  },
  {
    product_id: 'topup-120',
    product_name: 'Browlens 120 Credits',
    amount: 1999,
    credits: 120,
    interval: 'one-time',
    valid_days: 0,
    group: 'one-time',
    price: '$19.99',
  },
] as const;

export function getBrowOffer(productId: string) {
  return BROW_OFFERS.find((offer) => offer.product_id === productId);
}

export function applyBrowOffer(copy: PricingItem): PricingItem {
  const offer = getBrowOffer(copy.product_id);
  if (!offer) throw new Error('Unknown Browlens offer');
  return {
    ...copy,
    ...offer,
    currency: 'USD',
    currencies: undefined,
    original_price: undefined,
  };
}

export function hydrateBrowPricing(copy: Pricing): Pricing {
  return {
    ...copy,
    items: BROW_OFFERS.map((offer) => {
      const item = copy.items?.find(
        (entry) => entry.product_id === offer.product_id
      );
      if (!item) throw new Error(`Missing pricing copy: ${offer.product_id}`);
      return applyBrowOffer(item);
    }),
  };
}
