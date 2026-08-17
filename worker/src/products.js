function toProduct(row) {
  return row && { id: row.id, description: row.description, unitPrice: row.unit_price, updatedAt: row.updated_at };
}

export async function listProducts(db) {
  const { results } = await db.prepare('SELECT id, description, unit_price, updated_at FROM products WHERE deleted_at IS NULL').run();
  return results.map(toProduct);
}

export async function upsertProduct(db, id, fields) {
  const row = await db.prepare(`INSERT INTO products (id, description, unit_price, updated_at, deleted_at)
VALUES (?1, ?2, ?3, ?4, NULL)
ON CONFLICT(id) DO UPDATE SET
  description = excluded.description, unit_price = excluded.unit_price, updated_at = excluded.updated_at, deleted_at = NULL
WHERE excluded.updated_at > products.updated_at
RETURNING id, description, unit_price, updated_at`)
    .bind(id, fields.description, fields.unitPrice, fields.updatedAt).first();
  return toProduct(row || await db.prepare('SELECT id, description, unit_price, updated_at FROM products WHERE id = ?1').bind(id).first());
}

export async function deleteProduct(db, id, updatedAt) {
  const row = await db.prepare('UPDATE products SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND ?2 > updated_at RETURNING id, deleted_at')
    .bind(id, updatedAt).first();
  if (row) return { id, deleted: true, updatedAt };
  const current = await db.prepare('SELECT id, deleted_at, updated_at FROM products WHERE id = ?1').bind(id).first();
  if (!current) return null;
  return { id, deleted: current.deleted_at !== null, updatedAt: current.updated_at };
}
