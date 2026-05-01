/**
 * Deduplicate the brow tint library.
 *
 * Runs in three phases:
 *  1. Collect ETag + Content-Length for every active row's image (via R2 HEAD).
 *     Caches to scripts/.brow-tint-etag-cache.json so re-runs are cheap.
 *  2. Content dedupe: for each ETag group with >1 member, keep the row with
 *     the earliest `createdAt` as canonical; mark the rest `status='inactive'`.
 *     If the canonical row has NULL description/prompt but a duplicate has
 *     them filled (from the earlier backfill), copy those fields up first.
 *  3. Sequence renumber: within each category, reassign sequence = 1..N for
 *     remaining active rows, ordered by (sequence ASC, createdAt ASC).
 *
 * Usage:
 *   npx tsx scripts/dedupe-hairstyles.ts                   # dry-run (phase 1 only)
 *   npx tsx scripts/dedupe-hairstyles.ts --apply           # dry-run + phase 2 + phase 3
 *   npx tsx scripts/dedupe-hairstyles.ts --refresh-etags   # ignore cache, re-HEAD everything
 *
 * Environment: DATABASE_URL, DATABASE_AUTH_TOKEN.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient, type Client } from '@libsql/client';
import * as dotenv from 'dotenv';

const envFile = fs.existsSync('.env.development') ? '.env.development' : '.env';
dotenv.config({ path: envFile });
console.log(`Loaded environment from: ${envFile}`);

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;
const CACHE_PATH = path.join('scripts', '.brow-tint-etag-cache.json');
const HEAD_CONCURRENCY = 8;

interface Args {
  apply: boolean;
  refreshEtags: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  return {
    apply: argv.includes('--apply'),
    refreshEtags: argv.includes('--refresh-etags'),
  };
}

interface DbRow {
  id: string;
  category: string;
  sequence: number;
  name: string;
  description: string | null;
  prompt: string | null;
  imageUrl: string;
  status: string;
  createdAt: number;
}

interface EtagEntry {
  id: string;
  imageUrl: string;
  etag: string | null;
  contentLength: number | null;
  ok: boolean;
  status: number;
}

function getDb(): Client {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  return createClient({
    url: DATABASE_URL,
    authToken: DATABASE_AUTH_TOKEN,
  });
}

async function fetchActiveRows(db: Client): Promise<DbRow[]> {
  const result = await db.execute(
    "SELECT id, category, sequence, name, description, prompt, image_url, status, created_at FROM brow_tint WHERE status = 'active' ORDER BY category, sequence, created_at"
  );
  return result.rows.map((r) => ({
    id: r.id as string,
    category: r.category as string,
    sequence: Number(r.sequence),
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    prompt: (r.prompt as string | null) ?? null,
    imageUrl: r.image_url as string,
    status: r.status as string,
    createdAt: Number(r.created_at),
  }));
}

async function headOne(url: string): Promise<{
  etag: string | null;
  contentLength: number | null;
  ok: boolean;
  status: number;
}> {
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    return {
      etag: resp.headers.get('etag'),
      contentLength: (() => {
        const v = resp.headers.get('content-length');
        return v ? Number(v) : null;
      })(),
      ok: resp.ok,
      status: resp.status,
    };
  } catch (e) {
    return { etag: null, contentLength: null, ok: false, status: 0 };
  }
}

async function collectEtags(
  rows: DbRow[],
  useCache: boolean
): Promise<EtagEntry[]> {
  if (useCache && fs.existsSync(CACHE_PATH)) {
    console.log(`Loading ETag cache from ${CACHE_PATH}`);
    const cached: EtagEntry[] = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const cacheById = new Map(cached.map((e) => [e.id, e]));
    const missing = rows.filter((r) => !cacheById.has(r.id));
    if (missing.length === 0) {
      console.log(`Cache covers all ${rows.length} rows, skipping HEAD storm`);
      return rows.map((r) => cacheById.get(r.id)!);
    }
    console.log(
      `Cache missing ${missing.length} rows, HEAD-fetching just those`
    );
    const patched = await headMany(missing);
    for (const p of patched) cacheById.set(p.id, p);
    const merged = rows.map((r) => cacheById.get(r.id)!);
    fs.writeFileSync(CACHE_PATH, JSON.stringify(merged, null, 2));
    return merged;
  }

  console.log(
    `HEAD-fetching ${rows.length} images with ${HEAD_CONCURRENCY} concurrency…`
  );
  const entries = await headMany(rows);
  fs.writeFileSync(CACHE_PATH, JSON.stringify(entries, null, 2));
  console.log(`Wrote ETag cache to ${CACHE_PATH}`);
  return entries;
}

async function headMany(rows: DbRow[]): Promise<EtagEntry[]> {
  const out: EtagEntry[] = new Array(rows.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= rows.length) return;
      const r = rows[i];
      const h = await headOne(r.imageUrl);
      out[i] = {
        id: r.id,
        imageUrl: r.imageUrl,
        etag: h.etag,
        contentLength: h.contentLength,
        ok: h.ok,
        status: h.status,
      };
      done++;
      if (done % 25 === 0 || done === rows.length) {
        process.stdout.write(`  ${done}/${rows.length}\r`);
      }
    }
  }

  await Promise.all(Array.from({ length: HEAD_CONCURRENCY }, () => worker()));
  process.stdout.write('\n');
  return out;
}

function groupByEtag(rows: DbRow[], etags: EtagEntry[]): Map<string, DbRow[]> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const etagById = new Map(etags.map((e) => [e.id, e]));
  const groups = new Map<string, DbRow[]>();

  for (const r of rows) {
    const e = etagById.get(r.id);
    if (!e || !e.etag) continue; // skip rows we couldn't probe
    // Include contentLength in the key — R2 ETag is MD5, but belt-and-braces
    // against a theoretical collision:
    const key = `${e.etag}::${e.contentLength}`;
    const arr = groups.get(key) ?? [];
    arr.push(byId.get(r.id)!);
    groups.set(key, arr);
  }

  return groups;
}

function summarizePhase1(rows: DbRow[], etags: EtagEntry[]) {
  const probeFailed = etags.filter((e) => !e.ok);
  const groups = groupByEtag(rows, etags);
  const dupeGroups = [...groups.entries()].filter(([, v]) => v.length > 1);
  const dupeRowCount = dupeGroups.reduce((n, [, v]) => n + v.length, 0);
  const wouldDeactivate = dupeRowCount - dupeGroups.length;

  console.log('\n=== Phase 1 summary ===');
  console.log(`Active rows:             ${rows.length}`);
  console.log(`Probe failures (HEAD):   ${probeFailed.length}`);
  console.log(`Unique ETag groups:      ${groups.size}`);
  console.log(`Groups with duplicates:  ${dupeGroups.length}`);
  console.log(`Rows in dupe groups:     ${dupeRowCount}`);
  console.log(
    `Would deactivate:        ${wouldDeactivate}  (expected active after: ${rows.length - wouldDeactivate - probeFailed.length})`
  );

  if (probeFailed.length > 0) {
    console.log('\nProbe failures (first 10):');
    for (const p of probeFailed.slice(0, 10)) {
      console.log(`  id=${p.id} status=${p.status} url=${p.imageUrl}`);
    }
  }

  console.log('\nSample dupe groups (first 5):');
  for (const [key, members] of dupeGroups.slice(0, 5)) {
    console.log(`  [${members.length}×] key=${key}`);
    for (const m of members) {
      console.log(
        `    ${m.category}/seq=${m.sequence}  id=${m.id}  name="${m.name}"  created=${new Date(m.createdAt).toISOString()}  desc=${m.description ? 'Y' : '-'}  prompt=${m.prompt ? 'Y' : '-'}`
      );
    }
  }

  // Cross-category occurrences: if the same PNG is in both 'men' and 'women' etc.
  const crossCategory = dupeGroups.filter(([, v]) => {
    const cats = new Set(v.map((m) => m.category));
    return cats.size > 1;
  });
  if (crossCategory.length > 0) {
    console.log(
      `\n⚠ ${crossCategory.length} dupe groups span multiple categories (unusual):`
    );
    for (const [key, members] of crossCategory.slice(0, 5)) {
      console.log(
        `  key=${key} categories=${[...new Set(members.map((m) => m.category))].join(',')} ids=${members.map((m) => m.id).join(',')}`
      );
    }
  }

  return { groups, dupeGroups };
}

function pickCanonical(group: DbRow[]): {
  canonical: DbRow;
  toDeactivate: DbRow[];
  descToCopy: string | null;
  promptToCopy: string | null;
} {
  // Earliest createdAt wins.
  const sorted = [...group].sort((a, b) => a.createdAt - b.createdAt);
  const canonical = sorted[0];
  const rest = sorted.slice(1);

  // If canonical is missing description/prompt but a duplicate has them, copy up.
  let descToCopy: string | null = null;
  let promptToCopy: string | null = null;
  if (!canonical.description || !canonical.prompt) {
    for (const d of rest) {
      if (!descToCopy && d.description) descToCopy = d.description;
      if (!promptToCopy && d.prompt) promptToCopy = d.prompt;
      if (descToCopy && promptToCopy) break;
    }
  }

  return { canonical, toDeactivate: rest, descToCopy, promptToCopy };
}

async function applyPhase2(
  db: Client,
  dupeGroups: [string, DbRow[]][]
): Promise<number> {
  const statements: { sql: string; args: any[] }[] = [];
  let deactivateCount = 0;
  let copyCount = 0;

  for (const [, members] of dupeGroups) {
    const { canonical, toDeactivate, descToCopy, promptToCopy } =
      pickCanonical(members);

    if (descToCopy || promptToCopy) {
      const setParts: string[] = [];
      const args: any[] = [];
      if (descToCopy && !canonical.description) {
        setParts.push('description = ?');
        args.push(descToCopy);
      }
      if (promptToCopy && !canonical.prompt) {
        setParts.push('prompt = ?');
        args.push(promptToCopy);
      }
      if (setParts.length > 0) {
        args.push(canonical.id);
        statements.push({
          sql: `UPDATE brow_tint SET ${setParts.join(', ')} WHERE id = ?`,
          args,
        });
        copyCount++;
      }
    }

    for (const r of toDeactivate) {
      statements.push({
        sql: "UPDATE brow_tint SET status = 'inactive' WHERE id = ?",
        args: [r.id],
      });
      deactivateCount++;
    }
  }

  console.log(
    `\n=== Phase 2: applying ${statements.length} statements ` +
      `(${deactivateCount} deactivations, ${copyCount} desc/prompt copies) in a transaction ===`
  );

  if (statements.length === 0) {
    console.log('Nothing to do.');
    return 0;
  }

  await db.batch(statements, 'write');
  console.log(`Phase 2 done.`);
  return deactivateCount;
}

async function applyPhase3(db: Client): Promise<void> {
  console.log('\n=== Phase 3: renumbering sequences per category ===');

  // Pull the current active set, ordered deterministically.
  const result = await db.execute(
    "SELECT id, category, sequence, created_at FROM brow_tint WHERE status = 'active' ORDER BY category, sequence, created_at"
  );

  const statements: { sql: string; args: any[] }[] = [];
  let counter = new Map<string, number>();

  for (const r of result.rows) {
    const category = r.category as string;
    const id = r.id as string;
    const currentSeq = Number(r.sequence);
    const next = (counter.get(category) ?? 0) + 1;
    counter.set(category, next);
    if (next !== currentSeq) {
      statements.push({
        sql: 'UPDATE brow_tint SET sequence = ? WHERE id = ?',
        args: [next, id],
      });
    }
  }

  console.log(
    `Active rows: ${result.rows.length}, updates needed: ${statements.length}`
  );
  for (const [cat, n] of counter) {
    console.log(`  ${cat}: 1..${n}`);
  }

  if (statements.length === 0) {
    console.log('Already contiguous; nothing to do.');
    return;
  }

  await db.batch(statements, 'write');
  console.log(`Phase 3 done.`);
}

async function main() {
  console.log('=== Brow Tint Dedup Script ===\n');
  const args = parseArgs();
  console.log('Args:', args);

  const db = getDb();

  // Phase 1
  const rows = await fetchActiveRows(db);
  console.log(`Fetched ${rows.length} active rows from DB.`);

  const etags = await collectEtags(rows, !args.refreshEtags);
  const { dupeGroups } = summarizePhase1(rows, etags);

  if (!args.apply) {
    console.log(
      '\nDry-run only. Re-run with --apply to execute phases 2 and 3.'
    );
    db.close();
    return;
  }

  // Phase 2
  await applyPhase2(db, dupeGroups);

  // Phase 3
  await applyPhase3(db);

  db.close();
  console.log('\nAll done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
