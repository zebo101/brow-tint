/**
 * Update Hairstyle URLs Script
 * 
 * Updates all hairstyle image URLs in database to use the public R2 domain
 * 
 * Usage: pnpm tsx scripts/update-hairstyle-urls.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables
const envFile = fs.existsSync('.env.development') ? '.env.development' : '.env';
dotenv.config({ path: envFile });

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;

// Old internal R2 URL pattern
const OLD_BASE_URL = 'https://34011fe3b0053446a4427aa4c6db2804.r2.cloudflarestorage.com/hairstyles';

// New public R2 URL
const NEW_BASE_URL = 'https://pub-6585cd1b94c64eda8c0f093d2f9c7c5f.r2.dev';

async function main() {
  console.log('=== Update Hairstyle URLs ===\n');

  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = createClient({
    url: DATABASE_URL,
    authToken: DATABASE_AUTH_TOKEN,
  });

  const db = drizzle(client);

  console.log(`Replacing: ${OLD_BASE_URL}`);
  console.log(`With: ${NEW_BASE_URL}\n`);

  // Check sample URLs first
  const sample = await db.run(sql`SELECT image_url, thumbnail_url FROM hairstyle LIMIT 1`);
  console.log('Sample current URL:', JSON.stringify(sample.rows[0], null, 2));
  console.log();

  // Update imageUrl
  const result1 = await db.run(sql`
    UPDATE hairstyle 
    SET image_url = REPLACE(image_url, ${OLD_BASE_URL}, ${NEW_BASE_URL})
    WHERE image_url LIKE ${OLD_BASE_URL + '%'}
  `);
  console.log(`Updated imageUrl: ${result1.rowsAffected} rows`);

  // Update thumbnailUrl
  const result2 = await db.run(sql`
    UPDATE hairstyle 
    SET thumbnail_url = REPLACE(thumbnail_url, ${OLD_BASE_URL}, ${NEW_BASE_URL})
    WHERE thumbnail_url LIKE ${OLD_BASE_URL + '%'}
  `);
  console.log(`Updated thumbnailUrl: ${result2.rowsAffected} rows`);

  console.log('\n=== Done ===');
}

main().catch(console.error);
