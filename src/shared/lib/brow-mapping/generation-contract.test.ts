import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBrowStylePrompt } from '@/config/img-prompt';

import {
  appendBrowMappingStyleReference,
  createGenerationError,
  validateBrowMappingRequest,
} from './generation-contract';

const ORIGINAL_URL = 'https://uploads.example.com/normalized-portrait.webp';
const GUIDE_URL = 'https://uploads.example.com/confirmed-brow-guide.png';
const STYLE_URL = 'https://cdn.example.com/styles/soft-taupe.webp';
const SUPPORTED_MODELS = ['nano-banana-pro', 'gpt-image-2-image-to-image'];

test('pre-submission validation errors remain compatible and explicitly retryable', () => {
  assert.deepEqual(
    createGenerationError(new Error('insufficient credits'), false),
    {
      code: -1,
      message: 'insufficient credits',
      submissionState: 'not-submitted',
    }
  );
});

test('failures after provider submission starts return an unknown state without details', () => {
  const response = createGenerationError(
    new Error('provider rejected apiKey=do-not-expose result={"raw":true}'),
    true
  );

  assert.deepEqual(response, {
    code: -1,
    message:
      'Generation submission status is unknown. Check task history before retrying.',
    submissionState: 'unknown',
  });
  assert.doesNotMatch(JSON.stringify(response), /do-not-expose|raw|apiKey/);
});

test('unexpected failures before submission do not expose internal error details', () => {
  const response = createGenerationError(
    new Error('database failed at postgres://secret-host/internal'),
    false
  );

  assert.deepEqual(response, {
    code: -1,
    message: 'Generation request failed.',
    submissionState: 'not-submitted',
  });
  assert.doesNotMatch(JSON.stringify(response), /secret-host|postgres/);
});

test('mapping requests require a style and a supported image-to-image model', () => {
  const valid = {
    browMapping: true,
    styleId: 'style-soft-taupe',
    mediaType: 'image',
    scene: 'image-to-image',
    model: 'nano-banana-pro',
    supportedModels: SUPPORTED_MODELS,
  };

  assert.doesNotThrow(() => validateBrowMappingRequest(valid));

  const invalidRequests = [
    { ...valid, styleId: undefined },
    { ...valid, styleId: '' },
    { ...valid, mediaType: 'video' },
    { ...valid, scene: 'text-to-image' },
    { ...valid, model: 'unsupported-image-model' },
  ];

  for (const request of invalidRequests) {
    assert.throws(
      () => validateBrowMappingRequest(request),
      /browMapping requires an active style and a supported image-to-image model/
    );
  }
});

test('legacy requests are unaffected when brow mapping is not enabled', () => {
  assert.doesNotThrow(() =>
    validateBrowMappingRequest({
      browMapping: undefined,
      styleId: undefined,
      mediaType: 'video',
      scene: 'text-to-video',
      model: 'legacy-model',
      supportedModels: SUPPORTED_MODELS,
    })
  );
});

test('mapping generation appends the trusted style reference after the original and guide', () => {
  const options = appendBrowMappingStyleReference(
    {
      image_input: [ORIGINAL_URL, GUIDE_URL],
      output_format: 'png',
    },
    STYLE_URL
  );

  assert.deepEqual(options, {
    image_input: [ORIGINAL_URL, GUIDE_URL, STYLE_URL],
    output_format: 'png',
  });
});

test('mapping generation rejects missing, extra, and invalid client image URLs', () => {
  const invalidOptions = [
    undefined,
    {},
    { image_input: [ORIGINAL_URL] },
    { image_input: [ORIGINAL_URL, GUIDE_URL, 'https://example.com/extra.png'] },
    { image_input: [ORIGINAL_URL, 'not-a-url'] },
    { image_input: [ORIGINAL_URL, 'ftp://example.com/guide.png'] },
    { image_input: [ORIGINAL_URL, 42] },
  ];

  for (const options of invalidOptions) {
    assert.throws(
      () => appendBrowMappingStyleReference(options, STYLE_URL),
      /browMapping requires exactly two valid HTTP\(S\) image URLs/
    );
  }
});

test('mapping generation rejects image aliases that the provider would merge', () => {
  const providerImageAliases = [
    { input_urls: ['https://example.com/extra-before.png'] },
    { image_urls: ['https://example.com/extra-after.png'] },
    { brow_tint_image: 'https://example.com/extra-reference.png' },
  ];

  for (const extraOptions of providerImageAliases) {
    assert.throws(
      () =>
        appendBrowMappingStyleReference(
          {
            image_input: [ORIGINAL_URL, GUIDE_URL],
            ...extraOptions,
          },
          STYLE_URL
        ),
      /browMapping does not accept additional provider image fields/
    );
  }
});

test('mapping generation rejects a missing or invalid server style reference', () => {
  for (const styleReference of [
    undefined,
    null,
    '',
    'not-a-url',
    'data:image/png;base64,abc',
  ]) {
    assert.throws(
      () =>
        appendBrowMappingStyleReference(
          { image_input: [ORIGINAL_URL, GUIDE_URL] },
          styleReference
        ),
      /active brow style is missing a valid HTTP\(S\) thumbnail/
    );
  }
});

test('mapping prompt assigns identity, placement, and appearance to distinct images', () => {
  const prompt = buildBrowStylePrompt({
    name: 'Soft Taupe Arch',
    shade: 'taupe',
    shape: 'soft arch',
    intensity: 'medium',
    styledPrompt: 'Softly tinted brows with balanced density.',
    subjectImageCount: 3,
    browMapping: true,
  });

  assert.match(prompt, /Image 1.+identity authority/i);
  assert.match(prompt, /Image 2.+placement and contour authority/i);
  assert.match(prompt, /Image 3.+appearance authority/i);
  assert.match(prompt, /Image 2.+not a user portrait/i);
  assert.match(prompt, /Image 3.+not a user portrait/i);
  assert.doesNotMatch(prompt, /Images 1-3 are the user's portrait photos/i);
});

test('legacy brow style prompts keep the existing single-portrait role', () => {
  const prompt = buildBrowStylePrompt({
    name: 'Soft Taupe Arch',
    shade: 'taupe',
    shape: 'soft arch',
    intensity: 'medium',
    styledPrompt: 'Softly tinted brows with balanced density.',
    subjectImageCount: 1,
  });

  assert.match(prompt, /Image 1 is the user's portrait photo\./);
  assert.doesNotMatch(prompt, /confirmed brow mapping guide/i);
  assert.doesNotMatch(prompt, /Image 3/i);
});
