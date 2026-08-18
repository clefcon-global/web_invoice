import { checkLockout, issueToken, recordFailure, recordSuccess, verifyPassphrase, verifyToken } from './auth.js';
import { issueNumber } from './counters.js';
import { deleteCustomer, listCustomers, upsertCustomer } from './customers.js';
import { getOwner, upsertOwner } from './owner.js';
import { deleteProduct, listProducts, upsertProduct } from './products.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

async function authorized(request, env) {
  const match = request.headers.get('Authorization')?.match(/^Bearer (.+)$/);
  return Boolean(match && await verifyToken(match[1], env.AUTH_TOKEN_SECRET));
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return response({});
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api')) return response({ error: 'not_found' }, 404);
      if (url.pathname === '/api/auth' && request.method === 'POST') {
        const locked = await checkLockout(env.DB);
        if (locked.locked) return response({ error: 'locked', retryAt: locked.retryAt }, 429);
        const { passphrase } = await body(request);
        if (!await verifyPassphrase(passphrase, env.AUTH_PASSPHRASE_HASH)) {
          await recordFailure(env.DB);
          return response({ error: 'invalid_passphrase' }, 401);
        }
        await recordSuccess(env.DB);
        return response(await issueToken(env.AUTH_TOKEN_SECRET));
      }
      if (!await authorized(request, env)) return response({ error: 'unauthorized' }, 401);
      if (url.pathname === '/api/workspace' && request.method === 'GET') {
        const counters = await env.DB.prepare('SELECT name, value FROM counters').run();
        return response({ owner: await getOwner(env.DB), customers: await listCustomers(env.DB), products: await listProducts(env.DB), counters: Object.fromEntries(counters.results.map(({ name, value }) => [name, value])) });
      }
      const fields = await body(request);
      if (url.pathname === '/api/owner' && request.method === 'PUT') return response(await upsertOwner(env.DB, fields));
      const customer = url.pathname.match(/^\/api\/customers\/([^/]+)$/);
      if (customer) {
        const id = decodeURIComponent(customer[1]);
        if (request.method === 'PUT') return response(await upsertCustomer(env.DB, id, fields));
        if (request.method === 'DELETE') {
          const result = await deleteCustomer(env.DB, id, fields.updatedAt);
          return result ? response(result) : response({ error: 'not_found' }, 404);
        }
      }
      const product = url.pathname.match(/^\/api\/products\/([^/]+)$/);
      if (product) {
        const id = decodeURIComponent(product[1]);
        if (request.method === 'PUT') return response(await upsertProduct(env.DB, id, fields));
        if (request.method === 'DELETE') {
          const result = await deleteProduct(env.DB, id, fields.updatedAt);
          return result ? response(result) : response({ error: 'not_found' }, 404);
        }
      }
      if (url.pathname === '/api/issue' && request.method === 'POST') {
        if (!['invoice', 'receipt'].includes(fields.kind)) return response({ error: 'invalid_kind' }, 400);
        return response({ number: await issueNumber(env.DB, fields.kind) });
      }
      return response({ error: 'not_found' }, 404);
    } catch (err) {
      console.error(err);
      return response({ error: 'internal' }, 500);
    }
  },
};
