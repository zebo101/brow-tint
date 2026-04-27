# Display Font Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Amita for brand display text, headings, and paired subtitles without changing the default body font.

**Architecture:** Load Amita with `next/font/google`, expose it through a `--font-display` CSS variable, and map it into Tailwind v4 as `font-display`. Apply that utility only to brand text and marketing/page heading text.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, `next/font/google`.

---

### Task 1: Font Token

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/config/style/theme.css`

- [ ] **Step 1: Register Amita in the root layout**

Import `Amita` from `next/font/google`, create an `amita` font with `weight: ['400', '700']`, `subsets: ['latin']`, `variable: '--font-display'`, `display: 'swap'`, and `preload: true`.

- [ ] **Step 2: Attach the variable class**

Add `amita.variable` to the `<html className>` string beside the existing sans, serif, and mono variables.

- [ ] **Step 3: Expose the Tailwind font token**

In `src/config/style/theme.css`, add `--font-display: var(--font-display);` inside `@theme inline` next to the existing font tokens.

### Task 2: Display Text Application

**Files:**
- Modify: `src/shared/blocks/common/brand-logo.tsx`
- Modify: `src/shared/blocks/common/section-header.tsx`
- Modify: `src/shared/blocks/common/page-header.tsx`
- Modify: `src/themes/default/blocks/hero.tsx`
- Modify: selected marketing section blocks that render top-level section titles and descriptions

- [ ] **Step 1: Apply display font to brand text**

Add `font-display` to the `BrandLogo` text span. Keep logo image behavior unchanged.

- [ ] **Step 2: Apply display font to major headings**

Replace direct heading font overrides such as `font-['Satoshi']` with `font-display` and add `font-display` to shared heading components.

- [ ] **Step 3: Apply display font to paired subtitles**

Add `font-display` to descriptions directly paired with a major heading, including hero description, section description, and page header description.

- [ ] **Step 4: Avoid dense UI**

Do not apply `font-display` to buttons, navigation items, forms, dashboard tables, card body descriptions, or long article content.

### Task 3: Verification

**Files:**
- Verify only

- [ ] **Step 1: Run lint**

Run: `pnpm lint`

Expected: command completes without new lint errors from the modified files.

- [ ] **Step 2: Inspect diff**

Run: `git diff -- src/app/layout.tsx src/config/style/theme.css src/shared/blocks/common/brand-logo.tsx src/shared/blocks/common/section-header.tsx src/shared/blocks/common/page-header.tsx src/themes/default/blocks/hero.tsx src/themes/default/blocks`

Expected: diff only contains display font loading/token changes and targeted className additions.
