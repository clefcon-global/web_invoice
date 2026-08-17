const TOKEN_KEY = 'sheer-aura-invoicing:v1:token';
const TOKEN_EXPIRY_KEY = 'sheer-aura-invoicing:v1:tokenExpiresAt';
const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

export function isAuthenticated() {
  return Boolean(localStorage.getItem(TOKEN_KEY)) && Number(localStorage.getItem(TOKEN_EXPIRY_KEY)) > Date.now();
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (response.status === 401) {
    logout();
    const error = new Error('Please sign in again.');
    error.code = 'unauthorized';
    throw error;
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}

export async function login(passphrase) {
  const response = await fetch(`${baseUrl}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase }) });
  const result = await response.json();
  if (response.ok) {
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(result.expiresAt));
    return;
  }
  if (response.status === 401) throw new Error('Incorrect passphrase.');
  if (response.status === 429) throw new Error('Too many attempts. Please try again later.');
  throw new Error(result.error || 'Could not sign in.');
}

export function fetchWorkspace() { return request('/api/workspace'); }
export function pushOwner(owner) { return request('/api/owner', { method: 'PUT', body: JSON.stringify(owner) }); }
export function pushCustomer(customer) { return request(`/api/customers/${encodeURIComponent(customer.id)}`, { method: 'PUT', body: JSON.stringify(customer) }); }
export function deleteCustomer(id, updatedAt) { return request(`/api/customers/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ updatedAt }) }); }
export function pushProduct(product) { return request(`/api/products/${encodeURIComponent(product.id)}`, { method: 'PUT', body: JSON.stringify(product) }); }
export function deleteProduct(id, updatedAt) { return request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ updatedAt }) }); }

export async function issueNumber(kind) {
  if (!navigator.onLine) throw new Error('offline');
  const result = await request('/api/issue', { method: 'POST', body: JSON.stringify({ kind }) });
  return result.number;
}
