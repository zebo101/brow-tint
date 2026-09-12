import assert from 'node:assert/strict';
import test from 'node:test';

import { BROW_OFFERS } from '@/config/brow-pricing';

import {
  openBrowCheckout,
  requestBrowPurchaseCheckout,
  type BrowPurchaseId,
} from './brow-purchase';

test('all paid offers request server-priced checkout, never a client amount', async () => {
  const calls: Record<string, unknown>[] = [];
  const transport = (async (_url, init) => {
    calls.push(JSON.parse(init!.body as string));
    return Response.json({
      code: 0,
      data: { checkoutUrl: 'https://checkout.creem.io/test' },
    });
  }) as typeof fetch;
  for (const offer of BROW_OFFERS.filter((item) => item.amount > 0)) {
    await requestBrowPurchaseCheckout(
      offer.product_id as BrowPurchaseId,
      'zh',
      transport
    );
  }
  assert.equal(calls.length, 7);
  assert.ok(
    calls.every(
      (body) =>
        body.currency === 'USD' && body.locale === 'zh' && !('amount' in body)
    )
  );
  await assert.rejects(
    requestBrowPurchaseCheckout(
      'free-monthly' as BrowPurchaseId,
      'zh',
      transport
    )
  );
  assert.equal(calls.length, 7);
});

test('invalid or unauthorized checkout cannot navigate', async () => {
  for (const response of [
    new Response('', { status: 401 }),
    Response.json({ code: -1 }),
    Response.json({ code: 0, data: { checkoutUrl: 'javascript:alert(1)' } }),
  ]) {
    await assert.rejects(
      requestBrowPurchaseCheckout(
        'topup-24',
        'en',
        (async () => response) as typeof fetch
      )
    );
  }
});

test('checkout reserves a separate tab before request and disconnects its opener', async () => {
  const events: string[] = [];
  const tab = {
    opener: {},
    closed: false,
    location: { replace: (url: string) => events.push(url) },
    close: () => events.push('close'),
  };
  const result = await openBrowCheckout(
    async () => {
      events.push('request');
      return 'https://checkout.creem.io/test';
    },
    () => {
      events.push('open');
      return tab as unknown as Window;
    }
  );
  assert.deepEqual(events, [
    'open',
    'request',
    'https://checkout.creem.io/test',
  ]);
  assert.equal(tab.opener, null);
  assert.equal(result, null);
});

test('blocked popup returns a manual link; failure closes only the new tab', async () => {
  assert.equal(
    await openBrowCheckout(
      async () => 'https://checkout.creem.io/test',
      () => null
    ),
    'https://checkout.creem.io/test'
  );
  let closed = false;
  const tab = {
    close: () => {
      closed = true;
    },
    opener: null,
  } as unknown as Window;
  await assert.rejects(
    openBrowCheckout(
      async () => {
        throw new Error('failed');
      },
      () => tab
    )
  );
  assert.equal(closed, true);
});
