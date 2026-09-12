import type { PaymentOrder } from './types';

export function assertCreemProductMatchesOrder(
  product: {
    id: string;
    price: number;
    currency: string;
    billing_type: string;
    billing_period?: string;
    status: string;
  },
  order: PaymentOrder
) {
  const expectedPeriod =
    order.plan?.interval === 'month'
      ? 'every-month'
      : order.plan?.interval === 'year'
        ? 'every-year'
        : null;
  const recurring = order.type === 'subscription';
  if (
    product.id !== order.productId ||
    product.status !== 'active' ||
    !order.price ||
    product.price !== order.price.amount ||
    product.currency.toLowerCase() !== order.price.currency.toLowerCase() ||
    product.billing_type !== (recurring ? 'recurring' : 'onetime') ||
    (recurring &&
      (!expectedPeriod || product.billing_period !== expectedPeriod))
  ) {
    throw new Error(
      'Payment product configuration does not match this plan. Please contact support.'
    );
  }
}
