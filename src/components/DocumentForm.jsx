import { useState } from 'react';
import {
  formatDocumentDate,
  renderDocumentBlob,
  suggestedFilename,
  validateDocumentInput,
} from '../pdf/index.js';
import { loadDocumentAssets } from '../lib/pdfAssets.js';
import { computeTotals, formatAmount, formatPrice, parseCents } from '../lib/money.js';
import { downloadBlob } from '../lib/download.js';
import { appendDocument } from '../lib/storage.js';
import { issueNumber as syncIssueNumber } from '../lib/sync.js';
import { makeItem, today } from '../lib/formHelpers.js';

export default function DocumentForm({ owner, customers, products, onIssued }) {
  const [kind, setKind] = useState('invoice');
  const [customer, setCustomer] = useState({ name: '', lines: [] });
  const [date, setDate] = useState(today());
  const [items, setItems] = useState([makeItem()]);
  const [delivery, setDelivery] = useState('');
  const [tax, setTax] = useState('');
  const [paidOn, setPaidOn] = useState(formatDocumentDate(new Date()));
  const [paidMethod, setPaidMethod] = useState('');
  const [error, setError] = useState('');

  const changeItem = (id, change) => {
    setItems(items.map((item) => (item.id === id ? { ...item, ...change } : item)));
  };
  const parsedItems = items.map((item) => ({
    ...item,
    unitPrice: parseCents(item.unitPrice),
    qty: Number(item.qty),
  }));
  const totals = computeTotals(parsedItems, {
    deliveryCents: delivery === '' ? null : parseCents(delivery),
    taxPercent: tax === '' ? null : Number(tax),
  });

  const chooseCustomer = (id) => {
    const found = customers.find((entry) => entry.id === id);
    setCustomer(found ? { name: found.name, lines: found.lines || [] } : { name: '', lines: [] });
  };

  const chooseProduct = (id, itemId) => {
    const found = products.find((entry) => entry.id === id);
    if (found) {
      changeItem(itemId, {
        description: found.description,
        unitPrice: formatPrice(found.unitPrice),
      });
    }
  };

  async function issue() {
    setError('');

    if (!owner) {
      setError('Add your business profile in Settings before issuing a document.');
      return;
    }

    try {
      const draft = {
        kind,
        number: 0,
        date: new Date(`${date}T00:00:00`),
        customer,
        owner: { ...owner },
        items: parsedItems.map(({ description, unitPrice, qty }) => ({
          description,
          unitPrice,
          qty,
        })),
        deliveryCents: delivery === '' ? null : parseCents(delivery),
        taxPercent: tax === '' ? null : Number(tax),
        ...(kind === 'receipt' ? { paidOn, paidMethod } : {}),
      };
      validateDocumentInput(draft);

      const number = await syncIssueNumber(kind);
      const input = { ...draft, number };
      const blob = await renderDocumentBlob(input, await loadDocumentAssets());

      downloadBlob(blob, suggestedFilename(input));
      appendDocument({
        id: crypto.randomUUID(),
        kind,
        number: input.number,
        issuedAt: new Date().toISOString(),
        input,
      });
      setCustomer({ name: '', lines: [] });
      setItems([makeItem()]);
      setDelivery('');
      setTax('');
      setPaidMethod('');
      onIssued();
    } catch (caught) {
      setError(caught.message);
    }
  }

  return (
    <section>
      <h2>New document</h2>
      <label>
        Type
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="invoice">Invoice</option>
          <option value="receipt">Receipt</option>
        </select>
      </label>
      <label>
        Saved customer
        <select
          aria-label="Saved customer"
          defaultValue=""
          onChange={(event) => chooseCustomer(event.target.value)}
        >
          <option value="">Type a customer below</option>
          {customers.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Customer name
        <input
          value={customer.name}
          onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
        />
      </label>
      <label>
        Date
        <input
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            if (kind === 'receipt') {
              setPaidOn(formatDocumentDate(new Date(`${event.target.value}T00:00:00`)));
            }
          }}
        />
      </label>
      <h3>Items</h3>
      {items.map((item) => (
        <div className="item" key={item.id}>
          <select
            aria-label="Saved product"
            defaultValue=""
            onChange={(event) => chooseProduct(event.target.value, item.id)}
          >
            <option value="">Saved product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.description}
              </option>
            ))}
          </select>
          <input
            aria-label="Description"
            placeholder="Description"
            value={item.description}
            onChange={(event) => changeItem(item.id, { description: event.target.value })}
          />
          <input
            aria-label="Unit price"
            placeholder="Unit price"
            value={item.unitPrice}
            onChange={(event) => changeItem(item.id, { unitPrice: event.target.value })}
          />
          <input
            aria-label="Quantity"
            type="number"
            min="0"
            step="1"
            value={item.qty}
            onChange={(event) => changeItem(item.id, { qty: event.target.value })}
          />
          <button
            type="button"
            onClick={() => setItems(items.filter((entry) => entry.id !== item.id))}
            disabled={items.length === 1}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setItems([...items, makeItem()])}>
        Add item
      </button>
      <label>
        Delivery
        <input
          aria-label="Delivery"
          value={delivery}
          onChange={(event) => setDelivery(event.target.value)}
        />
      </label>
      <label>
        Tax percent
        <input
          aria-label="Tax percent"
          type="number"
          min="0"
          value={tax}
          onChange={(event) => setTax(event.target.value)}
        />
      </label>
      {kind === 'receipt' && (
        <>
          <label>
            Paid on
            <input value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
          </label>
          <label>
            Paid method
            <input value={paidMethod} onChange={(event) => setPaidMethod(event.target.value)} />
          </label>
        </>
      )}
      <dl className="totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatAmount(totals.subtotal)}</dd>
        </div>
        {totals.delivery !== null && (
          <div>
            <dt>Delivery</dt>
            <dd>{formatAmount(totals.delivery)}</dd>
          </div>
        )}
        {totals.tax !== null && (
          <div>
            <dt>Tax</dt>
            <dd>{formatAmount(totals.tax)}</dd>
          </div>
        )}
        <div>
          <dt>Total</dt>
          <dd data-testid="total">{formatAmount(totals.total)}</dd>
        </div>
      </dl>
      {!owner && (
        <p className="notice">Set up your business profile in Settings to issue a document.</p>
      )}
      {!navigator.onLine && <p className="notice">Issuing needs a connection.</p>}
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={issue} disabled={!owner || !navigator.onLine}>
        Issue &amp; Download
      </button>
    </section>
  );
}
