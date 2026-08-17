// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  SCHEMA_VERSION, STORAGE_PREFIX, appendDocument, exportSnapshot, importSnapshot, loadCustomers,
  loadDocuments, loadOwner, loadProducts, nextDocumentNumber, saveCustomers, saveOwner, saveProducts,
} from './storage.js';

beforeEach(() => { localStorage.clear(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });

test('round-trips every stored record and document counters', () => {
  const owner = { businessName: 'Test Traders', addressLines: ['Test Lane'], paymentLines: ['Test payment'] };
  const customer = { id: 'customer-1', name: 'Mx. Test Customer', lines: ['Test Place'] };
  const product = { id: 'product-1', description: 'Test Product', unitPrice: 1250 };
  const document = { id: 'document-1', kind: 'invoice', number: 1, issuedAt: '2026-01-01T00:00:00.000Z', input: { kind: 'invoice', number: 1, date: new Date('2026-01-01'), customer, owner, items: [{ description: 'Test Product', unitPrice: 1250, qty: 2 }] } };
  saveOwner(owner); saveCustomers([customer]); saveProducts([product]); appendDocument(document);
  expect(loadOwner()).toEqual(owner); expect(loadCustomers()).toEqual([customer]); expect(loadProducts()).toEqual([product]);
  expect(loadDocuments()).toEqual([document]); expect(nextDocumentNumber('invoice')).toBe(1); expect(nextDocumentNumber('invoice')).toBe(2);
});

test('corrupt values safely return empty defaults', () => {
  localStorage.setItem(`${STORAGE_PREFIX}owner`, 'not json'); localStorage.setItem(`${STORAGE_PREFIX}customers`, 'not json');
  localStorage.setItem(`${STORAGE_PREFIX}products`, 'not json'); localStorage.setItem(`${STORAGE_PREFIX}documents`, 'not json');
  expect(loadOwner()).toBeNull(); expect(loadCustomers()).toEqual([]); expect(loadProducts()).toEqual([]); expect(loadDocuments()).toEqual([]);
});

test('exports and imports every field, rejecting unsupported schemas', () => {
  saveOwner({ businessName: 'Test Traders', addressLines: [], paymentLines: [] }); saveCustomers([{ id: 'c', name: 'Mx. Test Customer' }]); saveProducts([{ id: 'p', description: 'Test Product', unitPrice: 1 }]); nextDocumentNumber('receipt');
  const snapshot = exportSnapshot(); localStorage.clear(); importSnapshot(snapshot);
  expect(exportSnapshot()).toMatchObject({ schemaVersion: SCHEMA_VERSION, owner: snapshot.owner, customers: snapshot.customers, products: snapshot.products, counters: snapshot.counters });
  expect(() => importSnapshot({ schemaVersion: 999 })).toThrow('Unsupported backup schema version');
});
