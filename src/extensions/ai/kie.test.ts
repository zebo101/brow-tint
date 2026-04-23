import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType, AITaskStatus } from './types';
import { KieProvider } from './kie';

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
          hairstyle_image: 'https://example.com/hairstyle.png',
          aspect_ratio: 'auto',
          nsfw_checker: true,
        },
      },
    });

    assert.equal(result.taskStatus, AITaskStatus.PENDING);
    assert.equal(result.taskId, 'task-123');
    assert.equal(
      capturedUrl,
      'https://api.kie.ai/api/v1/jobs/createTask'
    );
    assert.equal(capturedInit?.method, 'POST');

    const body = JSON.parse(String(capturedInit?.body));

    assert.equal(body.model, 'gpt-image-2-image-to-image');
    assert.equal(
      body.callBackUrl,
      'https://your-domain.com/api/callback'
    );
    assert.equal(
      body.input.prompt,
      'take a photo with Sam Altman in the conference room'
    );
    assert.deepEqual(body.input.input_urls, [
      'https://example.com/source.png',
      'https://example.com/hairstyle.png',
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

  global.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
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
