# Fix brow tint credit cost to a flat 2 credits per generation

**Status:** design  
**Date:** 2026-04-30  
**Goal:** Every brow tint generation costs exactly 2 credits — locked in code, normalized in data, consistent in UI.

---

## Background

The current credit-charging path for the AI Brow Tint Generator:

1. User selects a style (e.g. "Taupe Lift") and clicks **Generate**.
2. Frontend ([`studio.tsx`](../../../src/themes/default/blocks/brow-tint/studio.tsx)) reads `selectedStyle.credits` (from the API) for the button label and the balance gate.
3. Frontend POSTs to `/api/ai/generate` with `{ styleId, mediaType: 'image', scene: 'image-to-image', ... }`.
4. Server ([`route.ts`](../../../src/app/api/ai/generate/route.ts)) loads the style row from `brow_style` and **overrides any scene-based default** with `costCredits = style.credits`.
5. `consumeCredits` is called inside the same transaction as `createAITask`.

The cost value `style.credits` is seeded by intensity tier:

```ts
// scripts/seed-brow-styles.ts:16
const CREDITS_MAP = { sheer: 1, medium: 2, rich: 3 };
```

So existing rows currently have credit costs of 1, 2, or 3. The screenshot showing "Generate · 1 credits" is a `sheer` style.

The legacy scene-based ladder (`image-to-image: 6, text-to-image: 4`) still exists in `route.ts` but is unreachable on the brow-tint path because `styleId` always overrides it.

---

## Design

Three independent sources of truth need to converge on `2`:

1. **Server (authoritative)** — hardcode the constant. No matter what's in the DB, the API charges 2.
2. **DB (display source)** — update existing rows to 2 so the UI button label matches what the server actually charges.
3. **Seed/migration scripts (future drift prevention)** — emit 2 on any future run.

Belt-and-suspenders. Any single layer is enough to charge 2 credits, but having all three aligned means tampering with one doesn't desync the others.

### Files to change

#### 1. `src/app/api/ai/generate/route.ts`

Replace the per-style cost lookup with a constant:

```ts
// at top of file
const BROW_TINT_COST_CREDITS = 2;

// inside the styleId branch (line ~113)
costCredits = BROW_TINT_COST_CREDITS;  // was: style.credits
```

Keep the rest of the `styleId` block intact — we still need to look up the style row for `prompt`, `shade`, `shape`, `intensity`, `negative`, etc. We just stop reading its `credits` column.

**Why a named constant rather than literal 2:** future re-pricing only edits one line, and the name documents intent.

#### 2. `src/config/db/schema.pg.ts:574`

```ts
credits: integer('credits').notNull().default(2),  // was: .default(1)
```

#### 3. `src/config/db/schema.sqlite.ts:647`

```ts
credits: integer('credits').notNull().default(2),  // was: .default(1)
```

No migration is generated — column already exists, this only affects future hand-inserted rows. Document this in the commit so it's not surprising later.

#### 4. `scripts/seed-brow-styles.ts`

Delete the `CREDITS_MAP` constant (lines 16–20). At line 61:

```ts
credits: 2,  // was: CREDITS_MAP[s.intensity] ?? 1
```

#### 5. `scripts/migrate-tints-to-styles.ts`

Same shape as #4. Delete `CREDITS_MAP` (line 53), update line 149.

#### 6. `scripts/normalize-brow-style-credits.ts` (NEW)

One-shot idempotent script that runs:

```sql
UPDATE brow_style SET credits = 2 WHERE credits != 2;
```

Mirror the dialect-dispatch pattern from `seed-brow-styles.ts` so it works on whatever `DATABASE_PROVIDER` is set. Logs the row count changed. Safe to re-run.

Run instructions in the commit message: `npx tsx scripts/normalize-brow-style-credits.ts`.

### Files NOT changed

- **`src/themes/default/blocks/brow-tint/studio.tsx`** — Reads `selectedStyle.credits` from the API. Once the DB and seeds say 2, the UI shows "Generate · 2 credits" automatically. No code change.
- **`src/themes/default/blocks/brow-tint/styles-loader.ts:31`** — `credits: browStyle.credits` projection still correct; the value it returns is now 2.
- **`src/themes/default/blocks/brow-tint/types.ts:14`** — `credits: number` type stays.
- **All `src/config/locale/messages/*/pages/ai-brow-tint.json`** — Strings use `{credits}` / `{n}` interpolation. They render whatever value the API sends. No copy changes for the cost number itself.
- **Legacy scene-based ladder in `route.ts:67–96`** — `image-to-image: 6, text-to-image: 4`, video/music branches. Unreachable on the active brow-tint path because `styleId` overrides. Cleanup is unrelated to this fix; flagged below as out-of-scope.

---

## Verification

1. **Database:** `SELECT credits, COUNT(*) FROM brow_style GROUP BY credits` returns one row, `credits=2`.
2. **Server:** Generate a brow tint with browser DevTools open. The `consumed_credit` row in `credit` table has `credits = -2`. The user's `remainingCredits` decreases by 2.
3. **UI:** "Generate · 2 credits" appears for *every* style — `sheer`, `medium`, `rich`. Tier doesn't matter anymore.
4. **No regression on the unused fallback paths:** legacy scene-based ladder for video/music still functions if those code paths are exercised (they shouldn't be).

---

## Out of scope (flagged for later)

- **Refund credits on async task failure.** `notify/handler.ts` updates task status but doesn't refund. Real gap — separate task.
- **Drop the dead scene-based ladder for image-to-image / text-to-image.** Unreachable on the brow-tint path. Cleanup, not correctness.
- **Drop the `brow_style.credits` column entirely.** Could be done if we never want per-style pricing again. YAGNI for now — leaving it costs nothing.
- **Drop the dead video/music branches in `route.ts` and the leftover `ImageGenerator` block.** Per project memory, those tools aren't active. Fork-cleanup work, separate task.

---

## Change checklist

- [ ] `src/app/api/ai/generate/route.ts` — add `BROW_TINT_COST_CREDITS = 2` constant; replace `costCredits = style.credits` with the constant
- [ ] `src/config/db/schema.pg.ts:574` — `.default(1)` → `.default(2)`
- [ ] `src/config/db/schema.sqlite.ts:647` — `.default(1)` → `.default(2)`
- [ ] `scripts/seed-brow-styles.ts` — delete `CREDITS_MAP`, set `credits: 2`
- [ ] `scripts/migrate-tints-to-styles.ts` — delete `CREDITS_MAP`, set `credits: 2`
- [ ] `scripts/normalize-brow-style-credits.ts` — NEW one-shot migration
- [ ] Run `npx tsx scripts/normalize-brow-style-credits.ts` against prod-like DB
- [ ] Manual smoke test: generate one `sheer` and one `rich` style, confirm both charge 2 credits
