import { useState } from 'react';
import { saveCustomers } from '../lib/storage.js';
import { asLines } from '../lib/formHelpers.js';
import { deleteCustomer, pushCustomer } from '../lib/sync.js';

export default function Customers({ customers, refresh }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [lines, setLines] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!name.trim()) return;

    const value = {
      id: editing?.id || crypto.randomUUID(),
      name: name.trim(),
      lines: asLines(lines),
      updatedAt: Date.now(),
    };
    try {
      const authoritative = await pushCustomer(value);
      saveCustomers(editing ? customers.map((entry) => (entry.id === authoritative.id ? authoritative : entry)) : [...customers, authoritative]);
    } catch (caught) {
      setError(caught.message);
      return;
    }
    setEditing(null);
    setName('');
    setLines('');
    refresh();
  }

  async function remove(entry) {
    try {
      await deleteCustomer(entry.id, Date.now());
      saveCustomers(customers.filter((candidate) => candidate.id !== entry.id));
      refresh();
    } catch (caught) { setError(caught.message); }
  }

  return (
    <section>
      <h2>Customers</h2>
      <form onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Address lines
          <textarea value={lines} onChange={(event) => setLines(event.target.value)} />
        </label>
        <button>{editing ? 'Save customer' : 'Add customer'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <ul>
        {customers.map((entry) => (
          <li key={entry.id}>
            {entry.name}
            {' '}
            <button
              onClick={() => {
                setEditing(entry);
                setName(entry.name);
                setLines((entry.lines || []).join('\n'));
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
