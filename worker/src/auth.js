/**
 * Server-side passphrase auth (SPEC.md §9.2). Sealed like src/pdf/**: this is
 * the security-critical seam, designed and tested directly rather than via
 * the build handoff. Do not edit — import and call.
 *
 * Passphrase hash format: `pbkdf2$<iterations>$<saltBase64>$<hashBase64>`,
 * produced by scripts/hash-passphrase.mjs and stored as the Worker secret
 * AUTH_PASSPHRASE_HASH via `wrangler secret put`. The plaintext passphrase
 * never touches this codebase.
 *
 * Session tokens are stateless: `<payloadBase64>.<hmacSignatureBase64>`,
 * signed with the AUTH_TOKEN_SECRET Worker secret. No sessions table.
 */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_FAILED_ATTEMPTS = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(passphrase, salt, iterations, lengthBytes) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    lengthBytes * 8,
  );
  return new Uint8Array(bits);
}

/** Derive a `pbkdf2$...` hash string for a fresh passphrase. Used by scripts/hash-passphrase.mjs. */
export async function hashPassphrase(passphrase, iterations = 210000, saltBytes = 16, hashBytes = 32) {
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
  const derived = await pbkdf2(passphrase, salt, iterations, hashBytes);
  return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
}

/** Check a candidate passphrase against a stored `pbkdf2$...` hash. */
export async function verifyPassphrase(passphrase, storedHash) {
  const parts = String(storedHash).split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const [, iterationsStr, saltB64, hashB64] = parts;
  const iterations = Number(iterationsStr);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  const derived = await pbkdf2(passphrase, salt, iterations, expected.length);
  return constantTimeEqual(derived, expected);
}

async function hmacSign(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bytesToBase64(new Uint8Array(signature));
}

/** Issue a signed, time-limited session token. */
export async function issueToken(secret) {
  const payload = { iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS };
  const payloadB64 = bytesToBase64(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSign(secret, payloadB64);
  return { token: `${payloadB64}.${signature}`, expiresAt: payload.exp };
}

/** Verify a session token's signature and expiry. Returns boolean. */
export async function verifyToken(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;
  const expected = await hmacSign(secret, payloadB64);
  if (!constantTimeEqual(new TextEncoder().encode(signature), new TextEncoder().encode(expected))) {
    return false;
  }
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64ToBytes(payloadB64)));
  } catch {
    return false;
  }
  return Number.isFinite(payload?.exp) && payload.exp > Date.now();
}

/** Returns `{ locked: true, retryAt }` if the auth endpoint is currently throttled. */
export async function checkLockout(db) {
  const row = await db.prepare('SELECT locked_until FROM auth_state WHERE id = 1').first();
  if (row?.locked_until && row.locked_until > Date.now()) {
    return { locked: true, retryAt: row.locked_until };
  }
  return { locked: false };
}

/**
 * Record a failed passphrase attempt, locking out further attempts after
 * MAX_FAILED_ATTEMPTS within FAILURE_WINDOW_MS. This counter is a best-effort
 * throttle, not a correctness-critical sequence like the document counters —
 * a read-then-write race here can only make a brute-force lockout trigger a
 * request or two later than exactly N, which is an acceptable tradeoff for
 * not needing a second atomic-increment table.
 */
export async function recordFailure(db) {
  const now = Date.now();
  const row = await db.prepare('SELECT fail_count, first_fail_at FROM auth_state WHERE id = 1').first();
  const windowExpired = !row?.first_fail_at || now - row.first_fail_at > FAILURE_WINDOW_MS;
  const nextCount = windowExpired ? 1 : row.fail_count + 1;
  const nextFirstFail = windowExpired ? now : row.first_fail_at;
  const lockedUntil = nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : null;
  await db
    .prepare('UPDATE auth_state SET fail_count = ?1, first_fail_at = ?2, locked_until = ?3 WHERE id = 1')
    .bind(nextCount, nextFirstFail, lockedUntil)
    .run();
}

/** Reset the throttle state after a successful passphrase check. */
export async function recordSuccess(db) {
  await db
    .prepare('UPDATE auth_state SET fail_count = 0, first_fail_at = NULL, locked_until = NULL WHERE id = 1')
    .run();
}
