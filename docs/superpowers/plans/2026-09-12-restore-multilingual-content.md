# Restore Multilingual Content Implementation Plan

**Goal:** Per the latest user decision, remove old tint articles from the public site, retain three current guides, and restore eight languages.
**Architecture:** Existing next-intl locale tree and Fumadocs loader; content/posts holds 3 guides × 8 languages. English stays unprefixed. Every current public page has eight translated targets, reciprocal hreflang and x-default, with a self-referencing canonical.
**Tech Stack:** Next.js, next-intl, Fumadocs MDX, TypeScript.
**Spec:** The latest request supersedes the earlier instruction to keep old articles on the website. Keep the verified offline archive.

## Constraints

- Preserve verified original snapshot docs/archives/tintbrow-articles-2026-09-12.
- Keep the three current guide slugs and publication dates; remove the 42 original active files.
- Keep Browlens/browlens.com, consumer positioning and existing AI engine.
- No publishing or reverting concurrent edits.

## Tasks

- [x] Content worker: add 24 guide files in eight languages; root removes old active articles after latest user decision.
- [x] UI worker: translate current marketing/filter flow and restore language flags.
- [x] Root: restore locale middleware and selector; keep locale on tool redirects and auth callbacks.
- [x] Root: restore localized canonical/hreflang/sitemap with translation availability; remove old article redirects and public database article sources.
- [x] Root: test locale routes, legacy URLs, canonical/alternates and partial translation sitemap.
- [x] Workers: complete translated support pages, legal pages and advanced editor wording.
- [x] Root: final type-check, MDX validation, HTTP hreflang audit and browser language switching.

## Verification

`node node_modules/tsx/dist/cli.mjs --test src/proxy.test.ts src/shared/lib/seo-paths.test.ts src/shared/lib/seo-metadata.test.ts src/app/sitemap-routes.test.ts tests/multilingual-restoration.test.ts`

`node node_modules/typescript/bin/tsc --noEmit --pretty false`

Browser: English/Chinese/another language, visible eight-language selector, localized homepage/filter, three guides only, same-article language switching and matching canonical/alternates. HTTP: removed old articles return 404 and the sitemap omits them.
