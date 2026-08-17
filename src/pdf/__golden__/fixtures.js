/**
 * Fixed sample inputs for the golden-file tests.
 *
 * Deliberately FICTIONAL — this file is committed to a public repo. Never
 * substitute real customer or business data here, even for local testing.
 * See SPEC.md section 9.3.
 */

const OWNER = {
  businessName: 'Test Traders',
  addressLines: ['123 Example Road,', 'Sample Town.'],
  phone: '0000000000',
  paymentLines: ['Test Bank, Example Branch.', 'A. Sample', 'A/C 0000000000'],
};

/** Mirrors the real reference invoice's shape, but with fictional data. */
export const SIMPLE_INVOICE = {
  kind: 'invoice',
  number: 1,
  date: new Date(2025, 2, 25),
  customer: { name: 'Mx. Test Customer' },
  owner: OWNER,
  items: [
    { description: 'Sample product A', unitPrice: 38000, qty: 4 },
    { description: '100% Sample product B', unitPrice: 25000, qty: 2 },
    { description: 'Sample/Product/With/Slashes C', unitPrice: 30000, qty: 2 },
    { description: 'Sample product 70g D', unitPrice: 70000, qty: 2 },
    { description: 'Sample product E', unitPrice: 30000, qty: 1 },
  ],
  deliveryCents: 40000,
  taxPercent: null,
};

export const SIMPLE_RECEIPT = {
  ...SIMPLE_INVOICE,
  kind: 'receipt',
  paidOn: '25th March 2025',
  paidMethod: 'Bank transfer',
};

/** No optional rows at all — the plainest possible document. */
export const NO_EXTRAS_INVOICE = {
  kind: 'invoice',
  number: 2,
  date: new Date(2025, 5, 1),
  customer: { name: 'Mx. Minimal Customer' },
  owner: OWNER,
  items: [{ description: 'Single item', unitPrice: 10000, qty: 1 }],
  deliveryCents: null,
  taxPercent: null,
};

/** Both delivery and tax present, to prove both optional rows render together. */
export const DELIVERY_AND_TAX_INVOICE = {
  ...SIMPLE_INVOICE,
  number: 3,
  taxPercent: 15,
};

/** 30 items — proves multi-page flow, repeated headers, footer on last page only. */
export const STRESS_30_ITEMS = {
  kind: 'invoice',
  number: 42,
  date: new Date(2025, 2, 25),
  customer: { name: 'Mx. Stress Test' },
  owner: OWNER,
  items: Array.from({ length: 30 }, (_, i) => ({
    description: [
      'Sample product A', '100% Sample product B', 'Sample/Product/With/Slashes C',
      'Sample product 70g D', 'Sample product E', 'Sample product with a long name F',
    ][i % 6],
    unitPrice: 25000 + (i % 6) * 8500,
    qty: (i % 4) + 1,
  })),
  deliveryCents: 40000,
  taxPercent: 15,
};

export const ALL_FIXTURES = {
  'simple-invoice': SIMPLE_INVOICE,
  'simple-receipt': SIMPLE_RECEIPT,
  'no-extras-invoice': NO_EXTRAS_INVOICE,
  'delivery-and-tax-invoice': DELIVERY_AND_TAX_INVOICE,
  'stress-30-items': STRESS_30_ITEMS,
};
