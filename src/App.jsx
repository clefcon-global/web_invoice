import { useState } from 'react';
import {
  renderDocumentBlob, validateDocumentInput, formatDocumentDate, suggestedFilename,
} from './pdf/index.js';
import { loadDocumentAssets } from './lib/pdfAssets.js';
import { computeTotals, formatAmount, formatPrice, parseCents } from './lib/money.js';
import { downloadBlob } from './lib/download.js';
import {
  appendDocument, exportSnapshot, importSnapshot, loadCustomers, loadDocuments, loadOwner,
  loadProducts, nextDocumentNumber, saveCustomers, saveOwner, saveProducts,
} from './lib/storage.js';
import './index.css';

const today = () => new Date().toISOString().slice(0, 10);
const makeItem = () => ({ id: crypto.randomUUID(), description: '', unitPrice: '', qty: '1' });
const asLines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);

function DocumentsForm({ owner, customers, products, onIssued }) {
  const [kind, setKind] = useState('invoice');
  const [customer, setCustomer] = useState({ name: '', lines: [] });
  const [date, setDate] = useState(today());
  const [items, setItems] = useState([makeItem()]);
  const [delivery, setDelivery] = useState('');
  const [tax, setTax] = useState('');
  const [paidOn, setPaidOn] = useState(formatDocumentDate(new Date()));
  const [paidMethod, setPaidMethod] = useState('');
  const [error, setError] = useState('');
  const changeItem = (id, change) => setItems(items.map((item) => item.id === id ? { ...item, ...change } : item));
  const parsedItems = items.map((item) => ({ ...item, unitPrice: parseCents(item.unitPrice), qty: Number(item.qty) }));
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
    if (found) changeItem(itemId, { description: found.description, unitPrice: formatPrice(found.unitPrice) });
  };
  async function issue() {
    setError('');
    if (!owner) { setError('Add your business profile in Settings before issuing a document.'); return; }
    try {
      const draft = {
        kind, number: 0, date: new Date(`${date}T00:00:00`), customer,
        owner: { ...owner }, items: parsedItems.map(({ description, unitPrice, qty }) => ({ description, unitPrice, qty })),
        deliveryCents: delivery === '' ? null : parseCents(delivery), taxPercent: tax === '' ? null : Number(tax),
        ...(kind === 'receipt' ? { paidOn, paidMethod } : {}),
      };
      validateDocumentInput(draft);
      const input = { ...draft, number: nextDocumentNumber(kind) };
      const blob = await renderDocumentBlob(input, await loadDocumentAssets());
      downloadBlob(blob, suggestedFilename(input));
      appendDocument({ id: crypto.randomUUID(), kind, number: input.number, issuedAt: new Date().toISOString(), input });
      setCustomer({ name: '', lines: [] }); setItems([makeItem()]); setDelivery(''); setTax(''); setPaidMethod(''); onIssued();
    } catch (caught) { setError(caught.message); }
  }
  return <section>
    <h2>New document</h2>
    <label>Type <select value={kind} onChange={(event) => setKind(event.target.value)}><option value="invoice">Invoice</option><option value="receipt">Receipt</option></select></label>
    <label>Saved customer <select aria-label="Saved customer" defaultValue="" onChange={(event) => chooseCustomer(event.target.value)}><option value="">Type a customer below</option>{customers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
    <label>Customer name <input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
    <label>Date <input type="date" value={date} onChange={(event) => { setDate(event.target.value); if (kind === 'receipt') setPaidOn(formatDocumentDate(new Date(`${event.target.value}T00:00:00`))); }} /></label>
    <h3>Items</h3>
    {items.map((item) => <div className="item" key={item.id}>
      <select aria-label="Saved product" defaultValue="" onChange={(event) => chooseProduct(event.target.value, item.id)}><option value="">Saved product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.description}</option>)}</select>
      <input aria-label="Description" placeholder="Description" value={item.description} onChange={(event) => changeItem(item.id, { description: event.target.value })} />
      <input aria-label="Unit price" placeholder="Unit price" value={item.unitPrice} onChange={(event) => changeItem(item.id, { unitPrice: event.target.value })} />
      <input aria-label="Quantity" type="number" min="0" step="1" value={item.qty} onChange={(event) => changeItem(item.id, { qty: event.target.value })} />
      <button type="button" onClick={() => setItems(items.filter((entry) => entry.id !== item.id))} disabled={items.length === 1}>Remove</button>
    </div>)}
    <button type="button" onClick={() => setItems([...items, makeItem()])}>Add item</button>
    <label>Delivery <input aria-label="Delivery" value={delivery} onChange={(event) => setDelivery(event.target.value)} /></label>
    <label>Tax percent <input aria-label="Tax percent" type="number" min="0" value={tax} onChange={(event) => setTax(event.target.value)} /></label>
    {kind === 'receipt' && <><label>Paid on <input value={paidOn} onChange={(event) => setPaidOn(event.target.value)} /></label><label>Paid method <input value={paidMethod} onChange={(event) => setPaidMethod(event.target.value)} /></label></>}
    <dl className="totals"><div><dt>Subtotal</dt><dd>{formatAmount(totals.subtotal)}</dd></div>{totals.delivery !== null && <div><dt>Delivery</dt><dd>{formatAmount(totals.delivery)}</dd></div>}{totals.tax !== null && <div><dt>Tax</dt><dd>{formatAmount(totals.tax)}</dd></div>}<div><dt>Total</dt><dd data-testid="total">{formatAmount(totals.total)}</dd></div></dl>
    {!owner && <p className="notice">Set up your business profile in Settings to issue a document.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={issue} disabled={!owner}>Issue &amp; Download</button>
  </section>;
}

function Customers({ customers, refresh }) {
  const [editing, setEditing] = useState(null); const [name, setName] = useState(''); const [lines, setLines] = useState('');
  function submit(event) { event.preventDefault(); if (!name.trim()) return; const value = { id: editing?.id || crypto.randomUUID(), name: name.trim(), lines: asLines(lines) }; saveCustomers(editing ? customers.map((entry) => entry.id === editing.id ? value : entry) : [...customers, value]); setEditing(null); setName(''); setLines(''); refresh(); }
  return <section><h2>Customers</h2><form onSubmit={submit}><label>Name <input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Address lines <textarea value={lines} onChange={(event) => setLines(event.target.value)} /></label><button>{editing ? 'Save customer' : 'Add customer'}</button></form><ul>{customers.map((entry) => <li key={entry.id}>{entry.name} <button onClick={() => { setEditing(entry); setName(entry.name); setLines((entry.lines || []).join('\n')); }}>Edit</button><button onClick={() => { saveCustomers(customers.filter((candidate) => candidate.id !== entry.id)); refresh(); }}>Delete</button></li>)}</ul></section>;
}

function Products({ products, refresh }) {
  const [editing, setEditing] = useState(null); const [description, setDescription] = useState(''); const [price, setPrice] = useState(''); const [error, setError] = useState('');
  function submit(event) { event.preventDefault(); setError(''); try { if (!description.trim()) return; const value = { id: editing?.id || crypto.randomUUID(), description: description.trim(), unitPrice: parseCents(price) }; saveProducts(editing ? products.map((entry) => entry.id === editing.id ? value : entry) : [...products, value]); setEditing(null); setDescription(''); setPrice(''); refresh(); } catch (caught) { setError(caught.message); } }
  return <section><h2>Products</h2><form onSubmit={submit}><label>Description <input value={description} onChange={(event) => setDescription(event.target.value)} /></label><label>Unit price <input value={price} onChange={(event) => setPrice(event.target.value)} /></label><button>{editing ? 'Save product' : 'Add product'}</button></form>{error && <p role="alert">{error}</p>}<ul>{products.map((entry) => <li key={entry.id}>{entry.description} — {formatPrice(entry.unitPrice)} <button onClick={() => { setEditing(entry); setDescription(entry.description); setPrice(formatPrice(entry.unitPrice)); }}>Edit</button><button onClick={() => { saveProducts(products.filter((candidate) => candidate.id !== entry.id)); refresh(); }}>Delete</button></li>)}</ul></section>;
}

function Settings({ owner, refresh }) {
  const [value, setValue] = useState(owner || { businessName: '', addressLines: [], phone: '', paymentHeading: '', paymentLines: [] }); const [message, setMessage] = useState('');
  const update = (key, next) => setValue({ ...value, [key]: next });
  function save(event) { event.preventDefault(); const { addressLinesText, paymentLinesText, ...ownerValue } = value; saveOwner({ ...ownerValue, addressLines: asLines(addressLinesText ?? value.addressLines.join('\n')), paymentLines: asLines(paymentLinesText ?? value.paymentLines.join('\n')) }); setMessage('Profile saved.'); refresh(); }
  function exportData() { downloadBlob(new Blob([JSON.stringify(exportSnapshot(), null, 2)], { type: 'application/json' }), `sheer-aura-backup-${today()}.json`); }
  async function importData(event) { const file = event.target.files[0]; if (!file) return; try { const parsed = JSON.parse(await file.text()); if (window.confirm('Importing will replace all current data. Continue?')) { importSnapshot(parsed); window.location.reload(); } } catch (caught) { setMessage(caught.message); } }
  return <section><h2>Settings</h2><form onSubmit={save}><label>Business name <input value={value.businessName} onChange={(event) => update('businessName', event.target.value)} /></label><label>Address lines <textarea value={value.addressLinesText ?? value.addressLines.join('\n')} onChange={(event) => update('addressLinesText', event.target.value)} /></label><label>Phone <input value={value.phone || ''} onChange={(event) => update('phone', event.target.value)} /></label><label>Payment heading <input value={value.paymentHeading || ''} onChange={(event) => update('paymentHeading', event.target.value)} /></label><label>Payment lines <textarea value={value.paymentLinesText ?? value.paymentLines.join('\n')} onChange={(event) => update('paymentLinesText', event.target.value)} /></label><button>Save settings</button></form>{message && <p>{message}</p>}<h3>Backup</h3><button onClick={exportData}>Export</button><label>Import <input type="file" accept="application/json" onChange={importData} /></label></section>;
}

function History({ documents }) {
  const [error, setError] = useState('');
  async function redownload(record) { try { downloadBlob(await renderDocumentBlob(record.input, await loadDocumentAssets()), suggestedFilename(record.input)); } catch (caught) { setError(caught.message); } }
  return <section><h2>History</h2>{error && <p role="alert">{error}</p>}<ul>{documents.map((record) => <li key={record.id}>{record.kind} #{record.number} — {record.input.customer.name} — {record.input.date instanceof Date ? record.input.date.toLocaleDateString() : record.input.date} — {formatAmount(computeTotals(record.input.items, { deliveryCents: record.input.deliveryCents, taxPercent: record.input.taxPercent }).total)} <button onClick={() => redownload(record)}>Re-download</button></li>)}</ul></section>;
}

export default function App() {
  const [view, setView] = useState('document'); const [revision, setRevision] = useState(0); const refresh = () => setRevision((value) => value + 1);
  const owner = loadOwner(); const customers = loadCustomers(); const products = loadProducts(); const documents = loadDocuments();
  return <main><header><h1>Sheer Aura Invoicing</h1><nav>{[['document', 'New document'], ['customers', 'Customers'], ['products', 'Products'], ['history', 'History'], ['settings', 'Settings']].map(([id, label]) => <button className={view === id ? 'active' : ''} key={id} onClick={() => setView(id)}>{label}</button>)}</nav></header>{view === 'document' && <DocumentsForm key={revision} owner={owner} customers={customers} products={products} onIssued={refresh} />}{view === 'customers' && <Customers customers={customers} refresh={refresh} />}{view === 'products' && <Products products={products} refresh={refresh} />}{view === 'settings' && <Settings owner={owner} refresh={refresh} />}{view === 'history' && <History documents={documents} />}</main>;
}
