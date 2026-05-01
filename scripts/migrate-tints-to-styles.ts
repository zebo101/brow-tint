/**
 * Migrate brow_tint images → brow_style entries.
 *
 * Reads all active rows from the old `brow_tint` table (191 uploaded images)
 * and creates corresponding `brow_style` rows with shade/shape/intensity
 * classification, mapping the R2 image URL to the `thumbnail` field.
 *
 * Usage: npx tsx scripts/migrate-tints-to-styles.ts
 *
 * Idempotent: uses onConflictDoNothing() on the slug field.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

// Load env
const envFile = fs.existsSync('.env.development')
  ? '.env.development'
  : '.env';
dotenv.config({ path: envFile });
console.log(`Loaded env from: ${envFile}`);

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;

// Import schema tables directly (avoid alias issues in scripts)
import { browTint, browStyle } from '../src/config/db/schema.sqlite';

function getDb() {
  const { createClient } = require('@libsql/client');
  const client = createClient({
    url: DATABASE_URL!,
    authToken: DATABASE_AUTH_TOKEN,
  });
  return drizzle(client);
}

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Classification pools
const SHADES = ['taupe', 'blonde', 'auburn', 'chestnut', 'espresso', 'soft-black'] as const;
const SHAPES = ['natural', 'soft', 'feathered', 'lifted', 'straight', 'bold'] as const;
const INTENSITIES = ['sheer', 'medium', 'rich'] as const;

// Build all combinations for round-robin distribution
const COMBOS: { shade: string; shape: string; intensity: string }[] = [];
for (const shade of SHADES) {
  for (const shape of SHAPES) {
    for (const intensity of INTENSITIES) {
      COMBOS.push({ shade, shape, intensity });
    }
  }
}
// 6 × 6 × 3 = 108 combinations

// Friendly name fragments for generating style names
const SHADE_NAMES: Record<string, string[]> = {
  taupe: ['Taupe', 'Ash', 'Mist', 'Dove'],
  blonde: ['Blonde', 'Honey', 'Wheat', 'Sun'],
  auburn: ['Auburn', 'Copper', 'Sienna', 'Russet'],
  chestnut: ['Chestnut', 'Mocha', 'Cocoa', 'Walnut'],
  espresso: ['Espresso', 'Coffee', 'Dark Roast', 'Java'],
  'soft-black': ['Onyx', 'Ink', 'Charcoal', 'Noir'],
};

const SHAPE_NAMES: Record<string, string[]> = {
  natural: ['Natural', 'Classic', 'Everyday', 'Easy'],
  soft: ['Soft', 'Gentle', 'Subtle', 'Smooth'],
  feathered: ['Feather', 'Wisp', 'Brushed', 'Airy'],
  lifted: ['Lift', 'Fox', 'Arch', 'Wing'],
  straight: ['Linear', 'Sleek', 'Mod', 'Clean'],
  bold: ['Bold', 'Power', 'Statement', 'Drama'],
};

function generateStyleName(shade: string, shape: string, index: number): string {
  const shadeNames = SHADE_NAMES[shade] || [shade];
  const shapeNames = SHAPE_NAMES[shape] || [shape];
  const sn = shadeNames[index % shadeNames.length];
  const sp = shapeNames[index % shapeNames.length];
  return `${sn} ${sp}`;
}

function slugify(name: string, id: number): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + `-${id}`;
}

const NEGATIVE = 'blurry, distorted face, unnatural eyebrows, cartoon, anime, drawing';

async function main() {
  console.log('=== Migrate brow_tint → brow_style ===\n');

  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const db = getDb();

  // Read all active brow_tint records
  const tints = await db
    .select()
    .from(browTint)
    .where(eq(browTint.status, 'active'))
    .orderBy(asc(browTint.sequence));

  console.log(`Found ${tints.length} active brow_tint records.\n`);

  if (tints.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  // Track how many images assigned to each combo for unique naming
  const comboCount: Record<string, number> = {};

  const records = tints.map((tint: any, i: number) => {
    const combo = COMBOS[i % COMBOS.length];
    const comboKey = `${combo.shade}-${combo.shape}-${combo.intensity}`;
    comboCount[comboKey] = (comboCount[comboKey] || 0) + 1;
    const nameIndex = comboCount[comboKey] - 1;

    const name = generateStyleName(combo.shade, combo.shape, nameIndex);
    const slug = slugify(name, i + 1);

    return {
      id: generateUuid(),
      slug,
      name: comboCount[comboKey] > 1 ? `${name} ${comboCount[comboKey]}` : name,
      shade: combo.shade,
      shape: combo.shape,
      intensity: combo.intensity,
      thumbnail: tint.thumbnailUrl || tint.imageUrl,
      prompt: `Apply ${combo.intensity} ${combo.shade} brow tint with ${combo.shape} shape. Preserve natural facial features. Photorealistic result.`,
      negative: NEGATIVE,
      credits: 2,
      popular: false,
      trending: false,
      tier: 'free' as const,
      status: 'active' as const,
    };
  });

  // Insert in batches of 50
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    await db.insert(browStyle).values(batch).onConflictDoNothing();
    inserted += batch.length;
    console.log(`  Inserted batch ${Math.ceil((i + 1) / BATCH)} (${inserted}/${records.length})`);
  }

  // Summary
  const shadeDist: Record<string, number> = {};
  const shapeDist: Record<string, number> = {};
  const intensityDist: Record<string, number> = {};
  for (const r of records) {
    shadeDist[r.shade] = (shadeDist[r.shade] || 0) + 1;
    shapeDist[r.shape] = (shapeDist[r.shape] || 0) + 1;
    intensityDist[r.intensity] = (intensityDist[r.intensity] || 0) + 1;
  }

  console.log('\n--- Distribution ---');
  console.log('Shades:', shadeDist);
  console.log('Shapes:', shapeDist);
  console.log('Intensities:', intensityDist);
  console.log(`\n=== Done: ${records.length} styles created from brow_tint images ===`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error migrating:', error);
    process.exit(1);
  });
