import 'server-only';

import { desc, eq } from 'drizzle-orm';

import { browStyle } from '@/config/db/schema';
import { db } from '@/core/db';

import type { BrowStyleItem } from './types';

/**
 * Server-side loader for the BrowTintStudio's style picker. Used on both the
 * homepage and the legacy inner page so the studio can render the same set
 * of options regardless of where it's mounted.
 */
export async function getActiveBrowStyles(): Promise<BrowStyleItem[]> {
  try {
    const rows = await db()
      .select({
        id: browStyle.id,
        slug: browStyle.slug,
        name: browStyle.name,
        shade: browStyle.shade,
        shape: browStyle.shape,
        intensity: browStyle.intensity,
        thumbnail: browStyle.thumbnail,
        prompt: browStyle.prompt,
        negative: browStyle.negative,
        popular: browStyle.popular,
        trending: browStyle.trending,
        tier: browStyle.tier,
        credits: browStyle.credits,
      })
      .from(browStyle)
      .where(eq(browStyle.status, 'active'))
      .orderBy(desc(browStyle.popular));

    return rows.map((r: any) => ({
      ...r,
      popular: !!r.popular,
      trending: !!r.trending,
    }));
  } catch (err) {
    console.error('Failed to fetch brow styles:', err);
    return [];
  }
}
