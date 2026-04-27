# Display Font Design

## Goal

Use the Amita handwriting font for brand-facing display text while keeping body copy, controls, forms, dashboards, and dense UI readable.

## Scope

- Add a dedicated display font token, `--font-display`, backed by Next.js font loading.
- Apply the display font to brand text, major marketing headings, and subtitles/descriptions that visually pair with those headings.
- Keep `--font-sans` as the default body font so normal content remains legible.

## Approach

The implementation will load `Amita` through `next/font/google` in `src/app/layout.tsx`, expose it as a CSS variable, then map that variable into Tailwind v4 through `src/config/style/theme.css`.

Components should use a semantic utility such as `font-display` rather than hard-coding `font-family`. This keeps the font centralized and makes future brand font changes low-risk.

## Files Expected To Change

- `src/app/layout.tsx`: import and register `Amita`.
- `src/config/style/theme.css`: add `--font-display` and expose it in `@theme inline`.
- Brand and landing/header components: add `font-display` to brand text, major headings, and subtitle text only.

## Constraints

- Do not replace the global sans font.
- Do not apply Amita to buttons, navigation, forms, tables, dashboard UI, or long paragraphs.
- Keep the change small and aligned with existing Tailwind class patterns.

## Verification

- Run lint or a focused type/build check if available.
- Confirm no TypeScript import error from `next/font/google`.
- Inspect affected components for obvious class conflicts.
