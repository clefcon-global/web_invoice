import { useState } from 'react';
import { formatPrice, parseCents } from '../lib/money.js';
import { saveProducts } from '../lib/storage.js';
import { deleteProduct, pushProduct } from '../lib/sync.js';

export default function Products({ products, refresh }) {
  const [editing, setEditing] = useState(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');

    try {
      if (!description.trim()) return;

      const value = {
        id: editing?.id || crypto.randomUUID(),
        description: description.trim(),
        unitPrice: parseCents(price),
        updatedAt: Date.now(),
      };
      const authoritative = await pushProduct(value);
      saveProducts(editing ? products.map((entry) => (entry.id === authoritative.id ? authoritative : entry)) : [...products, authoritative]);
      setEditing(null);
      setDescription('');
      setPrice('');
      refresh();
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function remove(entry) {
    try {
      await deleteProduct(entry.id, Date.now());
      saveProducts(products.filter((candidate) => candidate.id !== entry.id));
      refresh();
    } catch (caught) { setError(caught.message); }
  }

  return (
    <section>
      <h2>Products</h2>
      <form onSubmit={submit}>
        <label>
          Description
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          Unit price
          <input value={price} onChange={(event) => setPrice(event.target.value)} />
        </label>
        <button>{editing ? 'Save product' : 'Add product'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <ul>
        {products.map((entry) => (
          <li key={entry.id}>
            {entry.description} — {formatPrice(entry.unitPrice)}
            {' '}
            <button
              onClick={() => {
                setEditing(entry);
                setDescription(entry.description);
                setPrice(formatPrice(entry.unitPrice));
              }}
            >
              Edit
            </button>
            <button onClick={() => remove(entry)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
