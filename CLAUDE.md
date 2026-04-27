# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

This is a fork of **ShipAny Template Two** (`shipany-template-two` v1.8.0) — a Next.js 16 / React 19 AI SaaS boilerplate — specialized as **Brow Tint** (`tintbrow`), an AI brow tint / hairstyle / video / music product. Package manager: **pnpm ≥ 8** on **Node ≥ 20.9**.

## Common commands

```bash
pnpm dev                    # next dev --turbopack
pnpm build                  # production build
pnpm build:fast             # build with --max-old-space-size=4096 (OOM workaround)
pnpm start                  # serve built app
pnpm lint                   # eslint .
pnpm format                 # prettier --write .

# Drizzle (dialect auto-picked from DATABASE_PROVIDER)
pnpm db:generate            # generate migration from schema
pnpm db:migrate             # apply migrations
pnpm db:push                # push schema directly (dev)
pnpm db:studio              # drizzle-kit studio

# Better Auth
pnpm auth:generate          # regenerate auth schema from src/core/auth/index.ts

# RBAC seeding
pnpm rbac:init              # npx tsx scripts/init-rbac.ts
pnpm rbac:assign            # npx tsx scripts/assign-role.ts

# Cloudflare (via @opennextjs/cloudflare)
pnpm cf:preview | cf:deploy | cf:upload | cf:typegen

# Tests use node's built-in runner (node:test). Example:
node --import tsx --test src/app/sitemap-routes.test.ts
```

There is no `test` script in `package.json`; tests are plain `*.test.ts` files using `node:test` + `node:assert/strict`. Run them directly with `tsx`.

## Architecture

### Five-layer source split (`src/`)

The top-level folders under `src/` are deliberately separated and should not be mixed. Prettier's `importOrder` enforces the boundary visually.

- **`core/`** — framework plumbing wired to specific libraries. `auth/` (better-auth), `db/` (drizzle + provider dispatch), `i18n/` (next-intl routing/request config), `rbac/` (permission engine), `docs/` (fumadocs), `theme/`.
- **`config/`** — per-deployment configuration: DB **schemas** (`schema.pg.ts` + `schema.sqlite.ts` behind `schema.ts` facade), locale message JSON (`locale/messages/**`), image prompts (`img-prompt.ts`), style tokens (`style/theme.css`, `style/global.css`), `index.ts` exposing `envConfigs` (the env-var surface).
- **`extensions/`** — swappable third-party integrations exposing a common interface: `ads/`, `affiliate/`, `ai/` (fal, gemini, kie, replicate), `analytics/`, `customer_service/`, `email/` (resend/react-email), `payment/` (stripe, creem, paypal), `storage/` (R2/S3-like).
- **`shared/`** — application code: `blocks/` (composed page sections), `components/` (primitives incl. shadcn/ui + magicui + ai-elements), `contexts/`, `hooks/`, `lib/`, `models/` (DB-backed entity helpers), `services/` (business logic that orchestrates extensions), `types/`.
- **`themes/`** — presentation-layer blocks and layouts. Currently only `themes/default/`. Contains `blocks/` (all page-level section components: hero, header, footer, features, pricing, etc.), `layouts/` (page shells like `landing.tsx`), and `pages/` (dynamic/static page renderers). Block components receive `Section` data from i18n JSON and render it — keep text in locale JSON, not hardcoded in components.

Alias: `@/*` → `./src/*`, plus `@/.source` → generated fumadocs index (`.source/`, produced by `pnpm postinstall` → `fumadocs-mdx`).

### Dual DB dialect with build-time schema swap

`DATABASE_PROVIDER` (`postgresql` | `sqlite` | `turso`) is resolved in **three** places that must stay in sync:

1. `src/config/index.ts` picks `db_schema_file` and `db_migrations_out` defaults.
2. `next.config.mjs` rewrites the alias `@/config/db/schema` to either `schema.ts` (pg) or `schema.sqlite.ts` in **both** `webpack.resolve.alias` and `turbopack.resolveAlias`.
3. `src/config/db/schema.ts` itself is a runtime facade that `require()`s the correct file.
4. `src/core/db/index.ts` exports `db()` as `any` on purpose — pg vs libsql Drizzle types diverge and a union would break all call sites; use `dbPg()` / `dbSqlite()` only when dialect-specific.

When editing DB code, touch the matching schema file and run `pnpm db:generate` with the right `DATABASE_PROVIDER` set. Migrations live in `src/config/db/migrations/{pg,sqlite}/`.

### Request pipeline

- **Middleware**: `src/proxy.ts` (exported as `proxy`, not `middleware`). Chains `next-intl` middleware, enforces auth cookie presence for `/admin`, `/settings`, `/activity`, and strips `Set-Cookie` + sets public `Cache-Control` for cacheable routes. RBAC is only session-gated here; fine-grained permission checks happen in pages/API via `requirePermission()` from `core/rbac`.
- **Routing**: all user-facing pages live under `src/app/[locale]/` with route groups `(landing)`, `(auth)`, `(chat)`, `(docs)`, `(admin)`. AI product pages are nested as `(landing)/(ai)/<tool>/` (currently `ai-brow-tint-generator`, `ai-music-generator`, `hairstyle-changer-ai-video`).
- **API routes**: `src/app/api/` with feature folders (`ai`, `auth/[...all]`, `chat`, `config`, `docs`, `email`, `hairstyle`, `payment` incl. `notify/[provider]`, `proxy/file`, `storage`, `user`).
- **SEO**: `src/app/sitemap.ts` + `sitemap-routes.ts` (+ tests), `robots.ts`, `ads.txt`.

### i18n

8 locales: `en, zh, ko, ja, de, es, it, pt` (see `src/config/locale/index.ts`). `localePrefix: 'as-needed'`, detection **off**. Message namespaces are enumerated in `localeMessagesPaths` — adding a new namespace requires an entry there and a corresponding file under `src/config/locale/messages/`.

### Content (MDX via fumadocs)

`source.config.ts` defines four content roots under `content/`: `docs/`, `pages/`, `posts/`, `logs/`. `pnpm postinstall` runs `fumadocs-mdx` to generate `.source/index.ts` consumed via the `@/.source` alias.

### Runtime / deployment

`next.config.mjs` sets `output: 'standalone'` everywhere **except** Vercel, disables `mdxRs` on Vercel (fumadocs-mdx incompatibility), enables `reactCompiler` and `turbopackFileSystemCacheForDev`. Two deploy paths are supported: Vercel (native) and Cloudflare Workers via `@opennextjs/cloudflare` (`cf:*` scripts, `wrangler.toml.example` as template).

### Theme & styling

- **Light-only**: `ThemeProvider` in `core/theme/provider.tsx` forces `forcedTheme="light"` with `enableSystem={false}`. Dark mode is disabled.
- **Color palette**: `config/style/theme.css` uses oklch-based pink/rose tones (primary ≈ `oklch(0.87 0.07 7)`). Only `:root` is defined — no `.dark` block.
- **Fonts**: body uses `Poppins` (`--font-sans`), monospace uses `Roboto Mono`. Hero/display text uses `Satoshi` (applied via `font-['Satoshi']` class in hero components).

### Hero block variants

The landing hero section is driven by the `"block"` field in i18n JSON (`pages/index.json` → `sections.hero.block`):

- **`hero`** (`hero.tsx`) — standard centered hero with title, description, CTA buttons, and browser preview.
- **`hero-editorial`** (`hero-editorial.tsx`) — full-viewport editorial layout with layered background/foreground images, giant brand text behind model, and editorial labels. Text fields (`powered_by`, `editorial_labels`, etc.) come from `section` data.
- **`hero-app-frame`** (`hero-app-frame.tsx`) — app-frame style wrapper for embedding content.

When adding text to any hero variant, always put it in the i18n JSON (`pages/index.json` hero section), not hardcoded in the component.

### Patches

`patches/` contains pnpm patches (applied via `pnpm install`). Currently: `@radix-ui/react-compose-refs` compatibility fix.

## Conventions

- Prettier enforces import grouping: `react` → `next` → third-party → `@/core` → `@/config` → `@/extensions` → `@/shared` → `@/themes` → relative. Keep this order when adding imports.
- Config is read exclusively through `envConfigs` in `src/config/index.ts` — do not add `process.env.*` reads elsewhere.
- Services in `shared/services/` are the integration seam: they read DB-backed config (`shared/models/config`) and dispatch to the appropriate `extensions/*` provider; keep provider-specific code inside `extensions/`.
- **No hardcoded UI text in components**: all user-facing strings must come from i18n locale JSON files under `src/config/locale/messages/`. Components read text from `section` props or `useTranslations()`. This applies to all 8 locales (`en, zh, ko, ja, de, es, it, pt`).
