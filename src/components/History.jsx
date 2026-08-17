import { useState } from 'react';
import { renderDocumentBlob, suggestedFilename } from '../pdf/index.js';
import { loadDocumentAssets } from '../lib/pdfAssets.js';
import { computeTotals, formatAmount } from '../lib/money.js';
import { downloadBlob } from '../lib/download.js';

export default function History({ documents }) {
  const [error, setError] = useState('');

  async function redownload(record) {
    try {
      downloadBlob(
        await renderDocumentBlob(record.input, await loadDocumentAssets()),
        suggestedFilename(record.input),
      );
    } catch (caught) {
      setError(caught.message);
    }
  }

  return (
    <section>
      <h2>History</h2>
      {error && <p role="alert">{error}</p>}
      <ul>
        {documents.map((record) => (
          <li key={record.id}>
            {record.kind} #{record.number} — {record.input.customer.name} —{' '}
            {record.input.date instanceof Date
              ? record.input.date.toLocaleDateString()
              : record.input.date}{' '}
            —{' '}
            {formatAmount(
              computeTotals(record.input.items, {
                deliveryCents: record.input.deliveryCents,
                taxPercent: record.input.taxPercent,
              }).total,
            )}{' '}
            <button onClick={() => redownload(record)}>Re-download</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
