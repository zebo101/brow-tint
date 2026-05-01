# Brow Tint Generator — Three-Step Wizard Redesign

## Overview

Replace the current three-panel `ImageGenerator` with a three-step wizard:
- **Step 1**: Upload photo (free)
- **Step 2**: Choose brow style from curated gallery (free)
- **Step 3**: Generate & preview with before/after slider (paid)

## Design System

### Colors (CSS Variables)
```css
--bt-bg: #FAF4F1;
--bt-bg-tint: #F5E8E4;
--bt-surface: #FFFFFF;
--bt-ink: #2A1F1C;
--bt-ink-2: #58463F;
--bt-ink-3: #8B7770;
--bt-rose: #D89A93;
--bt-rose-deep: #B86F66;
--bt-gold: #B89868;
--bt-line: rgba(58, 42, 38, 0.08);
--bt-line-strong: rgba(58, 42, 38, 0.16);
```

### Typography
- Display: **Instrument Serif** (Google Fonts), italic for emphasis
- UI: **Geist** or system-ui

### Tokens
- Card: white #FFF + 1px border --bt-line + shadow-sm
- Buttons: dark fill #2A1F1C + white text + pill radius (999px)
- Border radius: card 14px / button 999px / container 22px
- Shadows:
  - sm: `0 1px 2px rgba(58,30,25,.04), 0 2px 8px rgba(58,30,25,.04)`
  - md: `0 1px 2px rgba(58,30,25,.04), 0 8px 28px rgba(58,30,25,.08)`
  - lg: `0 1px 2px rgba(58,30,25,.04), 0 24px 60px rgba(58,30,25,.14)`

## File Structure

```
src/themes/default/blocks/brow-tint/
├── layout.tsx          # Header + Stepper + Credits + container
├── step-upload.tsx     # Step 1
├── step-gallery.tsx    # Step 2
└── step-result.tsx     # Step 3
```

## Data Layer

### Tables (schema.pg.ts + schema.sqlite.ts)
- `brow_styles`: id, slug, name, shade, shape, intensity, thumbnail, prompt, negative, popular, trending, tier, credits, status, created_at
- `brow_jobs`: id, user_uuid, style_id, source_url, result_url, provider, model, status, credits_used, error_code, request, response, duration_ms, created_at, finished_at
- `brow_lookbook`: id, user_uuid, job_id, pinned, note, created_at

### Seed: 24 styles across 6 shades × 6 shapes × 3 intensities

## i18n

New namespace: `pages/ai-brow-tint` registered in `localeMessagesPaths`

## RBAC

- `ai.brow-tint.use`
- `ai.brow-tint.premium`
- `ai.brow-tint.admin`

## Credits

- Cost per style defined in `brow_styles.credits` column (not hardcoded)
- Deduct on generate, refund on failure
- Uses existing `consumeCredits()` / `getRemainingCredits()` from `shared/models/credit.ts`
