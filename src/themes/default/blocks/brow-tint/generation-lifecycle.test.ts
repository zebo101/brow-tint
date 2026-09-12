import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBrowMappingPayload,
  classifyGenerateResponse,
  generationReducer,
  initialGenerationState,
  isDesignLocked,
  validateBrowPhotoFile,
} from './generation-lifecycle';

test('mapping generation sends the normalized photo and confirmed guide in order', () => {
  const payload = buildBrowMappingPayload({
    styleId: 'style-42',
    originalUrl: 'https://cdn.example.com/original.jpg',
    guideUrl: 'https://cdn.example.com/guide.png',
  });

  assert.deepEqual(payload, {
    provider: 'kie',
    mediaType: 'image',
    model: 'nano-banana-pro',
    scene: 'image-to-image',
    styleId: 'style-42',
    browMapping: true,
    options: {
      image_input: [
        'https://cdn.example.com/original.jpg',
        'https://cdn.example.com/guide.png',
      ],
    },
  });
});

test('mapping generation rejects a missing upload before a paid request can be built', () => {
  assert.throws(
    () =>
      buildBrowMappingPayload({
        styleId: 'style-42',
        originalUrl: 'https://cdn.example.com/original.jpg',
        guideUrl: '',
      }),
    /both uploaded images/i
  );
});

test('query interruption preserves the accepted task and retries only that task', () => {
  const accepted = generationReducer(
    generationReducer(
      generationReducer(initialGenerationState, { type: 'upload-started' }),
      { type: 'submit-started' }
    ),
    { type: 'task-accepted', taskId: 'task-paid-once' }
  );
  const interrupted = generationReducer(accepted, {
    type: 'query-interrupted',
    message: 'Status check timed out',
  });

  assert.equal(interrupted.phase, 'query-paused');
  assert.equal(interrupted.taskId, 'task-paid-once');
  assert.equal(isDesignLocked(interrupted), true);

  const retried = generationReducer(interrupted, { type: 'query-retried' });
  assert.equal(retried.phase, 'querying');
  assert.equal(retried.taskId, 'task-paid-once');
});

test('an ambiguous submit stays locked and points away from a second charged request', () => {
  const submitting = generationReducer(
    generationReducer(initialGenerationState, { type: 'upload-started' }),
    { type: 'submit-started' }
  );
  const ambiguous = generationReducer(submitting, {
    type: 'submit-ambiguous',
    message: 'The submit response was lost',
  });

  assert.equal(ambiguous.phase, 'submit-ambiguous');
  assert.equal(ambiguous.taskId, null);
  assert.equal(isDesignLocked(ambiguous), true);
  assert.equal(
    generationReducer(ambiguous, { type: 'upload-started' }),
    ambiguous,
    'a second submission must be ignored while the first may have charged'
  );
});

test('upload failure is retryable because no generation task was submitted', () => {
  const uploading = generationReducer(initialGenerationState, {
    type: 'upload-started',
  });
  const failed = generationReducer(uploading, {
    type: 'upload-failed',
    message: 'Guide upload failed',
  });

  assert.equal(failed.phase, 'failed');
  assert.equal(failed.taskId, null);
  assert.equal(isDesignLocked(failed), false);
  assert.equal(
    generationReducer(failed, { type: 'upload-started' }).phase,
    'uploading'
  );
});

test('photo input accepts only supported local files up to 15 MB', () => {
  assert.equal(
    validateBrowPhotoFile({ type: 'image/webp', size: 15 * 1024 * 1024 }),
    null
  );
  assert.match(
    validateBrowPhotoFile({ type: 'image/gif', size: 1024 }) ?? '',
    /JPG, PNG, or WebP/
  );
  assert.match(
    validateBrowPhotoFile({
      type: 'image/jpeg',
      size: 15 * 1024 * 1024 + 1,
    }) ?? '',
    /under 15 MB/
  );
});

test('HTTP 200 API rejection is retryable because no generation task was accepted', () => {
  assert.deepEqual(
    classifyGenerateResponse(200, {
      code: -1,
      message: 'Insufficient credits',
      submissionState: 'not-submitted',
    }),
    { kind: 'rejected', message: 'Insufficient credits' }
  );
});

test('HTTP 200 failure without an explicit pre-submit marker remains ambiguous', () => {
  assert.deepEqual(
    classifyGenerateResponse(200, {
      code: -1,
      message: 'Provider request failed',
    }),
    { kind: 'ambiguous', message: 'Provider request failed' }
  );
});

test('HTTP 5xx remains ambiguous because a paid submission may have reached the provider', () => {
  assert.deepEqual(
    classifyGenerateResponse(502, {
      code: -1,
      message: 'Bad gateway',
      submissionState: 'not-submitted',
    }),
    { kind: 'ambiguous', message: 'Bad gateway' }
  );
});

test('successful API response returns the accepted task id', () => {
  assert.deepEqual(
    classifyGenerateResponse(200, {
      code: 0,
      data: { id: 'task-accepted-once' },
    }),
    { kind: 'accepted', taskId: 'task-accepted-once' }
  );
});
