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

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.development or .env
const envFile = fs.existsSync('.env.development') ? '.env.development' : '.env';
dotenv.config({ path: envFile });
console.log(`Loaded environment from: ${envFile}`);

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { drizzle } from 'drizzle-orm/libsql';
import sharp from 'sharp';

import { hairstyle } from '../src/config/db/schema.sqlite';

// Configuration
const INPUT_DIR = process.env.HAIRSTYLE_INPUT_DIR || 'D:\\\\fx\\\\png';
const THUMBNAIL_SIZE = 150;
const CATEGORIES = ['Men', 'Women', 'Boys', 'Girls'];

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
// Extract account ID from R2_ENDPOINT (format: https://<account_id>.r2.cloudflarestorage.com)
const R2_ACCOUNT_ID = R2_ENDPOINT ? R2_ENDPOINT.match(/https:\/\/([^.]+)\.r2\.cloudflarestorage\.com/)?.[1] : undefined;
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
    console.error('Missing required environment variables:', missing.join(', '));
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
async function analyzeHairstyle(
  imageBuffer: Buffer
): Promise<{ name: string; tags: string[] }> {
  try {
    const openrouter = createOpenRouter({
      apiKey: OPENROUTER_API_KEY!,
    });

    const model = openrouter.chat('google/gemini-3-flash-preview');
    const base64 = imageBuffer.toString('base64');

    const prompt = `Analyze this hairstyle image and provide:
1. A short, descriptive name for this hairstyle (2-4 words, in English)
2. 3-5 relevant tags describing the style characteristics

Respond in JSON format only:
{
  "name": "Short Textured Fade",
  "tags": ["short", "textured", "fade", "modern", "casual"]
}`;

    const result = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
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
        name: parsed.name || 'Hairstyle',
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['hairstyle'],
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
  }

  return { name: 'Hairstyle', tags: ['hairstyle'] };
}

// Extract sequence number from filename like "(1).png", "(2).png"
function extractSequence(filename: string): number {
  const match = filename.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Process a single image
async function processImage(
  db: ReturnType<typeof getDb>,
  filePath: string,
  category: string,
  sequence: number
): Promise<boolean> {
  try {
    console.log(`  Processing: ${path.basename(filePath)}`);

    // Read image
    const imageBuffer = fs.readFileSync(filePath);

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
    const thumbnailUrl = await uploadToR2(thumbnailBuffer, thumbnailKey, 'image/png');
    if (!thumbnailUrl) {
      console.error('    Failed to upload thumbnail');
      return false;
    }

    // Analyze with AI
    console.log('    Analyzing with AI...');
    const aiResult = await analyzeHairstyle(imageBuffer);
    console.log(`    AI Result: ${aiResult.name} [${aiResult.tags.join(', ')}]`);

    // Insert into database
    await db.insert(hairstyle).values({
      id: generateUuid(),
      category: category.toLowerCase(),
      sequence,
      name: aiResult.name,
      tags: JSON.stringify(aiResult.tags),
      imageUrl: originalUrl,
      thumbnailUrl: thumbnailUrl,
      status: 'active',
    });

    console.log(`    ✓ Saved to database`);
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
  let totalProcessed = 0;
  let totalFailed = 0;

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

      const success = await processImage(db, filePath, category, sequence);
      if (success) {
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
  console.log(`Failed: ${totalFailed}`);
}

main().catch(console.error);
