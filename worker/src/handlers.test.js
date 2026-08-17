import { expect, test } from 'vitest';
import { deleteCustomer, listCustomers, upsertCustomer } from './customers.js';
import { getOwner, upsertOwner } from './owner.js';
import { deleteProduct, listProducts, upsertProduct } from './products.js';

function dbWith(rows) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async first() { calls.push({ sql, params }); return rows.shift() ?? null; },
        async run() { calls.push({ sql, params }); return { results: rows.shift() ?? [] }; },
      };
    },
  };
}

test('owner reads and writes the authoritative JSON record', async () => {
  const record = { business_name: 'Test Traders', address_lines: '["Test Lane"]', phone: 'test', payment_heading: 'Test payment', payment_lines: '["Test line"]', updated_at: 10 };
  const db = dbWith([record, record]);
  expect(await getOwner(db)).toMatchObject({ businessName: 'Test Traders', updatedAt: 10 });
  expect(await upsertOwner(db, { businessName: 'New', addressLines: [], phone: '', paymentHeading: '', paymentLines: [], updatedAt: 11 })).toMatchObject({ businessName: 'Test Traders' });
  expect(db.calls).toHaveLength(2);
});

test('customers list, upsert fallback, and stale delete state use their SQL paths', async () => {
  const current = { id: 'c', name: 'Test Customer', lines: '["Test Place"]', updated_at: 10 };
  const db = dbWith([[current], null, current, null, { id: 'c', deleted_at: null, updated_at: 10 }]);
  expect(await listCustomers(db)).toEqual([{ id: 'c', name: 'Test Customer', lines: ['Test Place'], updatedAt: 10 }]);
  expect(await upsertCustomer(db, 'c', { name: 'New', lines: [], updatedAt: 9 })).toMatchObject({ id: 'c' });
  expect(await deleteCustomer(db, 'c', 9)).toEqual({ id: 'c', deleted: false, updatedAt: 10 });
  expect(db.calls).toHaveLength(5);
});

test('products list, upsert fallback, and missing delete state use their SQL paths', async () => {
  const current = { id: 'p', description: 'Test Product', unit_price: 1250, updated_at: 10 };
  const db = dbWith([[current], null, current, null, null]);
  expect(await listProducts(db)).toEqual([{ id: 'p', description: 'Test Product', unitPrice: 1250, updatedAt: 10 }]);
  expect(await upsertProduct(db, 'p', { description: 'New', unitPrice: 1, updatedAt: 9 })).toMatchObject({ id: 'p' });
  expect(await deleteProduct(db, 'missing', 9)).toBeNull();
  expect(db.calls).toHaveLength(5);
});
