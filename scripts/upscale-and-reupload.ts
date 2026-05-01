/**
 * Upscale 512×256 eyebrow PNGs to 1024×512, then re-upload to R2
 * replacing the existing blurry originals.
 *
 * Usage: npx tsx scripts/upscale-and-reupload.ts
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';
import sharp from 'sharp';

const envFile = fs.existsSync('.env.development') ? '.env.development' : '.env';
dotenv.config({ path: envFile });
console.log(`Loaded env from: ${envFile}`);

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;

function getDb() {
  const { createClient } = require('@libsql/client');
  const client = createClient({ url: DATABASE_URL!, authToken: DATABASE_AUTH_TOKEN });
  const { drizzle } = require('drizzle-orm/libsql');
  return drizzle(client);
}

import { config } from '../src/config/db/schema.sqlite';

async function getR2Config(db: any) {
  const rows = await db.select().from(config);
  const configs: Record<string, string> = {};
  for (const row of rows) configs[row.name] = row.value ?? '';
  return {
    accessKey: configs.r2_access_key,
    secretKey: configs.r2_secret_key,
    endpoint: configs.r2_endpoint,
    bucketName: 'browtint',
    domain: configs.r2_domain,
  };
}

async function uploadToR2(
  r2Config: Awaited<ReturnType<typeof getR2Config>>,
  buffer: Buffer,
  key: string,
): Promise<boolean> {
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
        'Content-Type': 'image/png',
        'Content-Length': buffer.length.toString(),
      },
      body: new Uint8Array(buffer),
    })
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`  R2 upload failed [${response.status}]: ${text}`);
    return false;
  }
  return true;
}

async function main() {
  console.log('=== Upscale & Re-upload Blurry Eyebrows ===\n');

  if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

  const db = getDb();
  const r2Config = await getR2Config(db);
  if (!r2Config.accessKey) { console.error('R2 credentials missing'); process.exit(1); }
  console.log(`Bucket: ${r2Config.bucketName}, Domain: ${r2Config.domain}\n`);

  // Get all brow_style thumbnail URLs to find the R2 keys
  const { createClient } = require('@libsql/client');
  const client = createClient({ url: DATABASE_URL!, authToken: DATABASE_AUTH_TOKEN });

  const result = await client.execute(
    'SELECT id, thumbnail FROM brow_style WHERE thumbnail IS NOT NULL'
  );

  const domain = (r2Config.domain || '').replace(/\/$/, '');

  // Map: R2 key -> style row
  const styles = result.rows.map((r: any) => {
    const url: string = r.thumbnail;
    // Extract the R2 key from the URL (remove domain prefix)
    const key = url.replace(domain + '/', '');
    return { id: r.id, url, key };
  });

  console.log(`Found ${styles.length} styles with thumbnails.\n`);

  // Read original files to build a mapping: filename -> local path
  const INPUT_DIR = String.raw`C:\Users\陈序谦\Desktop\eyebrow\png`;
  const localFiles = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.png')).sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

  // The upload order matches: file index i -> style index i
  // (upload-brow-tints.ts uploaded in sorted order, migration script read in sequence order)
  let upscaled = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < Math.min(localFiles.length, styles.length); i++) {
    const localPath = `${INPUT_DIR}\\${localFiles[i]}`;
    const style = styles[i];

    const meta = await sharp(localPath).metadata();
    if (meta.width! >= 1024) {
      skipped++;
      continue;
    }

    // Upscale 512×256 -> 1024×512 using lanczos3
    try {
      const upscaledBuffer = await sharp(localPath)
        .resize(1024, 512, { kernel: 'lanczos3' })
        .png({ quality: 100 })
        .toBuffer();

      const ok = await uploadToR2(r2Config, upscaledBuffer, style.key);
      if (ok) {
        upscaled++;
        process.stdout.write(`  [${upscaled}] ${localFiles[i]} (${meta.width}x${meta.height} -> 1024x512) ✓\n`);
      } else {
        failed++;
      }
    } catch (err: any) {
      console.error(`  [FAIL] ${localFiles[i]}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Done: ${upscaled} upscaled & re-uploaded, ${skipped} already HD, ${failed} failed ===`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Error:', err); process.exit(1); });
