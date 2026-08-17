import { expect, test } from 'vitest';
import { issueToken } from './auth.js';
import worker from './index.js';
import { createFakeD1 } from '../test/fakeD1.js';

function env() {
  return {
    DB: createFakeD1({ counters: [{ name: 'invoice', value: 0 }, { name: 'receipt', value: 0 }], auth_state: { fail_count: 0, first_fail_at: null, locked_until: null } }),
    AUTH_PASSPHRASE_HASH: 'invalid', AUTH_TOKEN_SECRET: 'test-secret',
  };
}

async function request(path, environment, body) {
  const { token } = await issueToken(environment.AUTH_TOKEN_SECRET);
  return worker.fetch(new Request(`https://test.local${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), environment);
}

test('API responses include CORS and reject unauthenticated requests before database access', async () => {
  const environment = env();
  const response = await worker.fetch(new Request('https://test.local/api/workspace'), environment);
  expect(response.status).toBe(401);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(await response.json()).toEqual({ error: 'unauthorized' });
});

test('workspace returns the current owner, active records, and informational counters', async () => {
  const { token } = await issueToken('test-secret');
  const rows = {
    'SELECT name, value FROM counters': [{ name: 'invoice', value: 4 }, { name: 'receipt', value: 2 }],
    'SELECT business_name, address_lines, phone, payment_lines, payment_heading, updated_at FROM owner WHERE id = 1': { business_name: 'Test Traders', address_lines: '[]', phone: '', payment_lines: '[]', payment_heading: '', updated_at: 1 },
    'SELECT id, name, lines, updated_at FROM customers WHERE deleted_at IS NULL': [],
    'SELECT id, description, unit_price, updated_at FROM products WHERE deleted_at IS NULL': [],
  };
  const environment = { AUTH_TOKEN_SECRET: 'test-secret', DB: { prepare(sql) { return { async first() { return rows[sql]; }, async run() { return { results: rows[sql] }; } }; } } };
  const response = await worker.fetch(new Request('https://test.local/api/workspace', { headers: { Authorization: `Bearer ${token}` } }), environment);
  expect(await response.json()).toMatchObject({ owner: { businessName: 'Test Traders' }, counters: { invoice: 4, receipt: 2 }, customers: [], products: [] });
});

test('HTTP issue handler assigns unique numbers for 30 concurrent requests', async () => {
  const environment = env();
  const responses = await Promise.all(Array.from({ length: 30 }, () => request('/api/issue', environment, { kind: 'invoice' })));
  const numbers = await Promise.all(responses.map(async (response) => (await response.json()).number));
  expect(new Set(numbers).size).toBe(30);
  expect(numbers.sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
});

test('issue handler rejects an invalid kind', async () => {
  const environment = env();
  const response = await request('/api/issue', environment, { kind: 'quote' });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'invalid_kind' });
});

test('unexpected handler errors return JSON with CORS headers', async () => {
  const environment = env();
  const { token } = await issueToken(environment.AUTH_TOKEN_SECRET);
  const response = await worker.fetch(new Request('https://test.local/api/workspace', { headers: { Authorization: `Bearer ${token}` } }), environment);
  expect(response.status).toBe(500);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(await response.json()).toEqual({ error: 'internal' });
});
