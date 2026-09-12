# Browlens Filter Implementation Plan

**Goal:** Rebrand the homepage and expose a consumer eyebrow filter at /filter.
**Architecture:** Preserve the existing detection, mapping, generation, upload, billing and polling modules. Add a filter presentation using their existing interfaces, with shape selection and a side-by-side result.
**Tech Stack:** Next.js, React, next-intl English messages, existing brow analysis and generation hooks.
**Spec:** User requests in this task; latest clarification removes all B2B positioning and /mapping promotion. Public domain: https://browlens.com.

## Constraints
- Preserve exact requested homepage and filter titles and H1s.
- Keep upload visible in the first viewport and all public routing English-only.
- No changes to AI engine, prompts, provider calls, credits, or authentication.
- Real-time contour preview must be distinguished from asynchronous generated photo results.
- S-Shaped needs user clarification because the existing engine has no such preset.
- Preserve all unrelated, pre-existing worktree edits.

## Implementation and verification
- [x] Create /filter; permanently redirect both legacy tool paths; update canonical, sitemap and public links.
- [x] Remove consumer-facing tint/shade references and all brow-artist / Pro positioning.
- [x] Add shape selector and live contour preview through existing analysis hook; retain generation actions.
- [x] Show before left / after right, selected shape name, Try Another Shape and existing download action.
- [x] Check TypeScript, relevant lifecycle/SEO tests, desktop and mobile UI, and unchanged engine hashes.
- [ ] Temporary build directory cleanup was blocked by automatic approval; retained and excluded. Generation and packaging limits are recorded in docs/seo/browlens-verification.md.

Additional user steering implemented: consumer-only SEO tables and three English guides; /filter prepares its local guide automatically without manual placement confirmation.
