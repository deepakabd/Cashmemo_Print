CREATE TABLE IF NOT EXISTS invoice_workspace_snapshots (
  user_id TEXT PRIMARY KEY NOT NULL,
  dealer_code TEXT,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_invoice_workspace_dealer
  ON invoice_workspace_snapshots (dealer_code);
