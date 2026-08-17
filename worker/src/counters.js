/**
 * Atomic document numbering (SPEC.md §8.5, C4). Sealed like auth.js: this is
 * the correctness-critical seam — two concurrent callers must never receive
 * the same number. Do not edit — import and call.
 *
 * Safety comes from issuing the increment as a single SQL statement
 * (`UPDATE ... RETURNING`), never a separate read then write. D1 serializes
 * statement execution per database, and a single SQL statement is always
 * atomic in SQLite — so there is no window between "read current value" and
 * "write next value" for two requests to race into.
 */

const VALID_KINDS = new Set(['invoice', 'receipt']);

/** Atomically increment and return the next number for `kind` ('invoice' | 'receipt'). */
export async function issueNumber(db, kind) {
  if (!VALID_KINDS.has(kind)) {
    throw new Error(`Invalid counter kind: ${kind}`);
  }
  const [result] = await db.batch([
    db.prepare('UPDATE counters SET value = value + 1 WHERE name = ?1 RETURNING value').bind(kind),
  ]);
  const row = result?.results?.[0];
  if (!row) {
    throw new Error(`Counter not found: ${kind}`);
  }
  return row.value;
}
