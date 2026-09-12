import { and, eq, gt, inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { order, subscription } from '@/config/db/schema';
import {
  BROW_TOPUP_IDS,
  resolveBrowEntitlements,
} from '@/shared/lib/brow-entitlements';

export type { BrowEntitlements } from '@/shared/lib/brow-entitlements';

export async function getBrowEntitlements(userId: string) {
  const now = new Date();
  const [subscriptions, topups] = await Promise.all([
    db()
      .select({
        productId: subscription.productId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      })
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, userId),
          inArray(subscription.status, ['active', 'pending_cancel']),
          gt(subscription.currentPeriodEnd, now)
        )
      ),
    db()
      .select({ id: order.id })
      .from(order)
      .where(
        and(
          eq(order.userId, userId),
          eq(order.status, 'paid'),
          eq(order.paymentType, 'one-time'),
          inArray(order.productId, BROW_TOPUP_IDS),
          gt(order.amount, 0)
        )
      )
      .limit(1),
  ]);
  return resolveBrowEntitlements({
    subscriptions,
    hasPaidTopup: topups.length > 0,
    now,
  });
}
