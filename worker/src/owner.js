function toOwner(row) {
  if (!row) return null;
  return {
    businessName: row.business_name,
    addressLines: JSON.parse(row.address_lines),
    phone: row.phone,
    paymentHeading: row.payment_heading,
    paymentLines: JSON.parse(row.payment_lines),
    updatedAt: row.updated_at,
  };
}

export async function getOwner(db) {
  return toOwner(await db.prepare('SELECT business_name, address_lines, phone, payment_lines, payment_heading, updated_at FROM owner WHERE id = 1').first());
}

export async function upsertOwner(db, fields) {
  const result = await db.prepare(`INSERT INTO owner (id, business_name, address_lines, phone, payment_lines, payment_heading, updated_at)
VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6)
ON CONFLICT(id) DO UPDATE SET
  business_name = excluded.business_name,
  address_lines = excluded.address_lines,
  phone = excluded.phone,
  payment_lines = excluded.payment_lines,
  payment_heading = excluded.payment_heading,
  updated_at = excluded.updated_at
WHERE excluded.updated_at > owner.updated_at
RETURNING business_name, address_lines, phone, payment_lines, payment_heading, updated_at`)
    .bind(fields.businessName, JSON.stringify(fields.addressLines), fields.phone, JSON.stringify(fields.paymentLines), fields.paymentHeading, fields.updatedAt)
    .first();
  return toOwner(result || await db.prepare('SELECT business_name, address_lines, phone, payment_lines, payment_heading, updated_at FROM owner WHERE id = 1').first());
}
