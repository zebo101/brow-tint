import assert from 'node:assert/strict';
import test from 'node:test';

import { KieProvider } from './kie';
import { AIMediaType, AIProvider, AITaskStatus } from './types';

test('historical Kie image tasks still query their existing task IDs after the model upgrade', async (t) => {
  const provider: AIProvider = new KieProvider({ apiKey: 'test-key' });
  for (const model of [
    'nano-banana-pro',
    'gpt-image-2-image-to-image',
    'gpt-image-2-5-flare-image-to-image',
  ]) {
    const taskId = `existing-${model}`;
    t.mock.method(
      globalThis,
      'fetch',
      async (url: string, init: RequestInit) => {
        assert.equal(
          url,
          `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`
        );
        assert.equal(init.method, 'GET');
        return Response.json({
          code: 200,
          data: {
            state: 'success',
            createTime: 1789192800000,
            resultJson: JSON.stringify({
              resultUrls: ['https://example.com/result.webp'],
            }),
          },
        });
      }
    );
    const result = await provider.query!({
      taskId,
      model,
      mediaType: AIMediaType.IMAGE,
    });
    assert.equal(result.taskStatus, AITaskStatus.SUCCESS);
    assert.equal(result.taskId, taskId);
    assert.equal(
      result.taskInfo?.images?.[0].imageUrl,
      'https://example.com/result.webp'
    );
    t.mock.restoreAll();
  }
});

test('KieProvider sends Flare 2.5 with 1K and the original, guide, and style in exact order', async (t) => {
  let requestBody: unknown;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://api.kie.ai/api/v1/jobs/createTask');
    requestBody = JSON.parse(String(init.body));
    return Response.json({ code: 200, data: { taskId: 'flare-task' } });
  });

  const result = await new KieProvider({ apiKey: 'test-key' }).generate({
    params: {
      mediaType: AIMediaType.IMAGE,
      model: 'gpt-image-2-5-flare-image-to-image',
      prompt: 'Preserve identity and apply the confirmed brow mapping.',
      callbackUrl: 'https://browlens.com/api/ai/notify/kie',
      options: {
        image_input: [
          'https://example.com/original.webp',
          'https://example.com/guide.png',
          'https://example.com/style.webp',
        ],
        resolution: '1K',
        aspect_ratio: 'auto',
        background: 'opaque',
        nsfw_checker: true,
        output_format: 'png',
      },
    },
  });

  assert.equal(result.taskId, 'flare-task');
  assert.deepEqual(requestBody, {
    model: 'gpt-image-2-5-flare-image-to-image',
    callBackUrl: 'https://browlens.com/api/ai/notify/kie',
    input: {
      prompt: 'Preserve identity and apply the confirmed brow mapping.',
      input_urls: [
        'https://example.com/original.webp',
        'https://example.com/guide.png',
        'https://example.com/style.webp',
      ],
      resolution: '1K',
      aspect_ratio: 'auto',
      background: 'opaque',
    },
  });
});

test('Flare accepts native input_urls and defaults to 1K without legacy nsfw_checker', async (t) => {
  let input: unknown;
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: string, init: RequestInit) => {
      input = JSON.parse(String(init.body)).input;
      return Response.json({ code: 200, data: { taskId: 'flare-default' } });
    }
  );
  await new KieProvider({ apiKey: 'test-key' }).generateImage({
    params: {
      mediaType: AIMediaType.IMAGE,
      model: 'gpt-image-2-5-flare-image-to-image',
      prompt: 'Edit the brows.',
      options: { input_urls: ['https://example.com/original.webp'] },
    },
  });
  assert.deepEqual(input, {
    prompt: 'Edit the brows.',
    input_urls: ['https://example.com/original.webp'],
    aspect_ratio: 'auto',
    resolution: '1K',
    background: 'auto',
  });
});

test('KieProvider sends GPT Image 2 image-to-image requests using the input_urls schema', async () => {
  const provider = new KieProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.kie.ai/api/v1',
  });

  const originalFetch = global.fetch;
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;

    return new Response(
      JSON.stringify({
        code: 200,
        msg: 'success',
        data: {
          taskId: 'task-123',
          recordId: 'task-123',
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }) as typeof fetch;

  try {
    const result = await provider.generate({
      params: {
        mediaType: AIMediaType.IMAGE,
        model: 'gpt-image-2-image-to-image',
        prompt: 'take a photo with Sam Altman in the conference room',
        callbackUrl: 'https://your-domain.com/api/callback',
        options: {
          image_input: ['https://example.com/source.png'],
          brow_tint_image: 'https://example.com/eyebrow-reference.png',
          aspect_ratio: 'auto',
          nsfw_checker: true,
        },
      },
    });

    assert.equal(result.taskStatus, AITaskStatus.PENDING);
    assert.equal(result.taskId, 'task-123');
    assert.equal(capturedUrl, 'https://api.kie.ai/api/v1/jobs/createTask');
    assert.equal(capturedInit?.method, 'POST');

    const body = JSON.parse(String(capturedInit?.body));

    assert.equal(body.model, 'gpt-image-2-image-to-image');
    assert.equal(body.callBackUrl, 'https://your-domain.com/api/callback');
    assert.equal(
      body.input.prompt,
      'take a photo with Sam Altman in the conference room'
    );
    assert.deepEqual(body.input.input_urls, [
      'https://example.com/source.png',
      'https://example.com/eyebrow-reference.png',
    ]);
    assert.equal(body.input.aspect_ratio, 'auto');
    assert.equal(body.input.nsfw_checker, true);
    assert.equal(body.input.image_urls, undefined);
    assert.equal(body.input.image_input, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test('KieProvider defaults GPT Image 2 requests to auto aspect ratio and nsfw checking', async () => {
  const provider = new KieProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.kie.ai/api/v1',
  });

  const originalFetch = global.fetch;
  let capturedInit: RequestInit | undefined;

  global.fetch = (async (
    _input: string | URL | Request,
    init?: RequestInit
  ) => {
    capturedInit = init;

    return new Response(
      JSON.stringify({
        code: 200,
        msg: 'success',
        data: {
          taskId: 'task-456',
          recordId: 'task-456',
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }) as typeof fetch;

  try {
    await provider.generate({
      params: {
        mediaType: AIMediaType.IMAGE,
        model: 'gpt-image-2-text-to-image',
        prompt: 'studio portrait with a modern fade haircut',
        callbackUrl: 'https://your-domain.com/api/callback',
      },
    });

    const body = JSON.parse(String(capturedInit?.body));

    assert.equal(body.input.aspect_ratio, 'auto');
    assert.equal(body.input.nsfw_checker, true);
    assert.equal(body.input.input_urls, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});
