CREATE TABLE IF NOT EXISTS invoice_workspace_snapshots (
  user_id TEXT PRIMARY KEY NOT NULL,
  dealer_code TEXT,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_invoice_workspace_dealer
  ON invoice_workspace_snapshots (dealer_code);

CREATE TABLE IF NOT EXISTS dealer_product_rates (
  user_id TEXT NOT NULL,
  dealer_code TEXT NOT NULL,
  product_key TEXT NOT NULL,
  product_code TEXT,
  item_name TEXT NOT NULL,
  hsn_code TEXT,
  basic_price REAL,
  sgst REAL,
  cgst REAL,
  rsp REAL,
  rate_month TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  payload TEXT NOT NULL,
  PRIMARY KEY (user_id, effective_from, product_key)
);

CREATE INDEX IF NOT EXISTS idx_dealer_product_rates_lookup
  ON dealer_product_rates (dealer_code, effective_from, item_name);

CREATE TABLE IF NOT EXISTS pending_booking_snapshots (
  user_id TEXT PRIMARY KEY NOT NULL,
  dealer_code TEXT NOT NULL,
  payload TEXT NOT NULL,
  file_name TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_pending_booking_dealer
  ON pending_booking_snapshots (dealer_code);

CREATE TABLE IF NOT EXISTS consumer_database_snapshots (
  user_id TEXT PRIMARY KEY NOT NULL,
  dealer_code TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  file_name TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS consumer_database_chunks (
  user_id TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (user_id, upload_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_consumer_database_dealer
  ON consumer_database_snapshots (dealer_code);
