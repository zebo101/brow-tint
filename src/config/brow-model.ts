// Verified against Kie's image-to-image API, 2026-09-12:
// https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-image-to-image
export const BROW_IMAGE_MODEL = 'gpt-image-2-5-flare-image-to-image';

export const BROW_IMAGE_OPTIONS = {
  resolution: '1K',
  aspect_ratio: 'auto',
  background: 'opaque',
} as const;

// Accept requests from already-open browsers, then upgrade new tasks on the
// server. Existing queued/submitted tasks retain their stored model and options.
export const BROW_STYLE_IMAGE_MODELS: readonly string[] = [
  BROW_IMAGE_MODEL,
  'nano-banana-pro',
  'gpt-image-2-image-to-image',
];
