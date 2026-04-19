/**
 * Backfill script: re-analyze existing hairstyles to populate `description` and
 * `prompt` columns using the z-ai/glm-5v-turbo vision model.
 *
 * Usage:
 *   npx tsx scripts/reanalyze-hairstyles.ts                 # all active rows missing description
 *   npx tsx scripts/reanalyze-hairstyles.ts --limit 5       # only process 5 rows (dry-run pattern)
 *   npx tsx scripts/reanalyze-hairstyles.ts --force         # re-process all rows, even already-filled
 *   npx tsx scripts/reanalyze-hairstyles.ts --category men  # restrict to one category
 *
 * Environment: requires DATABASE_URL, DATABASE_AUTH_TOKEN, OPENROUTER_API_KEY.
 */

import * as fs from 'fs';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

import { hairstyle } from '../src/config/db/schema.sqlite';

const envFile = fs.existsSync('.env.development') ? '.env.development' : '.env';
dotenv.config({ path: envFile });
console.log(`Loaded environment from: ${envFile}`);

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

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

interface HairstyleAnalysis {
  name: string;
  tags: string[];
  description: string;
  prompt: string;
}

interface Args {
  limit?: number;
  force: boolean;
  category?: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force') {
      args.force = true;
    } else if (arg === '--limit') {
      args.limit = parseInt(argv[++i] ?? '0', 10) || undefined;
    } else if (arg === '--category') {
      args.category = argv[++i];
    }
  }
  return args;
}

function validateEnv() {
  const missing = ['DATABASE_URL', 'OPENROUTER_API_KEY'].filter(
    (k) => !process.env[k]
  );
  if (missing.length > 0) {
    console.error(
      'Missing required environment variables:',
      missing.join(', ')
    );
    process.exit(1);
  }
}

function getDb() {
  const { createClient } = require('@libsql/client');
  const client = createClient({
    url: DATABASE_URL!,
    authToken: DATABASE_AUTH_TOKEN,
  });
  return drizzle(client);
}

async function analyze(imageUrl: string): Promise<{
  result: HairstyleAnalysis;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}> {
  const fallback: HairstyleAnalysis = {
    name: 'Hairstyle',
    tags: ['hairstyle'],
    description: '',
    prompt: '',
  };

  const openrouter = createOpenRouter({ apiKey: OPENROUTER_API_KEY! });
  const model = openrouter.chat(VISION_MODEL);

  const result = await generateText({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: ANALYSIS_INSTRUCTION },
          { type: 'image', image: imageUrl },
        ],
      },
    ],
  });

  const text = result.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn(
      '  ! failed to parse JSON, using fallback. Raw:',
      text.slice(0, 200)
    );
    return { result: fallback, usage: result.usage as any };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      result: {
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
      },
      usage: result.usage as any,
    };
  } catch (e) {
    console.warn('  ! failed to JSON.parse, using fallback:', e);
    return { result: fallback, usage: result.usage as any };
  }
}

async function main() {
  console.log('=== Hairstyle Re-analysis Script ===\n');
  const args = parseArgs();
  console.log('Args:', args);

  validateEnv();
  const db = getDb();

  // Pull candidate rows. We do category filtering and the force-vs-backfill
  // decision in-memory since the set is small (~200) and it keeps the query simple.
  const rows = (await db.select().from(hairstyle)) as Array<{
    id: string;
    category: string;
    sequence: number;
    name: string;
    description: string | null;
    prompt: string | null;
    imageUrl: string;
    status: string;
  }>;

  const candidates = rows.filter((r) => {
    if (r.status !== 'active') return false;
    if (args.category && r.category !== args.category) return false;
    if (!args.force && r.description && r.prompt) return false;
    return true;
  });

  const todo = args.limit ? candidates.slice(0, args.limit) : candidates;

  console.log(
    `Found ${rows.length} total rows, ${candidates.length} candidates, processing ${todo.length}.\n`
  );

  let processed = 0;
  let failed = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (const row of todo) {
    const label = `${row.category}/${row.sequence} "${row.name}"`;
    console.log(`[${processed + failed + 1}/${todo.length}] ${label}`);
    console.log(`  url: ${row.imageUrl}`);

    try {
      const { result, usage } = await analyze(row.imageUrl);
      if (usage) {
        totalPromptTokens += usage.promptTokens ?? 0;
        totalCompletionTokens += usage.completionTokens ?? 0;
        console.log(
          `  tokens: prompt=${usage.promptTokens ?? '?'} completion=${usage.completionTokens ?? '?'} total=${usage.totalTokens ?? '?'}`
        );
      }
      console.log(`  description: ${result.description}`);
      console.log(
        `  prompt: ${result.prompt.slice(0, 120)}${result.prompt.length > 120 ? '…' : ''}`
      );

      await db
        .update(hairstyle)
        .set({
          description: result.description || null,
          prompt: result.prompt || null,
        })
        .where(eq(hairstyle.id, row.id));

      processed++;
    } catch (e) {
      console.error('  ✗ failed:', e);
      failed++;
    }

    // Light rate-limiting / politeness delay.
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\n=== Done ===');
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(
    `Token totals (for cost estimation): prompt=${totalPromptTokens}, completion=${totalCompletionTokens}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
