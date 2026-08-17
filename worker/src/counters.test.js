import { expect, test } from 'vitest';
import { createFakeD1 } from '../test/fakeD1.js';
import { issueNumber } from './counters.js';

function seedDb() {
  return createFakeD1({
    counters: [
      { name: 'invoice', value: 0 },
      { name: 'receipt', value: 0 },
    ],
    auth_state: { fail_count: 0, first_fail_at: null, locked_until: null },
  });
}

test('issues sequential numbers starting at 1', async () => {
  const db = seedDb();
  expect(await issueNumber(db, 'invoice')).toBe(1);
  expect(await issueNumber(db, 'invoice')).toBe(2);
  expect(await issueNumber(db, 'receipt')).toBe(1);
});

test('rejects an unknown counter kind', async () => {
  const db = seedDb();
  await expect(issueNumber(db, 'quote')).rejects.toThrow('Invalid counter kind');
});

test('50 concurrent issues for the same kind never duplicate', async () => {
  const db = seedDb();
  const numbers = await Promise.all(Array.from({ length: 50 }, () => issueNumber(db, 'invoice')));
  const unique = new Set(numbers);
  expect(unique.size).toBe(50);
  expect([...unique].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
});

test('concurrent issues across both kinds stay independently gapless', async () => {
  const db = seedDb();
  const calls = Array.from({ length: 30 }, (_, i) => issueNumber(db, i % 2 === 0 ? 'invoice' : 'receipt'));
  await Promise.all(calls);
  expect(db._state.counters.find((counter) => counter.name === 'invoice').value).toBe(15);
  expect(db._state.counters.find((counter) => counter.name === 'receipt').value).toBe(15);
});
