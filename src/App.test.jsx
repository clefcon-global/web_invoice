// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App.jsx';

const { renderDocumentBlob } = vi.hoisted(() => ({
  renderDocumentBlob: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
}));
vi.mock('./pdf/index.js', async (importOriginal) => ({ ...(await importOriginal()), renderDocumentBlob }));
vi.mock('./lib/pdfAssets.js', () => ({ loadDocumentAssets: vi.fn().mockResolvedValue({}) }));
vi.mock('./lib/download.js', () => ({ downloadBlob: vi.fn() }));

afterEach(() => cleanup());

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  localStorage.setItem('sheer-aura-invoicing:v1:owner', JSON.stringify({ businessName: 'Test Traders', addressLines: ['Test Lane'], paymentLines: ['Test payment'] }));
  localStorage.setItem('sheer-aura-invoicing:v1:token', 'test-token');
  localStorage.setItem('sheer-aura-invoicing:v1:tokenExpiresAt', String(Date.now() + 60000));
  const owner = { businessName: 'Test Traders', addressLines: ['Test Lane'], paymentLines: ['Test payment'] };
  vi.stubGlobal('fetch', vi.fn(async (url) => new Response(JSON.stringify(url.endsWith('/issue') ? { number: 1 } : { owner, customers: [], products: [], counters: { invoice: 0, receipt: 0 } }), { status: 200 })));
});

test('assembles invoice cents and shows the required live total calculation', async () => {
  render(<App />); const user = userEvent.setup();
  await user.type(screen.getByLabelText('Customer name'), 'Mx. Test Customer');
  const descriptions = screen.getAllByLabelText('Description'); const prices = screen.getAllByLabelText('Unit price'); const quantities = screen.getAllByLabelText('Quantity');
  await user.type(descriptions[0], 'Test Product A'); await user.type(prices[0], '100'); await user.clear(quantities[0]); await user.type(quantities[0], '2');
  await user.click(screen.getByRole('button', { name: 'Add item' }));
  await user.type(screen.getAllByLabelText('Description')[1], 'Test Product B'); await user.type(screen.getAllByLabelText('Unit price')[1], '50'); const secondQty = screen.getAllByLabelText('Quantity')[1]; await user.clear(secondQty); await user.type(secondQty, '3');
  await user.type(screen.getByLabelText('Delivery'), '5'); await user.type(screen.getByLabelText('Tax percent'), '10');
  expect(screen.getByTestId('total')).toHaveTextContent('390.50');
  await user.click(screen.getByRole('button', { name: 'Issue & Download' }));
  expect(renderDocumentBlob).toHaveBeenCalledWith(expect.objectContaining({ kind: 'invoice', number: 1, customer: { name: 'Mx. Test Customer', lines: [] }, items: [{ description: 'Test Product A', unitPrice: 10000, qty: 2 }, { description: 'Test Product B', unitPrice: 5000, qty: 3 }], deliveryCents: 500, taxPercent: 10 }), {});
});

test('includes receipt-only fields in the rendered document input', async () => {
  render(<App />); const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('Type'), 'receipt'); await user.type(screen.getByLabelText('Customer name'), 'Mx. Test Customer'); await user.type(screen.getByLabelText('Description'), 'Test Product'); await user.type(screen.getByLabelText('Unit price'), '12.50');
  const paidOn = screen.getByLabelText('Paid on'); await user.clear(paidOn); await user.type(paidOn, '1st Test Month 2026'); await user.type(screen.getByLabelText('Paid method'), 'Test transfer');
  await user.click(screen.getByRole('button', { name: 'Issue & Download' }));
  expect(renderDocumentBlob).toHaveBeenCalledWith(expect.objectContaining({ kind: 'receipt', number: 1, paidOn: '1st Test Month 2026', paidMethod: 'Test transfer', items: [{ description: 'Test Product', unitPrice: 1250, qty: 1 }] }), {});
});
