import { useState } from 'react';
import { saveCustomers } from '../lib/storage.js';
import { asLines } from '../lib/formHelpers.js';

export default function Customers({ customers, refresh }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [lines, setLines] = useState('');

  function submit(event) {
    event.preventDefault();
    if (!name.trim()) return;

    const value = {
      id: editing?.id || crypto.randomUUID(),
      name: name.trim(),
      lines: asLines(lines),
    };
    saveCustomers(
      editing
        ? customers.map((entry) => (entry.id === editing.id ? value : entry))
        : [...customers, value],
    );
    setEditing(null);
    setName('');
    setLines('');
    refresh();
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
            <button
              onClick={() => {
                saveCustomers(customers.filter((candidate) => candidate.id !== entry.id));
                refresh();
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
