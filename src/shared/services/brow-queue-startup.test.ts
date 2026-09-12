import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

for (const [name, phase, databaseUrl] of [
  ['empty database URL', '', ''],
  [
    'production build',
    'phase-production-build',
    'postgres://must-never-connect.invalid/test',
  ],
]) {
  test(`instrumentation does not start a worker for ${name}`, () => {
    const result = spawnSync(
      process.execPath,
      [
        resolve('node_modules/tsx/dist/cli.mjs'),
        '-e',
        `
      const assert = require('node:assert/strict');
      const { register } = require('./src/instrumentation.ts');
      register().then(() => {
        assert.equal(globalThis.__browQueueWorker?.timer, undefined);
        assert.equal(globalThis.__browQueueWorker?.store, undefined);
        console.log('startup guard passed');
      }).catch((error) => { console.error(error); process.exitCode = 1; });
    `,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 20_000,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          NEXT_RUNTIME: 'nodejs',
          NEXT_PHASE: phase,
          DATABASE_PROVIDER: 'postgresql',
          DATABASE_URL: databaseUrl,
        },
      }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /startup guard passed/);
  });
}
