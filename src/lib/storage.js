export const STORAGE_PREFIX = 'sheer-aura-invoicing:v1:';
export const SCHEMA_VERSION = 1;

const keys = {
  owner: `${STORAGE_PREFIX}owner`,
  customers: `${STORAGE_PREFIX}customers`,
  products: `${STORAGE_PREFIX}products`,
  documents: `${STORAGE_PREFIX}documents`,
  counters: `${STORAGE_PREFIX}counters`,
};

function load(key, fallback) {
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    console.warn(`Could not read saved invoicing data for ${key}`);
    return fallback;
  }
}

function save(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadOwner() { return load(keys.owner, null); }
export function saveOwner(owner) { save(keys.owner, owner); }
export function loadCustomers() { return load(keys.customers, []); }
export function saveCustomers(customers) { save(keys.customers, customers); }
export function loadProducts() { return load(keys.products, []); }
export function saveProducts(products) { save(keys.products, products); }
export function loadDocuments() {
  return load(keys.documents, []).map((document) => ({
    ...document,
    input: document.input?.date ? { ...document.input, date: new Date(document.input.date) } : document.input,
  }));
}

export function appendDocument(doc) {
  const documents = loadDocuments();
  documents.push(doc);
  saveDocuments(documents);
}

function saveDocuments(documents) { save(keys.documents, documents); }

export function loadCounters() {
  const counters = load(keys.counters, { invoice: 1, receipt: 1 });
  return {
    invoice: Number.isInteger(counters.invoice) ? counters.invoice : 1,
    receipt: Number.isInteger(counters.receipt) ? counters.receipt : 1,
  };
}

export function saveCounters(counters) { save(keys.counters, counters); }

export function exportSnapshot() {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    owner: loadOwner(),
    customers: loadCustomers(),
    products: loadProducts(),
    counters: loadCounters(),
    documents: loadDocuments(),
  };
}

export function importSnapshot(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schema version: ${snapshot?.schemaVersion}`);
  }
  saveOwner(snapshot.owner ?? null);
  saveCustomers(Array.isArray(snapshot.customers) ? snapshot.customers : []);
  saveProducts(Array.isArray(snapshot.products) ? snapshot.products : []);
  save(keys.counters, snapshot.counters ?? { invoice: 1, receipt: 1 });
  saveDocuments(Array.isArray(snapshot.documents) ? snapshot.documents : []);
}
