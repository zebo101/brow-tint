import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyBrowOffer,
  BROW_OFFERS,
  getBrowOffer,
} from '../src/config/brow-pricing';
import { CreemProvider } from '../src/extensions/payment/creem';
import { assertCreemProductMatchesOrder } from '../src/extensions/payment/creem-price';
import { PaymentInterval, PaymentType } from '../src/extensions/payment/types';

test('localized/client-shaped copy cannot change billing amount, credits or currency', () => {
  const item = applyBrowOffer({
    product_id: 'basic-monthly',
    amount: 1,
    currency: 'CNY',
    credits: 999999,
    valid_days: 0,
    interval: 'one-time',
    currencies: [
      { currency: 'CNY', amount: 1, price: '1', original_price: '' },
    ],
  });
  assert.equal(item.amount, 1290);
  assert.equal(item.credits, 100);
  assert.equal(item.currency, 'USD');
  assert.equal(item.interval, 'month');
  assert.equal(item.valid_days, 30);
  assert.equal(item.currencies, undefined);
});
test('retired credit packs and arbitrary product IDs cannot be purchased', () => {
  for (const id of [
    'topup-100',
    'topup-200',
    'topup-300',
    '__proto__',
    'free-yearly',
  ])
    assert.equal(getBrowOffer(id), undefined);
});
test('catalog prices all correspond to integer amounts and full generations', () => {
  for (const offer of BROW_OFFERS) {
    assert.equal(Math.round(Number(offer.price.slice(1)) * 100), offer.amount);
    assert.equal(offer.credits % 2, 0);
  }
});
const checkout = {
  productId: 'prod_test',
  price: { amount: 1290, currency: 'usd' },
  type: PaymentType.SUBSCRIPTION,
  plan: { name: 'Basic', interval: PaymentInterval.MONTH },
};
const product = {
  id: 'prod_test',
  price: 1290,
  currency: 'USD',
  billing_type: 'recurring',
  billing_period: 'every-month',
  status: 'active',
};
test('checkout permits the matching Creem product and rejects stale price, currency, period and product', () => {
  assert.doesNotThrow(() => assertCreemProductMatchesOrder(product, checkout));
  for (const changed of [
    { price: 1990 },
    { currency: 'EUR' },
    { billing_period: 'every-year' },
    { billing_type: 'onetime' },
    { id: 'other' },
    { status: 'archived' },
  ])
    assert.throws(
      () =>
        assertCreemProductMatchesOrder({ ...product, ...changed }, checkout),
      /configuration/
    );
});
test('topup checkout must be one-time and match its exact pack price', () => {
  const order = {
    productId: 'prod_test',
    price: { amount: 599, currency: 'USD' },
    type: PaymentType.ONE_TIME,
  };
  assert.doesNotThrow(() =>
    assertCreemProductMatchesOrder(
      { ...product, price: 599, billing_type: 'onetime' },
      order
    )
  );
  assert.throws(() =>
    assertCreemProductMatchesOrder({ ...product, price: 599 }, order)
  );
});

test('Creem never creates checkout when its stored price is stale', async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    calls.push(String(url));
    return Response.json({ ...product, price: 1990 });
  });
  const provider = new CreemProvider({
    apiKey: 'test-only',
    environment: 'sandbox',
  });
  await assert.rejects(
    provider.createPayment({ order: checkout }),
    /configuration/
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/v1\/products\?product_id=prod_test$/);
});

test('Creem checks the exact product before creating checkout', async (t) => {
  const calls: Array<{ url: string; body?: string }> = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: init.body as string });
    return Response.json(
      calls.length === 1
        ? product
        : {
            id: 'checkout_test',
            checkout_url: 'https://example.com/test-checkout',
          }
    );
  });
  const provider = new CreemProvider({
    apiKey: 'test-only',
    environment: 'sandbox',
  });
  const session = await provider.createPayment({ order: checkout });
  assert.equal(
    session.checkoutInfo.checkoutUrl,
    'https://example.com/test-checkout'
  );
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[1].body!).product_id, 'prod_test');
});
