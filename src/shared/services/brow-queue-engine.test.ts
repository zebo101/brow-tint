import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType } from '@/extensions/ai/types';

import {
  chooseBrowQueueAction,
  runBrowQueueAction,
  type BrowQueueTask,
} from './brow-queue-engine';

function task(
  id: string,
  priority: 0 | 1 | 2,
  order: string,
  overrides: Partial<BrowQueueTask> = {}
): BrowQueueTask {
  return {
    id,
    status: 'pending',
    taskId: null,
    metadata: {
      version: 1,
      priority,
      order,
      phase: 'waiting',
      params: {
        mediaType: AIMediaType.IMAGE,
        model: 'nano-banana-pro',
        prompt: 'validated prompt',
        options: { image_input: ['photo'] },
      },
    },
    ...overrides,
  };
}

test('waiting premium precedes basic/free, same tier keeps admission order', () => {
  const jobs = [
    task('free', 0, '01'),
    task('basic', 1, '02'),
    task('premium-new', 2, '04'),
    task('premium-old', 2, '03'),
  ];
  const picked: string[] = [];
  while (jobs.length) {
    const action = chooseBrowQueueAction(jobs, 1_000)!;
    picked.push(action.task.id);
    jobs.splice(
      jobs.findIndex((job) => job.id === action.task.id),
      1
    );
  }
  assert.deepEqual(picked, ['premium-old', 'premium-new', 'basic', 'free']);
});

test('active free generation is never preempted by a waiting premium job', () => {
  const active = task('active-free', 0, '01');
  active.metadata = {
    ...active.metadata,
    phase: 'submitted',
    nextPollAt: 2_000,
    startedAt: 100,
  };
  active.taskId = 'provider-1';
  assert.equal(
    chooseBrowQueueAction([task('premium', 2, '02'), active], 1_000),
    undefined
  );
});

test('restart resumes provider polling without another submission', () => {
  const active = task('known', 0, '01', { taskId: 'provider-1' });
  active.metadata = {
    ...active.metadata,
    phase: 'submitted',
    nextPollAt: 0,
    startedAt: 100,
  };
  assert.equal(chooseBrowQueueAction([active], 1_000)?.kind, 'poll');
});

test('abandoned unknown submission fails after lease and is never resubmitted', () => {
  const active = task('unknown', 0, '01');
  active.metadata = {
    ...active.metadata,
    phase: 'submitting',
    leaseUntil: 2_000,
    startedAt: 100,
  };
  assert.equal(chooseBrowQueueAction([active], 1_999), undefined);
  assert.equal(chooseBrowQueueAction([active], 2_000)?.kind, 'fail-unknown');
});

test('poll lease blocks concurrent pollers until lease expires', () => {
  const active = task('known', 1, '01', { taskId: 'provider-1' });
  active.metadata = {
    ...active.metadata,
    phase: 'submitted',
    nextPollAt: 0,
    startedAt: 100,
    leaseUntil: 2_000,
  };
  assert.equal(chooseBrowQueueAction([active], 1_000), undefined);
  assert.equal(chooseBrowQueueAction([active], 2_000)?.kind, 'poll');
});

test('terminal records cannot block next queued generation', () => {
  assert.equal(
    chooseBrowQueueAction(
      [task('done', 2, '01', { status: 'success' }), task('next', 0, '02')],
      1_000
    )?.task.id,
    'next'
  );
});

test('submission exception becomes one failed outcome with no automatic retry', async () => {
  const active = task('unknown', 0, '01');
  const result = await runBrowQueueAction(
    { kind: 'submit', task: active },
    {
      generate: async () => {
        throw new Error('transport lost after provider accepted');
      },
      query: async () => {
        throw new Error('must not query without ID');
      },
    },
    1_000
  );
  assert.equal(result.status, 'failed');
  assert.equal(result.taskInfo?.errorCode, 'queue_submission_unknown');
  assert.equal(result.taskId, undefined);
});

test('poll transport error preserves known ID and retries only query', async () => {
  const active = task('known', 0, '01', { taskId: 'provider-1' });
  active.metadata = { ...active.metadata, phase: 'submitted', startedAt: 100 };
  const result = await runBrowQueueAction(
    { kind: 'poll', task: active },
    {
      generate: async () => {
        throw new Error('must not submit twice');
      },
      query: async () => {
        throw new Error('temporary connection issue');
      },
    },
    1_000
  );
  assert.equal(result.status, 'processing');
  assert.equal(result.metadata?.phase, 'submitted');
  assert.ok(result.metadata!.nextPollAt! > 1_000);
});

test('the stored validated prompt/options reach provider unchanged; failure is refundable', async () => {
  const active = task('new', 1, '01');
  const result = await runBrowQueueAction(
    { kind: 'submit', task: active },
    {
      generate: async ({ params }) => {
        assert.deepEqual(params, {
          mediaType: 'image',
          model: 'nano-banana-pro',
          prompt: 'validated prompt',
          options: { image_input: ['photo'] },
        });
        return {
          taskId: 'provider-1',
          taskStatus: 'failed',
          taskInfo: { errorMessage: 'rejected' },
        };
      },
    },
    1_000
  );
  assert.equal(result.status, 'failed');
  assert.equal(result.taskId, 'provider-1');
});

test('a known provider job that never finishes becomes refundable instead of blocking the queue forever', () => {
  const active = task('stuck', 0, '01', { taskId: 'provider-1' });
  active.metadata = {
    ...active.metadata,
    phase: 'submitted',
    startedAt: 0,
    nextPollAt: 0,
  };
  assert.equal(
    chooseBrowQueueAction([active, task('waiting', 2, '02')], 30 * 60_000)
      ?.kind,
    'fail-timeout'
  );
});

test('a hung submission expires without making a second provider POST', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = runBrowQueueAction(
    { kind: 'submit', task: task('hung', 0, '01') },
    {
      generate: async () => new Promise(() => {}),
    },
    1_000
  );
  t.mock.timers.tick(90_000);
  const result = await pending;
  assert.equal(result.status, 'failed');
  assert.equal(result.taskInfo.errorCode, 'queue_submission_unknown');
});
