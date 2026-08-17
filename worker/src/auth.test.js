import { expect, test, vi } from 'vitest';
import { createFakeD1 } from '../test/fakeD1.js';
import {
  checkLockout, hashPassphrase, issueToken, recordFailure, recordSuccess, verifyPassphrase, verifyToken,
} from './auth.js';

function seedDb() {
  return createFakeD1({
    counters: [
      { name: 'invoice', value: 0 },
      { name: 'receipt', value: 0 },
    ],
    auth_state: { fail_count: 0, first_fail_at: null, locked_until: null },
  });
}

test('a correct passphrase verifies against its own hash', async () => {
  const hash = await hashPassphrase('correct horse battery staple');
  expect(await verifyPassphrase('correct horse battery staple', hash)).toBe(true);
});

test('an incorrect passphrase fails verification', async () => {
  const hash = await hashPassphrase('correct horse battery staple');
  expect(await verifyPassphrase('wrong passphrase', hash)).toBe(false);
});

test('malformed stored hashes fail closed instead of throwing', async () => {
  expect(await verifyPassphrase('anything', 'not-a-valid-hash')).toBe(false);
  expect(await verifyPassphrase('anything', '')).toBe(false);
});

test('a freshly issued token verifies', async () => {
  const { token } = await issueToken('server-secret');
  expect(await verifyToken(token, 'server-secret')).toBe(true);
});

test('a token verified against the wrong secret fails', async () => {
  const { token } = await issueToken('server-secret');
  expect(await verifyToken(token, 'different-secret')).toBe(false);
});

test('an expired token fails verification', async () => {
  vi.useFakeTimers();
  try {
    const { token } = await issueToken('server-secret');
    vi.advanceTimersByTime(13 * 60 * 60 * 1000);
    expect(await verifyToken(token, 'server-secret')).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

test('a tampered token fails verification', async () => {
  const { token } = await issueToken('server-secret');
  const [payload] = token.split('.');
  expect(await verifyToken(`${payload}.tampered-signature`, 'server-secret')).toBe(false);
});

test('lockout engages after the failure threshold and clears on success', async () => {
  const db = seedDb();
  expect((await checkLockout(db)).locked).toBe(false);
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await recordFailure(db);
  }
  expect((await checkLockout(db)).locked).toBe(true);
  await recordSuccess(db);
  expect((await checkLockout(db)).locked).toBe(false);
});
