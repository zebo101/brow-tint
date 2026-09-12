# Article collection — 2026-09-12

## Latest decision

The user superseded the initial restoration request: remove old tint articles from the public website, keep the three current guides, and restore all eight languages.

`content/posts` now contains **24 MDX files**: three guides in English, Chinese, Korean, Japanese, German, Spanish, Italian and Portuguese.

- `eyebrow-mapping-guide`
- `eyebrow-shapes-guide`
- `how-to-shape-eyebrows`

The 42 original article files were removed from the active collection. Their original snapshot remains unchanged at `docs/archives/tintbrow-articles-2026-09-12/original-articles.zip`; its SHA-256 was checked against the manifest before removing the active files. The archive is outside the published content sources.

Public blog lists, detail pages and sitemap read the curated local MDX collection. Database posts remain available to the administrator but are not published by those routes. Old article URLs return 404; old tool URLs still redirect to the equivalent language's `/filter` page.

## Current guides

The three English guides were copied from `content/browlens-posts`, which remains an inactive source copy. Their seven translations preserve steps, shape and control tables, six-point mapping, pixel-measurement limitations, filter/editor distinction, the unavailable S-Shaped preset and source links.

Each guide has its own translated title, description, body and locale-aware internal links. Publication dates remain unchanged. Free local analysis and editing are distinguished from AI photo generation requiring sign-in and credits. Translation review was performed within this editing pass; no external native-language reviewer was used.

## Language SEO

All current public pages have eight language versions. Each page advertises all eight equivalents, including itself, plus `x-default` pointing to the English equivalent. Canonical URLs reference the current language and page on `https://browlens.com`.

English URLs are unprefixed. Other locales use `/zh`, `/ko`, `/ja`, `/de`, `/es`, `/it` and `/pt`. Redirects and missing pages are not treated as published translation targets.

## Final verification

- 104 automated tests passed. An obsolete Kie test fixture was aligned with the existing brow reference field; provider implementation was not changed.
- All 64 active MDX files compiled successfully.
- HTTP acceptance: 104/104 public language pages passed canonical, full hreflang and document-language checks; sitemap contains 88 URLs with nine alternates each. Retired article samples return 404.
- Browser: Chinese blog shows exactly three guides; navigation lists all eight languages and switches to the translated Japanese blog.
- Removed forced static rendering from the docs page because it discarded request locale headers and rendered English document-language tags for translated docs.
- No paid image generation or production deployment was performed during these checks.
