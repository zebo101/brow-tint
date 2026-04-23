import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType, AITaskStatus } from '@/extensions/ai';

import { extractAITaskId, handleAINotify } from './handler';

test('extractAITaskId supports Kie callback payload shapes', () => {
  assert.equal(extractAITaskId({ taskId: 'task-1' }), 'task-1');
  assert.equal(extractAITaskId({ recordId: 'task-2' }), 'task-2');
  assert.equal(extractAITaskId({ data: { taskId: 'task-3' } }), 'task-3');
  assert.equal(extractAITaskId({ data: { recordId: 'task-4' } }), 'task-4');
  assert.equal(extractAITaskId({}), undefined);
});

test('handleAINotify refreshes the provider task and updates the local AI task', async () => {
  let updatedTask:
    | {
        id: string;
        update: Record<string, unknown>;
      }
    | undefined;

  const result = await handleAINotify({
    provider: 'kie',
    payload: {
      data: {
        taskId: 'provider-task-123',
      },
    },
    deps: {
      findAITaskByProviderTaskId: async ({ provider, taskId }) => {
        assert.equal(provider, 'kie');
        assert.equal(taskId, 'provider-task-123');

        return {
          id: 'local-task-1',
          taskId: 'provider-task-123',
          mediaType: AIMediaType.IMAGE,
          provider: 'kie',
          model: 'gpt-image-2-image-to-image',
          status: AITaskStatus.PENDING,
          taskInfo: null,
          taskResult: null,
          creditId: 'credit-1',
        };
      },
      getAIService: async () => ({
        getProvider: (name: string) => {
          assert.equal(name, 'kie');

          return {
            query: async ({
              taskId,
              mediaType,
              model,
            }: {
              taskId: string;
              mediaType?: string;
              model?: string;
            }) => {
              assert.equal(taskId, 'provider-task-123');
              assert.equal(mediaType, AIMediaType.IMAGE);
              assert.equal(model, 'gpt-image-2-image-to-image');

              return {
                taskStatus: AITaskStatus.SUCCESS,
                taskId,
                taskInfo: {
                  status: 'success',
                  images: [{ imageUrl: 'https://example.com/result.png' }],
                },
                taskResult: {
                  resultJson:
                    '{"resultUrls":["https://example.com/result.png"]}',
                },
              };
            },
          };
        },
      }),
      updateAITaskById: async (id, update) => {
        updatedTask = { id, update };
        return undefined;
      },
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'success');
  assert.deepEqual(updatedTask, {
    id: 'local-task-1',
    update: {
      status: AITaskStatus.SUCCESS,
      taskInfo:
        '{"status":"success","images":[{"imageUrl":"https://example.com/result.png"}]}',
      taskResult:
        '{"resultJson":"{\\"resultUrls\\":[\\"https://example.com/result.png\\"]}"}',
      creditId: 'credit-1',
    },
  });
});

test('handleAINotify ignores callbacks when the task does not exist locally', async () => {
  const result = await handleAINotify({
    provider: 'kie',
    payload: {
      data: {
        taskId: 'missing-task',
      },
    },
    deps: {
      findAITaskByProviderTaskId: async () => undefined,
      getAIService: async () => {
        throw new Error('should not be called');
      },
      updateAITaskById: async () => {
        throw new Error('should not be called');
      },
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.ignored, true);
});
