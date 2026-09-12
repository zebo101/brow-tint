# Browlens pricing and entitlement implementation

User-approved scope: monthly pricing, annual pricing, credit packs, paid export restrictions, Premium multi-style comparison export, and real tiered priority queues. All eight locales. Preserve AI prompts, provider selection, shape analysis, six-point editing, and the existing two-credit generation cost.

## Contracts

- Authoritative billing catalog: `src/config/brow-pricing.ts`. Monthly Free 6 signup credits once, Basic 1290 cents/100 credits, Premium 2490 cents/300 credits. Annual Basic 15900 cents/2400 credits, Premium 23900 cents/3600 credits, upfront. Packs 599 cents/24, 1199 cents/60, 1999 cents/120, no expiry.
- `getBrowEntitlements(userId)` returns `{tier, canExport, canCompare, queuePriority}`. Active or pending-cancel subscription with a current billing period grants its tier; completed paid top-up grants single export only. No authorization from credit balance, client fields, translated labels, or expired subscriptions.
- Standard priority 0, Basic 1, Premium 2. FIFO within priority. Existing work is not preempted. Persistent queue and atomic credit reservations precede provider dispatch; failed tasks refund once. Restart recovery never blindly repeats ambiguous provider submissions.
- Free can map, manually correct, and read analysis reports without limits. Preview is available; full exports require paid entitlements. Premium comparison requires 2–4 successful owned eyebrow tasks from the same source photo. Preview DTOs omit raw provider URLs and queue metadata.
- Price/credit grants are derived from the catalog. Creem product price, currency and billing period are checked before checkout. Prior order/subscription credit snapshots stay intact. No unrelated payment migrations.

## Work units

- [x] Pricing cards, annual two-card layout, three top-up cards, localized comparison table. Basic annual has no savings claim; Premium saves $59.80/year. Preserve payment flow and make H1 visible.
- [x] Shared billing catalog, server checkout authority, Creem price guard, entitlement service, and contract tests.
- [x] PostgreSQL queue using existing ai_task persistence and a Node worker with coordinated claims and restart recovery; queue/credits failure tests.
- [x] Preview/export APIs, ownership and plan validation, actual sharp-based HD/comparison exports, UI gates/history, export tests.
- [ ] Update formal Creem product prices/copy and top-up mappings to match the reviewed implementation; no purchase or live charge during testing.
- [ ] Integrate DTO serialization in user task surfaces, run tests/typecheck/production build, review, deploy main, verify public pricing and unauthorized API behavior.

Homepage correction is separate and already deployed as `de45d33`: remove the additional hero upload CTA only on the homepage, preserve /filter CTA and initial HTML rendering.
