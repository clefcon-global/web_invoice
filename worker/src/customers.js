function toCustomer(row) {
  return row && { id: row.id, name: row.name, lines: JSON.parse(row.lines), updatedAt: row.updated_at };
}

export async function listCustomers(db) {
  const { results } = await db.prepare('SELECT id, name, lines, updated_at FROM customers WHERE deleted_at IS NULL').run();
  return results.map(toCustomer);
}

export async function upsertCustomer(db, id, fields) {
  const row = await db.prepare(`INSERT INTO customers (id, name, lines, updated_at, deleted_at)
VALUES (?1, ?2, ?3, ?4, NULL)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, lines = excluded.lines, updated_at = excluded.updated_at, deleted_at = NULL
WHERE excluded.updated_at > customers.updated_at
RETURNING id, name, lines, updated_at`)
    .bind(id, fields.name, JSON.stringify(fields.lines), fields.updatedAt).first();
  return toCustomer(row || await db.prepare('SELECT id, name, lines, updated_at FROM customers WHERE id = ?1').bind(id).first());
}

export async function deleteCustomer(db, id, updatedAt) {
  const row = await db.prepare('UPDATE customers SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND ?2 > updated_at RETURNING id, deleted_at')
    .bind(id, updatedAt).first();
  if (row) return { id, deleted: true, updatedAt };
  const current = await db.prepare('SELECT id, deleted_at, updated_at FROM customers WHERE id = ?1').bind(id).first();
  if (!current) return null;
  return { id, deleted: current.deleted_at !== null, updatedAt: current.updated_at };
}
