/**
 * Read-only inspection of brow_style.credits distribution.
 *
 * Usage: npx tsx scripts/inspect-brow-style-credits.ts
 *
 * Does NOT modify the database.
 */

import { db } from '@/core/db';
import { browStyle } from '@/config/db/schema';

async function main() {
  console.log('=== Inspect brow_style.credits ===\n');

  const rows = await db()
    .select({
      slug: browStyle.slug,
      name: browStyle.name,
      intensity: browStyle.intensity,
      credits: browStyle.credits,
      status: browStyle.status,
    })
    .from(browStyle);

  if (rows.length === 0) {
    console.log('No rows in brow_style. Did the seed/migrate script run?');
    return;
  }

  const distribution = rows.reduce<Record<number, number>>((acc, row) => {
    acc[row.credits] = (acc[row.credits] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Total rows: ${rows.length}\n`);
  console.log('Credits distribution:');
  for (const [credits, count] of Object.entries(distribution).sort()) {
    console.log(`  ${credits} credits: ${count} row(s)`);
  }

  const active = rows.filter((r) => r.status === 'active');
  console.log(`\nActive rows: ${active.length} / ${rows.length}`);

  console.log('\nSample rows (first 5):');
  for (const row of rows.slice(0, 5)) {
    console.log(`  [${row.credits}c] ${row.name} (${row.intensity}) - ${row.slug} - ${row.status}`);
  }

  console.log('\n=== Done ===');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Inspection failed:', err);
    process.exit(1);
  });
