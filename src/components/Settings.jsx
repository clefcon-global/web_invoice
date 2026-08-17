import { useState } from 'react';
import { downloadBlob } from '../lib/download.js';
import { exportSnapshot, importSnapshot, saveOwner } from '../lib/storage.js';
import { asLines, today } from '../lib/formHelpers.js';
import { pushCustomer, pushOwner, pushProduct } from '../lib/sync.js';

export default function Settings({ owner, refresh }) {
  const [value, setValue] = useState(
    owner || {
      businessName: '',
      addressLines: [],
      phone: '',
      paymentHeading: '',
      paymentLines: [],
    },
  );
  const [message, setMessage] = useState('');

  const update = (key, next) => setValue({ ...value, [key]: next });

  async function save(event) {
    event.preventDefault();

    const { addressLinesText, paymentLinesText, ...ownerValue } = value;
    const ownerToSave = {
      ...ownerValue,
      addressLines: asLines(addressLinesText ?? value.addressLines.join('\n')),
      paymentLines: asLines(paymentLinesText ?? value.paymentLines.join('\n')),
      updatedAt: Date.now(),
    };
    try {
      const authoritative = await pushOwner(ownerToSave);
      saveOwner(authoritative);
      setMessage('Profile saved.');
      refresh();
    } catch (caught) { setMessage(caught.message); }
  }

  function exportData() {
    downloadBlob(
      new Blob([JSON.stringify(exportSnapshot(), null, 2)], { type: 'application/json' }),
      `sheer-aura-backup-${today()}.json`,
    );
  }

  async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (window.confirm('Importing will replace all current data. Continue?')) {
        const now = Date.now();
        if (parsed.owner) await pushOwner({ ...parsed.owner, updatedAt: now });
        for (const customer of parsed.customers || []) {
          await pushCustomer({ ...customer, updatedAt: now });
        }
        for (const product of parsed.products || []) {
          await pushProduct({ ...product, updatedAt: now });
        }
        importSnapshot(parsed);
        window.location.reload();
      }
    } catch (caught) {
      setMessage(caught.message);
    }
  }

  return (
    <section>
      <h2>Settings</h2>
      <form onSubmit={save}>
        <label>
          Business name
          <input
            value={value.businessName}
            onChange={(event) => update('businessName', event.target.value)}
          />
        </label>
        <label>
          Address lines
          <textarea
            value={value.addressLinesText ?? value.addressLines.join('\n')}
            onChange={(event) => update('addressLinesText', event.target.value)}
          />
        </label>
        <label>
          Phone
          <input value={value.phone || ''} onChange={(event) => update('phone', event.target.value)} />
        </label>
        <label>
          Payment heading
          <input
            value={value.paymentHeading || ''}
            onChange={(event) => update('paymentHeading', event.target.value)}
          />
        </label>
        <label>
          Payment lines
          <textarea
            value={value.paymentLinesText ?? value.paymentLines.join('\n')}
            onChange={(event) => update('paymentLinesText', event.target.value)}
          />
        </label>
        <button>Save settings</button>
      </form>
      {message && <p>{message}</p>}
      <h3>Backup</h3>
      <button onClick={exportData}>Export</button>
      <label>
        Import
        <input type="file" accept="application/json" onChange={importData} />
      </label>
    </section>
  );
}
