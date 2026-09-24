const d1Config = () => ({
  accountId: String(process.env.CLOUDFLARE_D1_ACCOUNT_ID || '').trim(),
  databaseId: String(process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim(),
  apiToken: String(process.env.CLOUDFLARE_D1_API_TOKEN || '').trim(),
});

export const isD1InvoiceStoreConfigured = () => Object.values(d1Config()).every(Boolean);

const queryD1 = async (sql, params = []) => {
  const { accountId, databaseId, apiToken } = d1Config();
  if (!accountId || !databaseId || !apiToken) return null;
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) {
    const message = payload.errors?.[0]?.message || `Cloudflare D1 request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload.result;
};

const ensureSchema = () => queryD1(`CREATE TABLE IF NOT EXISTS invoice_workspace_snapshots (
  user_id TEXT PRIMARY KEY NOT NULL,
  dealer_code TEXT,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
)`);

export const saveInvoiceWorkspaceSnapshot = async (userId, dealerCode, snapshot) => {
  if (!isD1InvoiceStoreConfigured()) return false;
  await ensureSchema();
  const updatedAt = new Date().toISOString();
  await queryD1(
    `INSERT INTO invoice_workspace_snapshots (user_id, dealer_code, payload, updated_at, schema_version)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(user_id) DO UPDATE SET dealer_code = excluded.dealer_code,
       payload = excluded.payload, updated_at = excluded.updated_at, schema_version = excluded.schema_version`,
    [userId, String(dealerCode || ''), JSON.stringify(snapshot), updatedAt],
  );
  return true;
};
