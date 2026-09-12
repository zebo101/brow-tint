import assert from 'node:assert/strict';
import test from 'node:test';

import { browQueueErrorDetails } from './brow-queue-diagnostics';

test('queue diagnostics retain a wrapped machine code without SQL or error messages', () => {
  assert.deepEqual(
    browQueueErrorDetails({
      name: 'DrizzleQueryError',
      message: 'select private_customer_data',
      cause: { code: 'SQLITE_BUSY', message: 'secret query parameters' },
    }),
    { name: 'DrizzleQueryError', code: 'SQLITE_BUSY' }
  );
});

test('queue diagnostics omit secret-like codes, arbitrary names, URLs and long values', () => {
  for (const code of [
    'sk-live-private-token',
    'libsql://private-host?authToken=secret',
    'Bearer secret',
    'A'.repeat(49),
  ]) {
    const value = browQueueErrorDetails({
      name: 'secret-customer-name',
      code,
      message: 'private message',
      stack: 'private stack',
    });
    assert.deepEqual(value, { name: 'UnknownError' });
  }
});
