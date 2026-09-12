import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isFreeTrialExhausted,
  requestBrowOfferCheckout,
  shouldShowBrowCreditOffer,
} from '../src/shared/lib/brow-credit-offer';

const trial = {
  remainingCredits: 0,
  paidOrders: 0,
  successfulGenerations: 2,
  grants: [
    {
      credits: 4,
      remainingCredits: 0,
      transactionScene: 'gift',
      status: 'active',
      expiresAt: null,
    },
  ],
};
test('only a fully used two-generation gift is described as the current free trial', () => {
  assert.equal(isFreeTrialExhausted(trial), true);
  for (const changed of [
    { paidOrders: 1 },
    { successfulGenerations: 1 },
    { remainingCredits: 2 },
    { grants: [] },
    // Previously issued gifts are not relabeled as the new two-generation trial.
    { grants: [{ ...trial.grants[0], credits: 6 }] },
    { grants: [...trial.grants, ...trial.grants] },
    { grants: [{ ...trial.grants[0], expiresAt: new Date() }] },
  ])
    assert.equal(isFreeTrialExhausted({ ...trial, ...changed }), false);
});
test('offer waits for a successful result, not the reservation that exhausts credits', () => {
  const state = {
    authenticated: true,
    remainingCredits: 0,
    phase: 'success',
    message: null,
  };
  assert.equal(shouldShowBrowCreditOffer(state), true);
  for (const phase of [
    'idle',
    'uploading',
    'submitting',
    'querying',
    'query-paused',
    'submit-ambiguous',
  ])
    assert.equal(shouldShowBrowCreditOffer({ ...state, phase }), false);
  assert.equal(
    shouldShowBrowCreditOffer({ ...state, remainingCredits: undefined }),
    false
  );
  assert.equal(
    shouldShowBrowCreditOffer({ ...state, authenticated: false }),
    false
  );
  assert.equal(
    shouldShowBrowCreditOffer({ ...state, remainingCredits: 2 }),
    false
  );
  assert.equal(
    shouldShowBrowCreditOffer({
      ...state,
      remainingCredits: 6,
      phase: 'failed',
      message: 'Insufficient credits, 0 < 2',
    }),
    true
  );
  assert.equal(
    shouldShowBrowCreditOffer({
      ...state,
      phase: 'failed',
      message: 'moderation_denied',
    }),
    false
  );
});
test('primary offer goes directly to the 24-credit checkout, Basic stays monthly', async () => {
  const calls: {
    url: string;
    body: { product_id: string; currency: string; locale: string };
  }[] = [];
  const transport = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return Response.json({
      code: 0,
      data: { checkoutUrl: 'https://checkout.creem.io/test' },
    });
  }) as typeof fetch;
  for (const id of ['topup-24', 'basic-monthly'] as const)
    assert.equal(
      await requestBrowOfferCheckout(id, 'zh', transport),
      'https://checkout.creem.io/test'
    );
  assert.deepEqual(
    calls.map((x) => x.body.product_id),
    ['topup-24', 'basic-monthly']
  );
  assert.ok(
    calls.every(
      (x) =>
        x.url === '/api/payment/checkout' &&
        x.body.currency === 'USD' &&
        x.body.locale === 'zh'
    )
  );
  await assert.rejects(
    requestBrowOfferCheckout('premium-yearly' as 'topup-24', 'en', transport)
  );
  assert.equal(calls.length, 2);
});
test('failed checkout never produces a navigation URL', async () => {
  for (const response of [
    Response.json({ code: -1, message: 'price mismatch' }),
    Response.json({ code: 0, data: { checkoutUrl: 'javascript:bad' } }),
    new Response('', { status: 401 }),
  ])
    await assert.rejects(
      requestBrowOfferCheckout(
        'topup-24',
        'en',
        (async () => response) as typeof fetch
      )
    );
});
