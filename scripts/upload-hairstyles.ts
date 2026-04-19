/**
 * Batch Upload Hairstyles Script
 *
 * Usage: pnpm tsx scripts/upload-hairstyles.ts
 *
 * This script:
 * 1. Scans hairstyles_input/{Men,Women,Boys,Girls}/ directories
 * 2. Generates 150x150 thumbnails using Sharp
 * 3. Uses OpenRouter Vision API to generate names and tags
 * 4. Uploads to Cloudflare R2
 * 5. Saves to database
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/libsql';
import sharp from 'sharp';

import { hairstyle } from '../src/config/db/schema.sqlite';

// Load environment variables from .env.development or .env
const envFile = fs.existsSync('.env.development') ? '.env.development' : '.env';
dotenv.config({ path: envFile });
console.log(`Loaded environment from: ${envFile}`);

// Configuration
const INPUT_DIR = process.env.HAIRSTYLE_INPUT_DIR || 'D:\\\\fx\\\\png';
const THUMBNAIL_SIZE = 150;
const CATEGORIES = ['Men', 'Women', 'Boys', 'Girls'];

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
// Extract account ID from R2_ENDPOINT (format: https://<account_id>.r2.cloudflarestorage.com)
const R2_ACCOUNT_ID = R2_ENDPOINT
  ? R2_ENDPOINT.match(/https:\/\/([^.]+)\.r2\.cloudflarestorage\.com/)?.[1]
  : undefined;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
// Use dedicated hairstyles bucket
const R2_HAIRSTYLES_BUCKET = process.env.R2_HAIRSTYLES_BUCKET || 'hairstyles';
const R2_HAIRSTYLES_DOMAIN = process.env.R2_HAIRSTYLES_DOMAIN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Validate environment
function validateEnv() {
  const required = [
    'DATABASE_URL',
    'R2_ENDPOINT',
    'R2_ACCESS_KEY',
    'R2_SECRET_KEY',
    'OPENROUTER_API_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      'Missing required environment variables:',
      missing.join(', ')
    );
    process.exit(1);
  }
}

// Initialize database
function getDb() {
  const { createClient } = require('@libsql/client');
  const client = createClient({
    url: DATABASE_URL!,
    authToken: DATABASE_AUTH_TOKEN,
  });
  return drizzle(client);
}

// Generate UUID
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Upload to R2 using aws4fetch
async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string | null> {
  try {
    const { AwsClient } = await import('aws4fetch');
    const client = new AwsClient({
      accessKeyId: R2_ACCESS_KEY!,
      secretAccessKey: R2_SECRET_KEY!,
      region: 'auto',
    });

    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const url = `${endpoint}/${R2_HAIRSTYLES_BUCKET}/${key}`;

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
      console.error('R2 upload failed:', response.statusText);
      return null;
    }

    // Return public URL
    if (R2_HAIRSTYLES_DOMAIN) {
      return `${R2_HAIRSTYLES_DOMAIN}/${key}`;
    }
    return url;
  } catch (error) {
    console.error('R2 upload error:', error);
    return null;
  }
}

// Analyze hairstyle with AI
interface HairstyleAnalysis {
  name: string;
  tags: string[];
  description: string;
  prompt: string;
}

const VISION_MODEL = 'z-ai/glm-5v-turbo';

const ANALYSIS_INSTRUCTION = `You are analyzing a reference PNG that shows ONLY a hairstyle (hair was manually cut out from a portrait; the background may be transparent, black, or have halos/stray pixels from the cutout). Treat those cutout artifacts as noise and describe ONLY the hairstyle itself.

Return ONLY a JSON object with these four fields:
{
  "name": "Short Textured Fade",
  "tags": ["short", "textured", "fade", "modern", "casual"],
  "description": "One sentence, ~15-25 words, describing the hairstyle in plain English for humans (length, overall shape, vibe).",
  "prompt": "A long-form engineered description optimized to be embedded in an image-generation prompt. Be specific about: approximate hair length (in cm where meaningful), overall silhouette, top texture and styling direction, side/temple/nape behavior (taper, fade, undercut, etc.), parting, fringe/bangs behavior, finish (matte/glossy), color (describe only what you see, do not add colors), and which face shapes the cut typically flatters. Use neutral descriptive language — do NOT reference the image, cutout, or background."
}

Rules:
- "name" is 2-4 words, English, Title Case.
- "tags" are 3-5 short lowercase English keywords.
- "description" is ONE plain-English sentence.
- "prompt" is 2-4 dense sentences of comma-separated descriptive phrases — written as if it were being inserted into an AI image-generation prompt.
- Output JSON ONLY. No markdown, no code fences, no commentary.`;

async function analyzeHairstyle(
  imageBuffer: Buffer
): Promise<HairstyleAnalysis> {
  const fallback: HairstyleAnalysis = {
    name: 'Hairstyle',
    tags: ['hairstyle'],
    description: '',
    prompt: '',
  };

  try {
    const openrouter = createOpenRouter({
      apiKey: OPENROUTER_API_KEY!,
    });

    const model = openrouter.chat(VISION_MODEL);
    const base64 = imageBuffer.toString('base64');

    const result = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_INSTRUCTION },
            {
              type: 'image',
              image: `data:image/png;base64,${base64}`,
            },
          ],
        },
      ],
    });

    const text = result.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        name:
          typeof parsed.name === 'string' && parsed.name
            ? parsed.name
            : fallback.name,
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.filter(
              (t: unknown): t is string => typeof t === 'string'
            )
          : fallback.tags,
        description:
          typeof parsed.description === 'string' ? parsed.description : '',
        prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
  }

  return fallback;
}

// Extract sequence number from filename like "(1).png", "(2).png"
function extractSequence(filename: string): number {
  const match = filename.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Build a set of MD5 hashes for images already present in R2 (from active
// hairstyle rows). R2's ETag for single-part uploads <5GB is the MD5 of the
// body, so we can compare hash-to-ETag directly. This prevents re-uploading
// the same content twice, which was the cause of the earlier dupe cleanup.
async function loadExistingContentHashes(
  db: ReturnType<typeof getDb>
): Promise<Set<string>> {
  const rows = await db.select().from(hairstyle);
  const active = rows.filter(
    (r: { status: string }) => r.status === 'active'
  ) as Array<{ imageUrl: string }>;
  console.log(
    `Pre-check: HEAD-fetching ${active.length} existing images to build content-hash set…`
  );
  const hashes = new Set<string>();
  const concurrency = 8;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= active.length) return;
        try {
          const resp = await fetch(active[i].imageUrl, { method: 'HEAD' });
          const etag = resp.headers.get('etag');
          if (etag) {
            hashes.add(etag.replace(/"/g, '').toLowerCase());
          }
        } catch {
          // Best-effort — a missed entry just means we'll re-upload that one duplicate.
        }
      }
    })
  );
  console.log(`  Loaded ${hashes.size} existing content hashes.`);
  return hashes;
}

function md5(buf: Buffer): string {
  return crypto.createHash('md5').update(buf).digest('hex');
}

// Process a single image
async function processImage(
  db: ReturnType<typeof getDb>,
  filePath: string,
  category: string,
  sequence: number,
  existingHashes: Set<string>
): Promise<boolean | 'skipped'> {
  try {
    console.log(`  Processing: ${path.basename(filePath)}`);

    // Read image
    const imageBuffer = fs.readFileSync(filePath);

    // Content-hash pre-check: skip if the same bytes are already in R2.
    const hash = md5(imageBuffer);
    if (existingHashes.has(hash)) {
      console.log(
        `    ↷ skipped (content hash ${hash.slice(0, 8)}… already present)`
      );
      return 'skipped';
    }

    // Generate thumbnail
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center',
      })
      .png()
      .toBuffer();

    // Upload original
    const originalKey = `hairstyles/${category.toLowerCase()}/${generateUuid()}.png`;
    const originalUrl = await uploadToR2(imageBuffer, originalKey, 'image/png');
    if (!originalUrl) {
      console.error('    Failed to upload original');
      return false;
    }

    // Upload thumbnail
    const thumbnailKey = `hairstyles/${category.toLowerCase()}/thumb_${generateUuid()}.png`;
    const thumbnailUrl = await uploadToR2(
      thumbnailBuffer,
      thumbnailKey,
      'image/png'
    );
    if (!thumbnailUrl) {
      console.error('    Failed to upload thumbnail');
      return false;
    }

    // Analyze with AI
    console.log('    Analyzing with AI...');
    const aiResult = await analyzeHairstyle(imageBuffer);
    console.log(
      `    AI Result: ${aiResult.name} [${aiResult.tags.join(', ')}]`
    );
    if (aiResult.description)
      console.log(`    Description: ${aiResult.description}`);

    // Insert into database
    await db.insert(hairstyle).values({
      id: generateUuid(),
      category: category.toLowerCase(),
      sequence,
      name: aiResult.name,
      tags: JSON.stringify(aiResult.tags),
      description: aiResult.description || null,
      prompt: aiResult.prompt || null,
      imageUrl: originalUrl,
      thumbnailUrl: thumbnailUrl,
      status: 'active',
    });

    console.log(`    ✓ Saved to database`);
    // Remember this hash so subsequent files in the same run also dedupe against it.
    existingHashes.add(hash);
    return true;
  } catch (error) {
    console.error(`    Error processing ${filePath}:`, error);
    return false;
  }
}

// Main function
async function main() {
  console.log('=== Hairstyle Batch Upload Script ===\n');

  validateEnv();

  const db = getDb();
  const existingHashes = await loadExistingContentHashes(db);
  let totalProcessed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const category of CATEGORIES) {
    const categoryDir = path.join(INPUT_DIR, category);

    if (!fs.existsSync(categoryDir)) {
      console.log(`Skipping ${category}: directory not found`);
      continue;
    }

    const files = fs.readdirSync(categoryDir).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
    });

    if (files.length === 0) {
      console.log(`Skipping ${category}: no images found`);
      continue;
    }

    console.log(`\nProcessing ${category} (${files.length} images):`);

    // Sort by sequence number
    files.sort((a, b) => extractSequence(a) - extractSequence(b));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(categoryDir, file);
      const sequence = extractSequence(file) || i + 1;

      const result = await processImage(
        db,
        filePath,
        category,
        sequence,
        existingHashes
      );
      if (result === 'skipped') {
        totalSkipped++;
      } else if (result) {
        totalProcessed++;
      } else {
        totalFailed++;
      }

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n=== Upload Complete ===`);
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Skipped (content dupe): ${totalSkipped}`);
  console.log(`Failed: ${totalFailed}`);
}

main().catch(console.error);
