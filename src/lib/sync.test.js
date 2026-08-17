// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';
import { deleteCustomer, isAuthenticated, issueNumber, login, pushCustomer } from './sync.js';

beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

test('login stores an issued token and reports invalid and locked passphrases', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token: 'token', expiresAt: Date.now() + 1000 }), { status: 200 })));
  await login('test passphrase');
  expect(isAuthenticated()).toBe(true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid_passphrase' }), { status: 401 })));
  await expect(login('bad')).rejects.toThrow('Incorrect passphrase');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'locked' }), { status: 429 })));
  await expect(login('bad')).rejects.toThrow('Too many attempts');
});

test('authenticated requests clear the token on 401', async () => {
  localStorage.setItem('sheer-aura-invoicing:v1:token', 'token'); localStorage.setItem('sheer-aura-invoicing:v1:tokenExpiresAt', String(Date.now() + 1000));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })));
  await expect(deleteCustomer('customer-1', 1)).rejects.toMatchObject({ code: 'unauthorized' });
  expect(isAuthenticated()).toBe(false);
});

test('issue rejects offline without fetching', async () => {
  vi.stubGlobal('navigator', { onLine: false });
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(issueNumber('invoice')).rejects.toThrow('offline');
  expect(fetch).not.toHaveBeenCalled();
});

test('push customer returns the authoritative CRUD record', async () => {
  localStorage.setItem('sheer-aura-invoicing:v1:token', 'token'); localStorage.setItem('sheer-aura-invoicing:v1:tokenExpiresAt', String(Date.now() + 1000));
  const customer = { id: 'customer-1', name: 'Test Customer', lines: ['Test Place'], updatedAt: 1 };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(customer), { status: 200 })));
  await expect(pushCustomer(customer)).resolves.toEqual(customer);
});
