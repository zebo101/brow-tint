# Fix Brow Tint Credit Cost — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock every brow tint generation to a flat 2 credits — server-authoritative, with DB rows, schema defaults, and seed scripts all aligned so no layer can drift.

**Architecture:** Three independent sources of truth (server logic, DB rows, seed/migration scripts) all converge on `2`. The server constant is authoritative — even if a DB row gets corrupted, the user is charged 2. The DB rows match so the UI label is honest. The seed/schema defaults match so future provisioning doesn't reintroduce drift.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Drizzle ORM (Postgres + SQLite dual-dialect), tsx for scripts, pnpm package manager.

**Source spec:** [`docs/superpowers/specs/2026-04-30-fix-brow-tint-credit-cost-design.md`](../specs/2026-04-30-fix-brow-tint-credit-cost-design.md)

---

## File Structure

| File | Action | Responsibility after change |
|---|---|---|
| `src/app/api/ai/generate/route.ts` | Modify (line ~113) | Charge a server-side constant of 2, ignore the DB-stored per-style cost |
| `src/config/db/schema.pg.ts` | Modify (line 574) | Default `brow_style.credits` to 2 for hand-inserted Postgres rows |
| `src/config/db/schema.sqlite.ts` | Modify (line 647) | Default `brow_style.credits` to 2 for hand-inserted SQLite rows |
| `scripts/seed-brow-styles.ts` | Modify (lines 16–20, 61) | Seed every style at exactly 2 credits, no intensity ladder |
| `scripts/migrate-tints-to-styles.ts` | Modify (lines 53, 149) | Same — flat 2 for any future migration runs |
| `scripts/normalize-brow-style-credits.ts` | **Create** | One-shot idempotent UPDATE to bring existing DB rows to 2 |

No frontend code or locale text changes needed — `studio.tsx` reads `selectedStyle.credits` from the API and `{credits}` interpolation in the locale JSON renders whatever value comes through. Once the DB has 2s, the UI shows 2s automatically.

**Deployment ordering:** Run Task 5 (DB UPDATE) **before** the deploy that contains Task 1 (server constant). If Task 1 ships first while DB rows still hold 1/3, the UI shows the wrong number until Task 5 runs. Task 5 is safe to run on the current production DB before any code change because the server already charges `style.credits`, so updating the column to 2 immediately makes the cost 2.

---

## Task 1: Lock server cost to constant 2

**Files:**
- Modify: `src/app/api/ai/generate/route.ts:1-20, 113`

- [ ] **Step 1: Add the constant near the top of the file**

Open `src/app/api/ai/generate/route.ts`. Below the imports (after line 13, before the `BROW_STYLE_IMAGE_MODELS` array on line 15), add:

```ts
// Every brow tint generation costs exactly 2 credits. This constant is
// authoritative — the per-row brow_style.credits column is ignored by the
// server. See docs/superpowers/specs/2026-04-30-fix-brow-tint-credit-cost-design.md.
const BROW_TINT_COST_CREDITS = 2;
```

The final shape of the top-of-file region should look like:

```ts
import { getAIService } from '@/shared/services/ai';

const BROW_TINT_COST_CREDITS = 2;

const BROW_STYLE_IMAGE_MODELS = [
  'nano-banana-pro',
  'gpt-image-2-image-to-image',
];
```

- [ ] **Step 2: Replace the per-row cost lookup with the constant**

Find line 113 inside the `if (styleId) { ... }` block. Currently:

```ts
costCredits = style.credits;
```

Change to:

```ts
costCredits = BROW_TINT_COST_CREDITS;
```

The rest of that block — the `[style] = await db().select()...` lookup, the `buildBrowStylePrompt(...)` call, the `negative_prompt` assignment — must stay intact. We still need the style row for prompt construction. We just stop reading its `credits` column.

- [ ] **Step 3: Sanity-check the file compiles**

Run from repo root:

```bash
npx tsc --noEmit src/app/api/ai/generate/route.ts 2>&1 | head -30
```

Expected: no errors referencing `route.ts` (pre-existing fumadocs `.source` errors elsewhere are unrelated and may appear — ignore those).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/generate/route.ts
git commit -m "$(cat <<'EOF'
fix(credits): lock brow tint cost to flat 2 credits server-side

Replace style.credits lookup with BROW_TINT_COST_CREDITS = 2 so the
authoritative cost lives in code, not in the DB column. The brow_style.credits
column still drives the UI label until the DB normalization script runs
(see scripts/normalize-brow-style-credits.ts).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Sync schema defaults to 2

**Files:**
- Modify: `src/config/db/schema.pg.ts:574`
- Modify: `src/config/db/schema.sqlite.ts:647`

These changes are cosmetic in this PR — the column already exists with `NOT NULL` so no migration runs. But future hand-inserted rows (e.g. from `db:studio`) get the right default.

- [ ] **Step 1: Update Postgres schema default**

In `src/config/db/schema.pg.ts:574`, change:

```ts
credits: integer('credits').notNull().default(1),
```

to:

```ts
credits: integer('credits').notNull().default(2),
```

- [ ] **Step 2: Update SQLite schema default**

In `src/config/db/schema.sqlite.ts:647`, change:

```ts
credits: integer('credits').notNull().default(1),
```

to:

```ts
credits: integer('credits').notNull().default(2),
```

- [ ] **Step 3: Verify drizzle doesn't generate a spurious migration**

```bash
pnpm db:generate
```

Expected: drizzle reports `No schema changes, nothing to migrate.` (or equivalent — the column type and not-null status are unchanged; only the default literal differs, which drizzle treats as a no-op for already-existing columns). If drizzle proposes a migration anyway, **do not commit it** — the column already has data, an ALTER COLUMN SET DEFAULT against `1` → `2` is harmless but unnecessary. Discard the generated SQL with `git restore src/config/db/migrations/`.

- [ ] **Step 4: Commit**

```bash
git add src/config/db/schema.pg.ts src/config/db/schema.sqlite.ts
git commit -m "$(cat <<'EOF'
chore(schema): default brow_style.credits to 2

Aligns the column default with the new flat 2-credit pricing. No migration
is required — the column already exists; this only affects future
hand-inserted rows (e.g. from db:studio).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Flatten seed scripts to 2

**Files:**
- Modify: `scripts/seed-brow-styles.ts:16-20, 61`
- Modify: `scripts/migrate-tints-to-styles.ts:53-57, 149`

- [ ] **Step 1: Remove `CREDITS_MAP` from `seed-brow-styles.ts`**

Open `scripts/seed-brow-styles.ts`. Delete lines 16–20 entirely (the `CREDITS_MAP` declaration). The file should jump from the `NEGATIVE` const directly to `const SEED = [...]`.

- [ ] **Step 2: Replace the per-row credits lookup**

In the same file, find line 61 inside the `SEED.map(...)` callback. Currently:

```ts
credits: CREDITS_MAP[s.intensity] ?? 1,
```

Change to:

```ts
credits: 2,
```

- [ ] **Step 3: Remove `CREDITS_MAP` from `migrate-tints-to-styles.ts`**

Open `scripts/migrate-tints-to-styles.ts`. Delete lines 53–57 (the `CREDITS_MAP` declaration). The `INTENSITIES` const at line 51 should be followed directly by the `// Build all combinations for round-robin distribution` comment.

- [ ] **Step 4: Replace the per-row credits lookup in the migration script**

In the same file, find line 149 inside the `tints.map(...)` callback. Currently:

```ts
credits: CREDITS_MAP[combo.intensity] ?? 1,
```

Change to:

```ts
credits: 2,
```

- [ ] **Step 5: Verify both scripts type-check**

```bash
npx tsc --noEmit scripts/seed-brow-styles.ts scripts/migrate-tints-to-styles.ts 2>&1 | head -20
```

Expected: no errors referencing the unused `CREDITS_MAP` symbol or stale type imports.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-brow-styles.ts scripts/migrate-tints-to-styles.ts
git commit -m "$(cat <<'EOF'
chore(seeds): flatten brow style credits to 2

Drops the per-intensity CREDITS_MAP from both seed scripts. Future seed
or migration runs now produce flat 2-credit rows instead of the old
1/2/3 ladder by intensity.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create the DB normalization script

**Files:**
- Create: `scripts/normalize-brow-style-credits.ts`

This is a one-shot idempotent script that brings existing DB rows in line with the new constant. Mirrors the dialect-dispatch pattern of `seed-brow-styles.ts` (uses `db()` from `@/core/db` so it works on whatever `DATABASE_PROVIDER` is set).

- [ ] **Step 1: Create the script**

Create `scripts/normalize-brow-style-credits.ts` with the following exact content:

```ts
/**
 * Normalize all brow_style.credits values to 2.
 *
 * Usage: npx tsx scripts/normalize-brow-style-credits.ts
 *
 * Idempotent: subsequent runs report 0 rows changed and exit cleanly.
 */

import { ne } from 'drizzle-orm';

import { db } from '@/core/db';
import { browStyle } from '@/config/db/schema';

const TARGET_CREDITS = 2;

async function main() {
  console.log('=== Normalize brow_style.credits ===\n');

  const beforeRows = await db()
    .select({ credits: browStyle.credits })
    .from(browStyle);

  const distribution = beforeRows.reduce<Record<number, number>>((acc, row) => {
    acc[row.credits] = (acc[row.credits] ?? 0) + 1;
    return acc;
  }, {});

  console.log('Before — credits distribution:');
  for (const [credits, count] of Object.entries(distribution)) {
    console.log(`  ${credits} credits: ${count} row(s)`);
  }

  const offTarget = beforeRows.filter((row) => row.credits !== TARGET_CREDITS).length;

  if (offTarget === 0) {
    console.log(`\nAll ${beforeRows.length} row(s) already at ${TARGET_CREDITS} credits. Nothing to do.`);
    return;
  }

  console.log(`\nUpdating ${offTarget} row(s) to ${TARGET_CREDITS} credits...`);

  await db()
    .update(browStyle)
    .set({ credits: TARGET_CREDITS })
    .where(ne(browStyle.credits, TARGET_CREDITS));

  console.log(`\nDone. ${offTarget} row(s) normalized to ${TARGET_CREDITS} credits.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to normalize brow_style.credits:', err);
    process.exit(1);
  });
```

- [ ] **Step 2: Type-check the new script**

```bash
npx tsc --noEmit scripts/normalize-brow-style-credits.ts 2>&1 | head -20
```

Expected: no errors referencing `normalize-brow-style-credits.ts`.

- [ ] **Step 3: Dry-run on local dev DB if available**

If you have a local dev DB connected (`DATABASE_PROVIDER` and `DATABASE_URL` set in `.env.development.local` or equivalent):

```bash
npx tsx scripts/normalize-brow-style-credits.ts
```

Expected output (example):
```
=== Normalize brow_style.credits ===

Before — credits distribution:
  1 credits: 36 row(s)
  2 credits: 36 row(s)
  3 credits: 36 row(s)

Updating 72 row(s) to 2 credits...

Done. 72 row(s) normalized to 2 credits.
```

Re-run the same command. Expected: `All N row(s) already at 2 credits. Nothing to do.` Confirms idempotency.

If you don't have a local DB, skip this step — Task 5 covers running it against the real DB.

- [ ] **Step 4: Commit**

```bash
git add scripts/normalize-brow-style-credits.ts
git commit -m "$(cat <<'EOF'
chore(scripts): add normalize-brow-style-credits.ts

One-shot idempotent script that updates every brow_style row to
credits=2. Run once before deploying the server constant change so the
UI label and the actual charge stay in sync.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Run normalization against the production DB

This task produces no commit — it's an operational step that mutates production data. **Run this before the deploy that contains Tasks 1–4.**

- [ ] **Step 1: Verify environment variables**

Confirm the shell where you'll run the script has the production DB credentials (`DATABASE_PROVIDER`, `DATABASE_URL`, and any provider-specific vars like `TURSO_AUTH_TOKEN`). Typically:

```bash
echo "$DATABASE_PROVIDER"
# Expected: turso (or postgresql / sqlite — whichever you ship with)
```

- [ ] **Step 2: Run the normalization**

```bash
npx tsx scripts/normalize-brow-style-credits.ts
```

Expected output: shows the before-distribution (likely roughly thirds of 1/2/3), then the count of rows updated, then `Done.`. Note the count of rows updated for the change record.

- [ ] **Step 3: Verify**

If your DB has a SQL console (`pnpm db:studio` for local, Turso console for prod), run:

```sql
SELECT credits, COUNT(*) FROM brow_style GROUP BY credits;
```

Expected: a single row, `credits = 2`, count equal to the total number of brow styles.

- [ ] **Step 4: Re-run the script to confirm idempotency**

```bash
npx tsx scripts/normalize-brow-style-credits.ts
```

Expected: `All N row(s) already at 2 credits. Nothing to do.`

---

## Task 6: Manual smoke test

This task produces no commit — it's a verification gate before declaring the change complete.

- [ ] **Step 1: Refresh the brow tint generator page**

Open `/ai-brow-tint-generator` in a browser. Hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) so cached API responses don't mask the change.

- [ ] **Step 2: Check the button label for a `sheer` style**

Pick a style that previously showed "1 credits" (any style with `intensity = 'sheer'`, e.g. "Whisper Taupe", "Honey Wisp", "Champagne", "Quiet Luxury"). The Generate button should now read **"Generate · 2 credits"**.

- [ ] **Step 3: Check the button label for a `rich` style**

Pick a style that previously showed "3 credits" (any `intensity = 'rich'`, e.g. "Mocha Frame", "Espresso Bold", "Onyx Statement", "Power Brow"). The Generate button should also read **"Generate · 2 credits"**.

- [ ] **Step 4: Run one full generation end-to-end**

Upload a photo, pick any style, click Generate. After the task completes:

1. Open `/settings/credits` (or check the user's `remainingCredits` in the header). Confirm the balance decreased by **exactly 2**.
2. (Optional) Query the DB directly:
   ```sql
   SELECT credits, scene FROM credit
   WHERE user_id = '<your-user-id>'
     AND transaction_type = 'consume'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expected: `credits = -2`, `scene = 'image-to-image'`.

- [ ] **Step 5: Confirm history rows are not retroactively re-priced**

Open `/activity/ai-tasks`. Older tasks should still show their original `costCredits` (1/2/3 mixed) — the fix only changes new generations, not historical records. This is intended.

If all five checks pass, the change is complete.

---

## Self-review notes

- All six spec change-targets (`route.ts`, `schema.pg.ts`, `schema.sqlite.ts`, two seed scripts, new normalize script) have a corresponding task.
- The "files NOT changed" list from the spec (`studio.tsx`, `styles-loader.ts`, `types.ts`, locale JSON) is honored — no task touches those files.
- The "out of scope" items from the spec (refund on failure, dropping the dead scene-based ladder, dropping the `credits` column entirely) are not in any task — correct.
- Constant naming: `BROW_TINT_COST_CREDITS` is used consistently in Task 1 (declaration + reference) and the spec. No drift.
- Each task ends with a commit using the project's Co-Authored-By footer style (matches recent commit history).
