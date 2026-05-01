/**
 * Seed 24 brow styles into the brow_style table.
 *
 * Usage: npx tsx scripts/seed-brow-styles.ts
 *
 * Idempotent: uses onConflictDoNothing() so re-running is safe.
 */

import { db } from '@/core/db';
import { browStyle } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

const NEGATIVE =
  'blurry, distorted face, unnatural eyebrows, cartoon, anime, drawing';

const SEED = [
  { slug: 'whisper-taupe', name: 'Whisper Taupe', shade: 'taupe', shape: 'feathered', intensity: 'sheer', trending: true },
  { slug: 'soft-sienna', name: 'Soft Sienna', shade: 'auburn', shape: 'soft', intensity: 'sheer' },
  { slug: 'honey-wisp', name: 'Honey Wisp', shade: 'blonde', shape: 'natural', intensity: 'sheer', popular: true },
  { slug: 'cashmere', name: 'Cashmere', shade: 'taupe', shape: 'natural', intensity: 'medium', popular: true },
  { slug: 'bronde-lift', name: 'Bronde Lift', shade: 'blonde', shape: 'lifted', intensity: 'medium' },
  { slug: 'suede', name: 'Suede', shade: 'chestnut', shape: 'soft', intensity: 'medium', trending: true },
  { slug: 'editorial-brush', name: 'Editorial Brush', shade: 'chestnut', shape: 'feathered', intensity: 'medium' },
  { slug: 'powder-arch', name: 'Powder Arch', shade: 'taupe', shape: 'natural', intensity: 'medium' },
  { slug: 'foxy-lift', name: 'Foxy Lift', shade: 'auburn', shape: 'lifted', intensity: 'medium' },
  { slug: 'mocha-frame', name: 'Mocha Frame', shade: 'chestnut', shape: 'bold', intensity: 'rich', popular: true },
  { slug: 'espresso-bold', name: 'Espresso Bold', shade: 'espresso', shape: 'bold', intensity: 'rich', trending: true },
  { slug: 'onyx-statement', name: 'Onyx Statement', shade: 'soft-black', shape: 'bold', intensity: 'rich' },
  { slug: 'linear-mod', name: 'Linear Mod', shade: 'espresso', shape: 'straight', intensity: 'rich' },
  { slug: 'ginger-feather', name: 'Ginger Feather', shade: 'auburn', shape: 'feathered', intensity: 'medium' },
  { slug: 'champagne', name: 'Champagne', shade: 'blonde', shape: 'soft', intensity: 'sheer' },
  { slug: 'walnut-lamination', name: 'Walnut Lamination', shade: 'chestnut', shape: 'lifted', intensity: 'rich' },
  { slug: 'quiet-luxury', name: 'Quiet Luxury', shade: 'taupe', shape: 'soft', intensity: 'sheer' },
  { slug: 'power-brow', name: 'Power Brow', shade: 'soft-black', shape: 'bold', intensity: 'rich' },
  { slug: 'sunlit', name: 'Sunlit', shade: 'blonde', shape: 'feathered', intensity: 'sheer' },
  { slug: 'coffee-bean', name: 'Coffee Bean', shade: 'espresso', shape: 'natural', intensity: 'medium' },
  { slug: 'architect', name: 'Architect', shade: 'espresso', shape: 'straight', intensity: 'medium' },
  { slug: 'velvet-russet', name: 'Velvet Russet', shade: 'auburn', shape: 'natural', intensity: 'rich' },
  { slug: 'bambi-lifted', name: 'Bambi Lifted', shade: 'chestnut', shape: 'lifted', intensity: 'medium', trending: true },
  { slug: 'inkwell', name: 'Inkwell', shade: 'soft-black', shape: 'feathered', intensity: 'rich' },
] as const;

async function main() {
  console.log('=== Seed Brow Styles ===\n');

  const records = SEED.map((s) => ({
    id: getUuid(),
    slug: s.slug,
    name: s.name,
    shade: s.shade,
    shape: s.shape,
    intensity: s.intensity,
    prompt: `Apply ${s.intensity} ${s.shade} brow tint with ${s.shape} shape. Preserve natural facial features. Photorealistic result.`,
    negative: NEGATIVE,
    credits: 2,
    popular: ('popular' in s && s.popular) ? true : false,
    trending: ('trending' in s && s.trending) ? true : false,
    tier: 'free' as const,
    status: 'active' as const,
  }));

  await db().insert(browStyle).values(records).onConflictDoNothing();

  console.log(`Inserted ${records.length} brow styles (skipped any duplicates).`);
  console.log('\nStyles seeded:');
  for (const r of records) {
    console.log(`  [${r.intensity.padEnd(6)}] ${r.name} (${r.shade} / ${r.shape})`);
  }
  console.log('\n=== Done ===');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error seeding brow styles:', error);
    process.exit(1);
  });
