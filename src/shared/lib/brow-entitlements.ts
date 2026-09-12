export type BrowTier = 'free' | 'basic' | 'premium';

export interface BrowEntitlements {
  tier: BrowTier;
  canExport: boolean;
  canCompare: boolean;
  queuePriority: 0 | 1 | 2;
}

export const BROW_TOPUP_IDS = [
  'topup-24',
  'topup-60',
  'topup-120',
  'topup-100',
  'topup-200',
  'topup-300',
];

export function resolveBrowEntitlements({
  subscriptions,
  hasPaidTopup,
  now = new Date(),
}: {
  subscriptions: Array<{
    productId: string | null;
    status: string;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
  }>;
  hasPaidTopup: boolean;
  now?: Date;
}): BrowEntitlements {
  let tier: BrowTier = 'free';
  for (const item of subscriptions) {
    if (!['active', 'pending_cancel'].includes(item.status)) continue;
    if (!item.currentPeriodEnd || item.currentPeriodEnd <= now) continue;
    if (item.currentPeriodStart && item.currentPeriodStart > now) continue;
    if (['premium-monthly', 'premium-yearly'].includes(item.productId || '')) {
      tier = 'premium';
      break;
    }
    if (['basic-monthly', 'basic-yearly'].includes(item.productId || ''))
      tier = 'basic';
  }
  return {
    tier,
    canExport: tier !== 'free' || hasPaidTopup,
    canCompare: tier === 'premium',
    queuePriority: tier === 'premium' ? 2 : tier === 'basic' ? 1 : 0,
  };
}
