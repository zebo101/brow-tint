/**
 * Normalize all brow_style.credits values to 2.
 *
 * Usage: npx tsx scripts/normalize-brow-style-credits.ts
 *
 * Idempotent: subsequent runs report 0 rows changed and exit cleanly.
 */

import { ne } from 'drizzle-orm';

import { db } from '@/core/db';
import { browStyle } from '@/config/db/schema';

const TARGET_CREDITS = 2;

type BrowStyleCreditsRow = {
  credits: number;
};

async function main() {
  console.log('=== Normalize brow_style.credits ===\n');

  const beforeRows = (await db()
    .select({ credits: browStyle.credits })
    .from(browStyle)) as BrowStyleCreditsRow[];

  const distribution: Record<number, number> = {};
  for (const row of beforeRows) {
    distribution[row.credits] = (distribution[row.credits] ?? 0) + 1;
  }

  console.log('Before — credits distribution:');
  for (const [credits, count] of Object.entries(distribution)) {
    console.log(`  ${credits} credits: ${count} row(s)`);
  }

  const offTarget = beforeRows.filter((row) => row.credits !== TARGET_CREDITS).length;

  if (offTarget === 0) {
    console.log(`\nAll ${beforeRows.length} row(s) already at ${TARGET_CREDITS} credits. Nothing to do.`);
    return;
  }

  console.log(`\nUpdating ${offTarget} row(s) to ${TARGET_CREDITS} credits...`);

  await db()
    .update(browStyle)
    .set({ credits: TARGET_CREDITS })
    .where(ne(browStyle.credits, TARGET_CREDITS));

  console.log(`\nDone. ${offTarget} row(s) normalized to ${TARGET_CREDITS} credits.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to normalize brow_style.credits:', err);
    process.exit(1);
  });
