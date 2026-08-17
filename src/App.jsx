import { useEffect, useState } from 'react';
import {
  loadCustomers,
  loadDocuments,
  loadOwner,
  loadProducts,
  saveCounters,
  saveCustomers,
  saveOwner,
  saveProducts,
} from './lib/storage.js';
import { fetchWorkspace, isAuthenticated } from './lib/sync.js';
import DocumentForm from './components/DocumentForm.jsx';
import Customers from './components/Customers.jsx';
import Products from './components/Products.jsx';
import Settings from './components/Settings.jsx';
import History from './components/History.jsx';
import Login from './components/Login.jsx';
import './index.css';

export default function App() {
  const [view, setView] = useState('document');
  const [revision, setRevision] = useState(0);
  const [, setCacheRevision] = useState(0);
  const [authed, setAuthed] = useState(isAuthenticated());
  const [syncError, setSyncError] = useState('');

  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    if (!authed) return undefined;
    let current = true;
    fetchWorkspace().then((workspace) => {
      if (!current) return;
      saveOwner(workspace.owner);
      saveCustomers(workspace.customers);
      saveProducts(workspace.products);
      saveCounters(workspace.counters);
      setSyncError('');
      setCacheRevision((value) => value + 1);
    }).catch((caught) => {
      if (!current) return;
      if (caught.code === 'unauthorized') setAuthed(false);
      else setSyncError('Could not reach the server — showing cached data.');
    });
    return () => { current = false; };
  }, [authed, revision]);

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  const owner = loadOwner();
  const customers = loadCustomers();
  const products = loadProducts();
  const documents = loadDocuments();

  return (
    <main>
      <header>
        <h1>Sheer Aura Invoicing</h1>
        <nav>
          {[
            ['document', 'New document'],
            ['customers', 'Customers'],
            ['products', 'Products'],
            ['history', 'History'],
            ['settings', 'Settings'],
          ].map(([id, label]) => (
            <button
              className={view === id ? 'active' : ''}
              key={id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      {syncError && <p role="alert">{syncError}</p>}

      {view === 'document' && (
        <DocumentForm
          key={revision}
          owner={owner}
          customers={customers}
          products={products}
          onIssued={refresh}
        />
      )}
      {view === 'customers' && <Customers customers={customers} refresh={refresh} />}
      {view === 'products' && <Products products={products} refresh={refresh} />}
      {view === 'settings' && <Settings owner={owner} refresh={refresh} />}
      {view === 'history' && <History documents={documents} />}
    </main>
  );
}
