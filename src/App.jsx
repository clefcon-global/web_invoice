import { useState } from 'react';
import {
  loadCustomers,
  loadDocuments,
  loadOwner,
  loadProducts,
} from './lib/storage.js';
import DocumentForm from './components/DocumentForm.jsx';
import Customers from './components/Customers.jsx';
import Products from './components/Products.jsx';
import Settings from './components/Settings.jsx';
import History from './components/History.jsx';
import './index.css';

export default function App() {
  const [view, setView] = useState('document');
  const [revision, setRevision] = useState(0);

  const refresh = () => setRevision((value) => value + 1);
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
