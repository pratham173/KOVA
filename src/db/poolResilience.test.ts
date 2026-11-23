import test from 'node:test';
import assert from 'node:assert/strict';
import { isTransientIdlePoolError } from './poolResilience.ts';

test('isTransientIdlePoolError detects pg Connection terminated unexpectedly', () => {
  const err = new Error('Connection terminated unexpectedly');
  assert.equal(isTransientIdlePoolError(err), true);
});

test('isTransientIdlePoolError detects scale-to-zero PostgreSQL and TCP error codes', () => {
  assert.equal(isTransientIdlePoolError({ code: '57P01', message: 'terminating connection due to administrator command' }), true);
  assert.equal(isTransientIdlePoolError({ code: '08006', message: 'connection failure' }), true);
  assert.equal(isTransientIdlePoolError({ code: 'ECONNRESET', message: 'read ECONNRESET' }), true);
  assert.equal(isTransientIdlePoolError({ message: 'outer', cause: new Error('Connection terminated unexpectedly') }), true);
});

test('isTransientIdlePoolError returns false for non-transient SQL errors', () => {
  assert.equal(isTransientIdlePoolError({ code: '23505', message: 'duplicate key value violates unique constraint' }), false);
  assert.equal(isTransientIdlePoolError({ code: '42P01', message: 'relation "foo" does not exist' }), false);
  assert.equal(isTransientIdlePoolError(null), false);
});
