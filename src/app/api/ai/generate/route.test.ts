import assert from 'node:assert/strict';
import test from 'node:test';

// Exercise the real public POST handler without auth, DB, or provider access.
// A nonexistent provider would fail its validation if an unsafe request reached
// that stage, so the style error proves rejection happened before submission.
process.env.NEXT_RUNTIME = 'nodejs';
process.env.DATABASE_PROVIDER = 'postgresql';
process.env.DATABASE_URL = '';
process.env.DB_SCHEMA = 'public';

async function generate(overrides: Record<string, unknown>) {
  const { POST } = await import('./route');
  const response = await POST(
    new Request('http://localhost/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'nonexistent-test-provider',
        mediaType: 'image',
        scene: 'image-to-image',
        model: 'gpt-image-2-image-to-image',
        prompt: 'Apply an eyebrow style',
        options: { image_input: ['https://photo.invalid/photo.webp'] },
        ...overrides,
      }),
    })
  );
  return response.json();
}

for (const styleId of [undefined, null, '', '  ', 0, {}, []]) {
  test(`public photo generation rejects invalid styleId ${JSON.stringify(styleId)} before provider access`, async () => {
    assert.deepEqual(await generate({ styleId }), {
      code: -1,
      message: 'invalid styleId',
      submissionState: 'not-submitted',
    });
  });
}

test('switching to another image model cannot bypass the style requirement for photo edits', async () => {
  assert.equal(
    (await generate({ model: 'bytedance/seedream-4' })).message,
    'invalid styleId'
  );
});

test('spoofed scene and client export/queue metadata cannot unlock the brow model', async () => {
  const result = await generate({
    scene: 'text-to-image',
    options: { __browQueue: { version: 1 }, __browExport: { styleId: 'fake' } },
  });
  assert.equal(result.message, 'invalid styleId');
  assert.equal(result.submissionState, 'not-submitted');
});

for (const field of [
  'image_input',
  'input_urls',
  'image_urls',
  'brow_tint_image',
]) {
  test(`photo field ${field} cannot bypass style validation under text-to-image`, async () => {
    assert.equal(
      (
        await generate({
          scene: 'text-to-image',
          model: 'other-image-model',
          options: { [field]: ['https://photo.invalid/photo.webp'] },
        })
      ).message,
      'invalid styleId'
    );
  });
}

test('a style identifier proceeds to existing provider validation instead of granting access itself', async () => {
  assert.equal(
    (await generate({ styleId: 'requires-existing-active-db-style' })).message,
    'invalid provider'
  );
});

test('arbitrary provider option fields cannot turn the public image API into an unprotected generator', async () => {
  for (const options of [
    {},
    { image_url: 'https://photo.invalid/photo.webp' },
    { input_image: 'https://photo.invalid/photo.webp' },
    { custom_provider_input: { photo: 'https://photo.invalid/photo.webp' } },
  ]) {
    const result = await generate({
      mediaType: 'image',
      model: 'other-image-model',
      scene: 'text-to-image',
      options,
    });
    assert.equal(result.message, 'invalid styleId');
    assert.equal(result.submissionState, 'not-submitted');
  }
});

test('video and music APIs retain their existing validation path', async () => {
  for (const request of [
    { mediaType: 'video', model: 'video-model', scene: 'text-to-video' },
    { mediaType: 'music', model: 'music-model', scene: 'text-to-music' },
  ]) {
    assert.equal(
      (await generate({ ...request, options: {} })).message,
      'invalid provider'
    );
  }
});
