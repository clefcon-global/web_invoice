-- D1 schema for the Sheer Aura invoicing workspace (SPEC.md §8).
-- Apply with: wrangler d1 execute <db-name> --file=worker/schema.sql

CREATE TABLE owner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  business_name TEXT NOT NULL,
  address_lines TEXT NOT NULL,   -- JSON array of strings
  phone TEXT NOT NULL,
  payment_lines TEXT NOT NULL,   -- JSON array of strings
  payment_heading TEXT,
  updated_at INTEGER NOT NULL    -- unix ms; last-write-wins
);

-- Column names mirror src/components/Customers.jsx's actual record shape
-- (`{ id, name, lines }`), not SPEC.md §8.2's aspirational address/contact —
-- Phase 3 already shipped `lines` as a free-form JSON array of address lines.
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lines TEXT NOT NULL,           -- JSON array of strings
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER             -- unix ms; NULL = active
);

-- Column names mirror src/components/Products.jsx's actual record shape
-- (`{ id, description, unitPrice }`), not SPEC.md §8.3's aspirational
-- name/default_price.
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  unit_price INTEGER NOT NULL,   -- cents
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- Document numbering (§8.5). value = count issued so far, so
-- `UPDATE counters SET value = value + 1 WHERE name = ?1 RETURNING value`
-- returns the number to issue in one atomic statement.
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT INTO counters (name, value) VALUES ('invoice', 0), ('receipt', 0);

-- Single-row auth throttle state (§9.2 rule 5). A global lockout, not
-- per-IP: this workspace has exactly one shared passphrase, so a global
-- throttle is sufficient and avoids needing a separate KV/IP-tracking layer.
CREATE TABLE auth_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  fail_count INTEGER NOT NULL DEFAULT 0,
  first_fail_at INTEGER,          -- unix ms of first failure in the current window
  locked_until INTEGER            -- unix ms; NULL = not locked
);
INSERT INTO auth_state (id, fail_count, first_fail_at, locked_until) VALUES (1, 0, NULL, NULL);
