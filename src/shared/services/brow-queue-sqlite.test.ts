import assert from 'node:assert/strict';
import test from 'node:test';

// Use the actual production libsql driver and SQLite table definitions. No
// production URL, credentials, provider request, or external service is used.
test('Turso queue uses real libsql write transactions', async (t) => {
  process.env.NEXT_RUNTIME = 'nodejs';
  process.env.DATABASE_PROVIDER = 'turso';
  process.env.DATABASE_URL = 'file::memory:?cache=shared';
  process.env.DATABASE_AUTH_TOKEN = '';
  const { createClient } = await import('@libsql/client');
  const { drizzle } = await import('drizzle-orm/libsql');
  const { eq } = await import('drizzle-orm');
  const { aiTask, credit } = await import('@/config/db/schema');
  const { createBrowQueueStore } = await import('./brow-queue-store');
  const { runBrowQueueAction } = await import('./brow-queue-engine');
  const { AIMediaType } = await import('@/extensions/ai/types');
  const client = createClient({ url: 'file::memory:?cache=shared' });
  const database = drizzle(client);
  await client.executeMultiple(`
    CREATE TABLE ai_task (id text PRIMARY KEY, user_id text NOT NULL, media_type text NOT NULL, provider text NOT NULL,
      model text NOT NULL, prompt text NOT NULL, options text, status text NOT NULL,
      created_at integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
      updated_at integer NOT NULL, deleted_at integer, task_id text, task_info text, task_result text,
      cost_credits integer NOT NULL DEFAULT 0, scene text NOT NULL DEFAULT '', credit_id text);
    CREATE TABLE credit (id text PRIMARY KEY, user_id text NOT NULL, user_email text, order_no text, subscription_no text,
      transaction_no text UNIQUE NOT NULL, transaction_type text NOT NULL, transaction_scene text,
      credits integer NOT NULL, remaining_credits integer NOT NULL DEFAULT 0, description text, expires_at integer,
      status text NOT NULL, created_at integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
      updated_at integer NOT NULL, deleted_at integer, consumed_detail text, metadata text);
  `);
  const params = {
    mediaType: AIMediaType.IMAGE,
    prompt: 'validated prompt',
    model: 'nano-banana-pro',
  };
  const newTask = (id: string) => ({
    id,
    userId: 'u',
    mediaType: 'image',
    provider: 'kie',
    model: 'nano-banana-pro',
    prompt: '',
    scene: 'image-to-image',
    status: 'pending',
    costCredits: 2,
  });
  const grant = (amount: number) =>
    database
      .insert(credit)
      .values({
        id: 'grant',
        userId: 'u',
        transactionNo: 'grant',
        transactionType: 'grant',
        status: 'active',
        credits: amount,
        remainingCredits: amount,
      });
  const reset = () =>
    client.executeMultiple('DELETE FROM ai_task; DELETE FROM credit;');
  const balance = async () =>
    Number(
      (
        await client.execute(
          "SELECT coalesce(sum(remaining_credits),0) AS balance FROM credit WHERE transaction_type='grant'"
        )
      ).rows[0].balance
    );
  const readTask = async (id: string) =>
    (await database.select().from(aiTask).where(eq(aiTask.id, id)))[0];
  const setMetadata = async (id: string, patch: object) => {
    const row = await readTask(id);
    const options = JSON.parse(row.options);
    options.__browQueue = { ...options.__browQueue, ...patch };
    await database
      .update(aiTask)
      .set({ options: JSON.stringify(options) })
      .where(eq(aiTask.id, id));
  };
  try {
    await t.test(
      'enqueue atomically records a durable job and reserves exactly 2 credits',
      async () => {
        await reset();
        await grant(2);
        const queue = createBrowQueueStore(database);
        const queued = await queue.enqueue(newTask('a'), params, 1);
        assert.equal(queued.status, 'pending');
        assert.equal(queued.taskId, null);
        assert.ok(queued.creditId);
        assert.ok(queued.createdAt instanceof Date);
        assert.equal(await balance(), 0);
        await assert.rejects(
          queue.enqueue(newTask('b'), params, 2),
          /insufficient credits/i
        );
        assert.equal(await readTask('b'), undefined);
        assert.equal((await database.select().from(aiTask)).length, 1);
      }
    );
    await t.test(
      'tier order and admission FIFO survive separate store instances without preemption',
      async () => {
        await reset();
        await grant(10);
        const queue = createBrowQueueStore(database);
        await queue.enqueue(newTask('free-active'), params, 0);
        const active = (await queue.claim())!;
        await queue.enqueue(newTask('basic'), params, 1);
        await queue.enqueue(newTask('z-premium-first'), params, 2);
        await queue.enqueue(newTask('a-premium-second'), params, 2);
        await queue.enqueue(newTask('free-waiting'), params, 0);
        const restarted = createBrowQueueStore(database);
        assert.equal(await restarted.claim(), undefined);
        await queue.complete(active, {
          status: 'success',
          taskId: 'provider-active',
        });
        const winners: string[] = [];
        for (let i = 0; i < 4; i++) {
          const next = (await restarted.claim())!;
          winners.push(next.task.id);
          assert.equal(await queue.claim(), undefined);
          await restarted.complete(next, {
            status: 'success',
            taskId: `provider-${i}`,
          });
        }
        assert.deepEqual(winners, [
          'z-premium-first',
          'a-premium-second',
          'basic',
          'free-waiting',
        ]);
        assert.equal(await balance(), 0);
      }
    );
    await t.test(
      'simultaneous local enqueue/claims cannot double spend or claim the same task',
      async () => {
        await reset();
        await grant(2);
        const one = createBrowQueueStore(database);
        const two = createBrowQueueStore(database);
        const enqueues = await Promise.allSettled([
          one.enqueue(newTask('a'), params, 1),
          two.enqueue(newTask('b'), params, 2),
        ]);
        assert.equal(
          enqueues.filter((result) => result.status === 'fulfilled').length,
          1
        );
        assert.equal(await balance(), 0);
        const claims = await Promise.all([one.claim(), two.claim()]);
        assert.equal(claims.filter(Boolean).length, 1);
        await one.complete(claims.find(Boolean)!, { status: 'failed' });
        await two.complete(claims.find(Boolean)!, { status: 'failed' });
        assert.equal(await balance(), 2);
      }
    );
    await t.test(
      'independent libsql connections use the database write lock for claim exclusion',
      async () => {
        await reset();
        await grant(2);
        const otherClient = createClient({ url: 'file::memory:?cache=shared' });
        try {
          const one = createBrowQueueStore(database);
          const two = createBrowQueueStore(drizzle(otherClient));
          await one.enqueue(newTask('a'), params, 1);
          const attempts = await Promise.allSettled([one.claim(), two.claim()]);
          const claims = attempts.flatMap((result) =>
            result.status === 'fulfilled' && result.value ? [result.value] : []
          );
          assert.equal(claims.length, 1);
          // Local SQLite may report a busy writer rather than wait; the worker's
          // next tick safely observes the persisted claim after the writer commits.
          for (const result of attempts)
            if (result.status === 'rejected')
              assert.match(String(result.reason), /busy|locked/i);
          assert.equal(await one.claim(), undefined);
          assert.equal(await two.claim(), undefined);
          await one.complete(claims[0], { status: 'failed' });
          await two.complete(claims[0], { status: 'failed' });
          assert.equal(await balance(), 2);
        } finally {
          otherClient.close();
        }
      }
    );
    await t.test(
      'restart polls known provider ID; abandoned submissions refund once and reject late worker writes',
      async () => {
        await reset();
        await grant(4);
        const queue = createBrowQueueStore(database);
        await queue.enqueue(newTask('known'), params, 0);
        const submit = (await queue.claim())!;
        await queue.complete(submit, {
          status: 'processing',
          taskId: 'provider-known',
          metadata: { ...submit.task.metadata, phase: 'submitted' },
        });
        await setMetadata('known', { leaseUntil: 0, nextPollAt: 0 });
        const restart = createBrowQueueStore(database);
        const poll = (await restart.claim())!;
        assert.equal(poll.kind, 'poll');
        assert.equal(poll.task.taskId, 'provider-known');
        await restart.complete(poll, { status: 'success' });
        await queue.enqueue(newTask('unknown'), params, 2);
        const lost = (await queue.claim())!;
        await setMetadata('unknown', { leaseUntil: 0 });
        const recovery = (await restart.claim())!;
        assert.equal(recovery.kind, 'fail-unknown');
        await queue.complete(lost, {
          status: 'success',
          taskId: 'late-provider',
        });
        assert.equal((await readTask('unknown')).taskId, null);
        const failed = await runBrowQueueAction(
          recovery,
          undefined,
          recovery.now
        );
        await restart.complete(recovery, failed);
        await restart.complete(recovery, failed);
        assert.equal(await balance(), 2);
        assert.equal((await readTask('unknown')).status, 'failed');
        assert.equal(await restart.claim(), undefined);
      }
    );
    await t.test(
      'public enqueueBrowGeneration uses the Turso accessor and starts its worker',
      async () => {
        await reset();
        await grant(4);
        // A live persisted lease keeps the startup worker away from any provider
        // while exercising the unmodified production enqueue/startup wrapper.
        const queue = createBrowQueueStore(database);
        await queue.enqueue(newTask('active'), params, 0);
        await queue.claim();
        const { enqueueBrowGeneration } = await import('./brow-queue');
        const messages: string[] = [];
        const info = t.mock.method(console, 'info', (message: string) =>
          messages.push(message)
        );
        const queued = await enqueueBrowGeneration(
          newTask('through-public-service'),
          params,
          2
        );
        const state = (globalThis as any).__browQueueWorker;
        try {
          assert.equal(queued.status, 'pending');
          assert.ok(queued.creditId);
          assert.equal(await balance(), 0);
          assert.equal(
            (await readTask('through-public-service')).status,
            'pending'
          );
          assert.ok(state.timer);
          assert.equal(typeof state.database.run, 'function');
          assert.deepEqual(messages, ['[brow-queue] Worker started (turso).']);
        } finally {
          clearInterval(state.timer);
          while (state.running)
            await new Promise((resolve) => setTimeout(resolve, 5));
          state.database.$client?.close();
          info.mock.restore();
        }
      }
    );
  } finally {
    client.close();
  }
});
