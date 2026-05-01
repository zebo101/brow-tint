/**
 * Upload brow tint images to Cloudflare R2 and insert into database.
 *
 * Usage: npx tsx scripts/upload-brow-tints.ts
 *
 * Reads R2 credentials from the Turso config table (same as admin panel).
 * Splits images evenly into 4 categories (men/women/boys/girls).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/libsql';
import sharp from 'sharp';

import { browTint } from '../src/config/db/schema.sqlite';
import { config } from '../src/config/db/schema.sqlite';

// Load env
const envFile = fs.existsSync('.env.development')
  ? '.env.development'
  : '.env';
dotenv.config({ path: envFile });
console.log(`Loaded env from: ${envFile}`);

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;
const INPUT_DIR = String.raw`C:\Users\陈序谦\Desktop\eyebrow\png`;
const THUMBNAIL_SIZE = 150;
// Single category — no split
const CATEGORY = 'women';

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

async function getR2Config(db: any) {
  const rows = await db.select().from(config);
  const configs: Record<string, string> = {};
  for (const row of rows) {
    configs[row.name] = row.value ?? '';
  }
  return {
    accessKey: configs.r2_access_key,
    secretKey: configs.r2_secret_key,
    endpoint: configs.r2_endpoint,
    // DB may store display name "Brow Tint" but actual R2 bucket is "browtint"
    bucketName: 'browtint',
    domain: configs.r2_domain,
  };
}

async function uploadToR2(
  r2Config: Awaited<ReturnType<typeof getR2Config>>,
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string | null> {
  const { AwsClient } = await import('aws4fetch');
  const client = new AwsClient({
    accessKeyId: r2Config.accessKey,
    secretAccessKey: r2Config.secretKey,
    region: 'auto',
  });

  const url = `${r2Config.endpoint}/${r2Config.bucketName}/${key}`;
  const response = await client.fetch(
    new Request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
      },
      body: new Uint8Array(buffer),
    })
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`  R2 upload failed [${response.status}]: ${text}`);
    return null;
  }

  if (r2Config.domain) {
    // domain already includes https://, key is the path
    const domain = r2Config.domain.replace(/\/$/, '');
    return `${domain}/${key}`;
  }
  return url;
}

async function main() {
  console.log('=== Brow Tint Upload ===\n');

  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const db = getDb();

  // Read R2 config from database (same credentials as admin panel)
  console.log('Reading R2 config from database...');
  const r2Config = await getR2Config(db);
  if (!r2Config.accessKey || !r2Config.secretKey) {
    console.error('R2 credentials not found in database. Configure them in admin Settings > Storage.');
    process.exit(1);
  }
  console.log(`  Bucket : ${r2Config.bucketName}`);
  console.log(`  Domain : ${r2Config.domain}`);
  console.log(`  Endpoint: ${r2Config.endpoint}\n`);

  // Scan input directory
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

  console.log(`Found ${files.length} PNG files in ${INPUT_DIR}\n`);

  if (files.length === 0) {
    console.log('No files to upload.');
    return;
  }

  // All files go into one category
  let successCount = 0;
  let failCount = 0;

  console.log(`--- ${CATEGORY} (${files.length} files) ---`);

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const filePath = path.join(INPUT_DIR, fileName);
    const sequence = i + 1;
    const num = fileName.replace('.png', '').replace('ebrow', '');
    const category = CATEGORY;

      try {
        const buffer = fs.readFileSync(filePath);

        // Generate thumbnail
        const thumbBuffer = await sharp(buffer)
          .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
            fit: 'cover',
            position: 'center',
          })
          .png()
          .toBuffer();

        // Upload original
        const uuid = generateUuid();
        const originalKey = `brow-tints/${category}/${uuid}.png`;
        const originalUrl = await uploadToR2(
          r2Config,
          buffer,
          originalKey,
          'image/png'
        );
        if (!originalUrl) {
          failCount++;
          continue;
        }

        // Upload thumbnail
        const thumbKey = `brow-tints/${category}/thumb_${uuid}.png`;
        const thumbUrl = await uploadToR2(
          r2Config,
          thumbBuffer,
          thumbKey,
          'image/png'
        );
        if (!thumbUrl) {
          failCount++;
          continue;
        }

        // Insert into DB
        const name = `Brow Tint #${num}`;
        await db.insert(browTint).values({
          id: generateUuid(),
          category,
          sequence,
          name,
          tags: JSON.stringify(['brow tint']),
          description: null,
          prompt: null,
          imageUrl: originalUrl,
          thumbnailUrl: thumbUrl,
          status: 'active',
        });

        successCount++;
        process.stdout.write(`  [${successCount}] ${fileName} → ${category}/${sequence}\n`);
      } catch (error: any) {
        console.error(`  [FAIL] ${fileName}: ${error.message}`);
        failCount++;
      }
  }

  console.log(`\n=== Done: ${successCount} uploaded, ${failCount} failed ===`);
}

main().catch(console.error);
