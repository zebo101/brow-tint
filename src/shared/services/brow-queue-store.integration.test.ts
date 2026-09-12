import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';

// Optional isolated PostgreSQL-in-WASM runtime; never connects to DATABASE_URL.
// npm install --prefix <temp-dir> @electric-sql/pglite
// BROW_QUEUE_PGLITE_PATH=<temp-dir>/node_modules/@electric-sql/pglite
const runtimePath = process.env.BROW_QUEUE_PGLITE_PATH;

test(
  'durable queue and atomic credit accounting (isolated PostgreSQL)',
  { skip: !runtimePath },
  async (t) => {
    process.env.NEXT_RUNTIME = 'nodejs';
    process.env.DATABASE_PROVIDER = 'postgresql';
    process.env.DB_SCHEMA = 'public';
    process.env.DATABASE_URL = 'postgres://unused-isolated-test';
    const require = createRequire(import.meta.url);
    process.env.NODE_PATH = resolve(runtimePath!, '../..');
    require('node:module').Module._initPaths();
    const { PGlite } = require(runtimePath!);
    const { drizzle } = require('drizzle-orm/pglite');
    const { aiTask, credit } = await import('@/config/db/schema');
    const { createAITask, updateAITaskById } = await import(
      '@/shared/models/ai_task'
    );
    const { createBrowQueueStore } = await import('./brow-queue-store');
    const { runBrowQueueAction, readBrowQueueMetadata } = await import(
      './brow-queue-engine'
    );
    const { AIMediaType } = await import('@/extensions/ai/types');
    const { getAllConfigs } = await import('@/shared/models/config');
    const { eq } = await import('drizzle-orm');
    const pg = new PGlite();
    const database = drizzle(pg);
    await pg.exec(`
    CREATE TABLE config (name text PRIMARY KEY, value text);
    CREATE TABLE ai_task (id text PRIMARY KEY, user_id text NOT NULL, media_type text NOT NULL, provider text NOT NULL,
      model text NOT NULL, prompt text NOT NULL, options text, status text NOT NULL, created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp NOT NULL, deleted_at timestamp, task_id text, task_info text, task_result text,
      cost_credits integer NOT NULL DEFAULT 0, scene text NOT NULL DEFAULT '', credit_id text);
    CREATE TABLE credit (id text PRIMARY KEY, user_id text NOT NULL, user_email text, order_no text, subscription_no text,
      transaction_no text UNIQUE NOT NULL, transaction_type text NOT NULL, transaction_scene text,
      credits integer NOT NULL, remaining_credits integer NOT NULL DEFAULT 0, description text, expires_at timestamp,
      status text NOT NULL, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp NOT NULL,
      deleted_at timestamp, consumed_detail text, metadata text);
  `);
    const newTask = (id: string, costCredits = 2) => ({
      id,
      userId: 'u',
      mediaType: 'image',
      provider: 'kie',
      model: 'nano-banana-pro',
      prompt: '',
      scene: 'image-to-image',
      status: 'pending',
      costCredits,
    });
    const reset = () => pg.exec('TRUNCATE ai_task, credit');
    const grant = async (id: string, amount: number) =>
      database
        .insert(credit)
        .values({
          id,
          userId: 'u',
          transactionNo: id,
          transactionType: 'grant',
          status: 'active',
          credits: amount,
          remainingCredits: amount,
        });
    const balance = async () =>
      Number(
        (
          await pg.query(
            "SELECT coalesce(sum(remaining_credits), 0) AS n FROM credit WHERE transaction_type = 'grant'"
          )
        ).rows[0].n
      );

    try {
      await t.test(
        'worker configuration retains database values when Next request cache is unavailable',
        async () => {
          await pg.exec(
            "INSERT INTO config VALUES ('kie_api_key', 'isolated-test-key'), ('kie_base_url', 'https://isolated.invalid'), ('r2_bucket_name', 'isolated-test-bucket')"
          );
          const configs = await getAllConfigs({ database });
          assert.equal(configs.kie_api_key, 'isolated-test-key');
          assert.equal(configs.kie_base_url, 'https://isolated.invalid');
          assert.equal(configs.r2_bucket_name, 'isolated-test-bucket');
          const direct = await getAllConfigs({ useCache: false, database });
          assert.equal(direct.kie_api_key, 'isolated-test-key');
        }
      );
      await t.test(
        'failed creation rolls back its task and all partial credit consumption',
        async () => {
          await reset();
          await grant('g', 1);
          await assert.rejects(
            database.transaction((tx: any) => createAITask(newTask('a'), tx)),
            /insufficient credits/i
          );
          assert.equal((await database.select().from(aiTask)).length, 0);
          assert.equal(await balance(), 1);
        }
      );
      await t.test(
        'concurrent reservations cannot spend the final 2 credits twice',
        async () => {
          await reset();
          await grant('g', 2);
          const results = await Promise.allSettled(
            ['a', 'b'].map((id) =>
              database.transaction((tx: any) => createAITask(newTask(id), tx))
            )
          );
          assert.equal(
            results.filter((result) => result.status === 'fulfilled').length,
            1
          );
          assert.equal(await balance(), 0);
          assert.equal((await database.select().from(aiTask)).length, 1);
        }
      );
      await t.test(
        'concurrent failures refund once, and a stale success cannot overwrite the refund',
        async () => {
          await reset();
          await grant('g', 2);
          const created = await database.transaction((tx: any) =>
            createAITask(newTask('a'), tx)
          );
          await Promise.all(
            [1, 2].map(() =>
              database.transaction((tx: any) =>
                updateAITaskById(
                  'a',
                  { status: 'failed', creditId: created.creditId },
                  tx
                )
              )
            )
          );
          assert.equal(await balance(), 2);
          const stale = await database.transaction((tx: any) =>
            updateAITaskById('a', { status: 'success' }, tx)
          );
          assert.equal(stale.status, 'failed');
          assert.equal(await balance(), 2);
        }
      );
      await t.test(
        'reservation consumes more than ten small grants without losing a batch',
        async () => {
          await reset();
          for (let i = 0; i < 12; i++) await grant(`g-${i}`, 1);
          await database.transaction((tx: any) =>
            createAITask(newTask('a', 12), tx)
          );
          assert.equal(await balance(), 0);
          const [row] = await database
            .select()
            .from(credit)
            .where(eq(credit.transactionType, 'consume'));
          assert.equal(JSON.parse(row.consumedDetail).length, 12);
        }
      );
      await t.test(
        'competing claims admit one job, obey tiers/FIFO, and preserve an active free job',
        async () => {
          await reset();
          await grant('g', 10);
          const queue = createBrowQueueStore(database);
          const params = {
            mediaType: AIMediaType.IMAGE,
            prompt: 'validated',
            model: 'nano-banana-pro',
          };
          await queue.enqueue(newTask('free'), params, 0);
          const free = await queue.claim();
          assert.equal(free?.task.id, 'free');
          await queue.enqueue(newTask('basic'), params, 1);
          await queue.enqueue(newTask('premium-old'), params, 2);
          await queue.enqueue(newTask('premium-new'), params, 2);
          await queue.enqueue(newTask('free-new'), params, 0);
          assert.equal(await queue.claim(), undefined);
          await queue.complete(free!, {
            status: 'success',
            taskId: 'provider-free',
          });
          const winners: string[] = [];
          for (let i = 0; i < 4; i++) {
            const claims = await Promise.all([queue.claim(), queue.claim()]);
            const [claim] = claims.filter(Boolean);
            assert.equal(claims.filter(Boolean).length, 1);
            winners.push(claim!.task.id);
            await queue.complete(claim!, {
              status: 'success',
              taskId: `provider-${i}`,
            });
          }
          assert.deepEqual(winners, [
            'premium-old',
            'premium-new',
            'basic',
            'free-new',
          ]);
          assert.equal(await balance(), 0);
        }
      );
      await t.test(
        'restart polls the known provider ID; expired unknown submission refunds once and rejects late writes',
        async () => {
          await reset();
          await grant('g', 4);
          const params = {
            mediaType: AIMediaType.IMAGE,
            prompt: 'validated',
            model: 'nano-banana-pro',
          };
          const firstProcess = createBrowQueueStore(database);
          await firstProcess.enqueue(newTask('known'), params, 0);
          const submission = (await firstProcess.claim())!;
          await firstProcess.complete(submission, {
            status: 'processing',
            taskId: 'provider-known',
            metadata: {
              ...submission.task.metadata,
              phase: 'submitted',
              leaseUntil: 0,
              nextPollAt: 0,
            },
          });
          let [known] = await database
            .select()
            .from(aiTask)
            .where(eq(aiTask.id, 'known'));
          const knownOptions = JSON.parse(known.options);
          knownOptions.__browQueue.nextPollAt = 0;
          await database
            .update(aiTask)
            .set({ options: JSON.stringify(knownOptions) })
            .where(eq(aiTask.id, 'known'));
          const restarted = createBrowQueueStore(database);
          const poll = (await restarted.claim())!;
          assert.equal(poll.kind, 'poll');
          assert.equal(poll.task.taskId, 'provider-known');
          await restarted.complete(poll, { status: 'success' });
          await firstProcess.enqueue(newTask('unknown'), params, 2);
          const lostWorker = (await firstProcess.claim())!;
          const [unknown] = await database
            .select()
            .from(aiTask)
            .where(eq(aiTask.id, 'unknown'));
          const unknownOptions = JSON.parse(unknown.options);
          unknownOptions.__browQueue.leaseUntil = 0;
          await database
            .update(aiTask)
            .set({ options: JSON.stringify(unknownOptions) })
            .where(eq(aiTask.id, 'unknown'));
          const recovery = (await restarted.claim())!;
          assert.equal(recovery.kind, 'fail-unknown');
          // A previous worker's late response cannot win after a new claim token.
          const ignored = await firstProcess.complete(lostWorker, {
            status: 'success',
            taskId: 'late-provider-id',
          });
          assert.equal(ignored.status, 'processing');
          assert.equal(ignored.taskId, null);
          assert.equal(
            readBrowQueueMetadata(ignored.options)!.claimToken,
            recovery.task.metadata.claimToken
          );
          await restarted.complete(
            recovery,
            await runBrowQueueAction(recovery, undefined, recovery.now)
          );
          await restarted.complete(recovery, { status: 'failed' });
          assert.equal(await balance(), 2);
          assert.equal(
            (
              await database
                .select()
                .from(aiTask)
                .where(eq(aiTask.id, 'unknown'))
            )[0].status,
            'failed'
          );
          assert.equal(await restarted.claim(), undefined);
        }
      );
    } finally {
      await pg.close();
    }
  }
);
