import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveBrowEntitlements } from '../src/shared/lib/brow-entitlements';

const now = new Date('2026-09-12T12:00:00Z');
const period = {
  currentPeriodStart: new Date('2026-09-01'),
  currentPeriodEnd: new Date('2026-10-01'),
};
test('credits alone do not unlock export or priority', () => {
  assert.deepEqual(
    resolveBrowEntitlements({ subscriptions: [], hasPaidTopup: false, now }),
    { tier: 'free', canExport: false, canCompare: false, queuePriority: 0 }
  );
});
test('paid topup unlocks single export, not subscriptions-only benefits', () => {
  assert.deepEqual(
    resolveBrowEntitlements({ subscriptions: [], hasPaidTopup: true, now }),
    { tier: 'free', canExport: true, canCompare: false, queuePriority: 0 }
  );
});
test('active and end-of-period canceled subscriptions retain their paid tier', () => {
  for (const status of ['active', 'pending_cancel']) {
    assert.equal(
      resolveBrowEntitlements({
        subscriptions: [{ productId: 'basic-yearly', status, ...period }],
        hasPaidTopup: false,
        now,
      }).queuePriority,
      1
    );
    assert.equal(
      resolveBrowEntitlements({
        subscriptions: [{ productId: 'premium-monthly', status, ...period }],
        hasPaidTopup: false,
        now,
      }).canCompare,
      true
    );
  }
});
test('expired, paused, canceled, unrecognized and future subscriptions cannot unlock Premium', () => {
  for (const item of [
    {
      productId: 'premium-monthly',
      status: 'active',
      ...period,
      currentPeriodEnd: now,
    },
    { productId: 'premium-monthly', status: 'paused', ...period },
    { productId: 'premium-monthly', status: 'canceled', ...period },
    { productId: 'unknown', status: 'active', ...period },
    {
      productId: 'premium-yearly',
      status: 'active',
      ...period,
      currentPeriodStart: new Date('2026-10-01'),
    },
    { productId: 'premium-yearly', status: 'active', currentPeriodEnd: null },
  ])
    assert.equal(
      resolveBrowEntitlements({
        subscriptions: [item],
        hasPaidTopup: false,
        now,
      }).canExport,
      false
    );
});
test('highest active tier wins independently of record order', () => {
  const subscriptions = [
    { productId: 'premium-yearly', status: 'active', ...period },
    { productId: 'basic-monthly', status: 'active', ...period },
  ];
  for (const list of [subscriptions, [...subscriptions].reverse()])
    assert.equal(
      resolveBrowEntitlements({ subscriptions: list, hasPaidTopup: false, now })
        .tier,
      'premium'
    );
});
