import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import type { AIGenerateParams } from '@/extensions/ai/types';
import type { NewAITask } from '@/shared/models/ai_task';

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

test('new brow tasks from current and older browsers enqueue Flare 1K with the same image roles and two-credit cost', async (t) => {
  // Replace only the external auth/DB/billing/queue dependencies. Exercise the
  // real route, prompt builder, image validation, and client serialization.
  const require = createRequire(import.meta.url);
  const savedModules = new Map<string, NodeModule | undefined>();
  const original = 'https://uploads.example.com/original.webp';
  const guide = 'https://uploads.example.com/guide.png';
  const thumbnail = 'https://cdn.example.com/style.webp';
  let queuedTask!: NewAITask;
  let providerParams!: AIGenerateParams;
  let priority: unknown;
  let moderatedPrompt = '';
  const style = {
    id: 'active-style',
    name: 'Soft Taupe',
    shape: 'soft arch',
    shade: 'taupe',
    intensity: 'medium',
    prompt: 'Softly tinted brows.',
    negative: '',
    thumbnail,
  };
  const query = {
    select: () => query,
    from: () => query,
    where: () => query,
    limit: async () => [style],
  };
  const replacements: Record<string, unknown> = {
    '@/core/db': { db: () => query },
    '@/shared/models/user': { getUserInfo: async () => ({ id: 'test-user' }) },
    '@/shared/models/credit': { getRemainingCredits: async () => 2 },
    '@/shared/services/ai': {
      getAIService: async () => ({
        getMediaTypes: () => ['image', 'video', 'music'],
        getProvider: (name: string) =>
          name === 'kie'
            ? { generate: () => assert.fail('brows must use the queue') }
            : undefined,
      }),
    },
    '@/shared/services/brow-entitlements': {
      getBrowEntitlements: async () => ({
        canExport: false,
        canCompare: false,
        queuePriority: 0,
      }),
    },
    '@/shared/services/moderation': {
      moderatePrompt: async ({ prompt }: { prompt: string }) => {
        moderatedPrompt = prompt;
        return { decision: 'allow' };
      },
    },
    '@/shared/services/brow-queue': {
      enqueueBrowGeneration: async (
        task: NewAITask,
        params: AIGenerateParams,
        queuePriority: 0 | 1 | 2
      ) => {
        queuedTask = task;
        providerParams = params;
        priority = queuePriority;
        return task;
      },
    },
  };
  const routePath = require.resolve('./route');
  savedModules.set(routePath, require.cache[routePath]);
  for (const [specifier, exports] of Object.entries(replacements)) {
    const path = require.resolve(specifier);
    savedModules.set(path, require.cache[path]);
    require.cache[path] = {
      id: path,
      filename: path,
      loaded: true,
      exports,
    } as NodeModule;
  }
  delete require.cache[routePath];
  t.after(() => {
    for (const [path, cached] of savedModules) {
      if (cached) require.cache[path] = cached;
      else delete require.cache[path];
    }
  });
  const { POST } = require('./route') as typeof import('./route');

  for (const { model, browMapping, preserveBrowShape } of [
    { model: 'nano-banana-pro', browMapping: true },
    { model: 'gpt-image-2-image-to-image', browMapping: true },
    { model: 'gpt-image-2-5-flare-image-to-image', browMapping: true },
    { model: 'nano-banana-pro', browMapping: false },
    {
      model: 'gpt-image-2-5-flare-image-to-image',
      browMapping: true,
      preserveBrowShape: true,
    },
    {
      model: 'gpt-image-2-5-flare-image-to-image',
      browMapping: true,
      preserveBrowShape: false,
    },
  ]) {
    const response = await POST(
      new Request('http://localhost/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'kie',
          mediaType: 'image',
          scene: 'image-to-image',
          model,
          styleId: style.id,
          browMapping,
          preserveBrowShape,
          options: {
            image_input: browMapping ? [original, guide] : [original],
            resolution: '4K',
            background: 'transparent',
            __browQueue: { spoofed: true },
            __browExport: { source: 'untrusted' },
          },
        }),
      })
    );
    const body = await response.json();
    assert.equal(body.code, 0, JSON.stringify(body));
    assert.equal(queuedTask.model, 'gpt-image-2-5-flare-image-to-image');
    assert.equal(providerParams.model, 'gpt-image-2-5-flare-image-to-image');
    assert.equal(queuedTask.provider, 'kie');
    assert.equal(queuedTask.costCredits, 2);
    assert.equal(priority, 0);
    assert.deepEqual(
      providerParams.options.image_input,
      browMapping ? [original, guide, thumbnail] : [original]
    );
    assert.equal(providerParams.options.resolution, '1K');
    assert.equal(providerParams.options.aspect_ratio, 'auto');
    assert.equal(providerParams.options.background, 'opaque');
    assert.equal(providerParams.options.__browQueue, undefined);
    assert.equal(providerParams.options.__browExport, undefined);
    assert.equal(providerParams.options.preserveBrowShape, undefined);
    if (preserveBrowShape) {
      assert.match(
        providerParams.prompt,
        /Hair density does not mean brow width/
      );
      assert.ok(!providerParams.prompt.includes(style.prompt));
    } else {
      assert.ok(providerParams.prompt.includes(style.prompt));
    }
    assert.equal(
      JSON.parse(String(queuedTask.options)).__browExport.source,
      original
    );
    assert.equal(JSON.parse(String(queuedTask.options)).resolution, '1K');
    assert.equal(moderatedPrompt, providerParams.prompt);
    if (browMapping) {
      assert.match(providerParams.prompt, /Image 1.+identity authority/i);
      assert.match(
        providerParams.prompt,
        /Image 2.+placement and contour authority/i
      );
      assert.match(providerParams.prompt, /Image 3.+appearance authority/i);
    } else {
      assert.match(
        providerParams.prompt,
        /Image 1 is the user's portrait photo\./
      );
      assert.doesNotMatch(
        providerParams.prompt,
        /confirmed brow mapping guide/i
      );
    }
    assert.equal(body.data.costCredits, 2);
    assert.equal(body.data.options, null);
  }

  for (const invalid of [
    { browMapping: true, preserveBrowShape: 'false' },
    { browMapping: true, preserveBrowShape: null },
    { browMapping: false, preserveBrowShape: true },
  ]) {
    const previousTask = queuedTask;
    const response = await POST(
      new Request('http://localhost/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'kie',
          mediaType: 'image',
          scene: 'image-to-image',
          model: 'gpt-image-2-5-flare-image-to-image',
          styleId: style.id,
          options: { image_input: [original, guide] },
          ...invalid,
        }),
      })
    );
    const body = await response.json();
    assert.equal(body.code, -1);
    assert.equal(body.submissionState, 'not-submitted');
    assert.match(body.message, /preserveBrowShape must be a boolean/);
    assert.equal(
      queuedTask,
      previousTask,
      'invalid choice must not enqueue or charge'
    );
  }
});
