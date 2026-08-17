// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import Settings from './Settings.jsx';

const browserWindow = window;

const { pushCustomer, pushOwner, pushProduct } = vi.hoisted(() => ({
  pushCustomer: vi.fn(), pushOwner: vi.fn(), pushProduct: vi.fn(),
}));
vi.mock('../lib/sync.js', () => ({ pushCustomer, pushOwner, pushProduct }));
const reload = vi.fn();

beforeEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(browserWindow, 'confirm').mockReturnValue(true);
  vi.stubGlobal('window', new Proxy(browserWindow, {
    get(target, property) {
      if (property === 'location') return { reload };
      return Reflect.get(target, property, target);
    },
  }));
  pushOwner.mockResolvedValue({}); pushCustomer.mockResolvedValue({}); pushProduct.mockResolvedValue({});
});

test('backup import pushes each record before restoring the local snapshot', async () => {
  const backup = {
    schemaVersion: 1,
    owner: { businessName: 'Test Traders', addressLines: [], phone: '', paymentHeading: '', paymentLines: [] },
    customers: [{ id: 'customer-1', name: 'Test Customer', lines: [] }],
    products: [{ id: 'product-1', description: 'Test Product', unitPrice: 1250 }],
    counters: { invoice: 1, receipt: 1 }, documents: [],
  };
  render(<Settings owner={null} refresh={vi.fn()} />);
  await userEvent.setup().upload(screen.getByLabelText('Import'), new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' }));
  await waitFor(() => expect(pushProduct).toHaveBeenCalled());
  expect(pushOwner).toHaveBeenCalledWith(expect.objectContaining(backup.owner));
  expect(pushCustomer).toHaveBeenCalledWith(expect.objectContaining(backup.customers[0]));
  expect(pushProduct).toHaveBeenCalledWith(expect.objectContaining(backup.products[0]));
  expect(reload).toHaveBeenCalled();
});
