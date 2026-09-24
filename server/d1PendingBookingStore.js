const config = () => ({
  accountId: String(process.env.CLOUDFLARE_D1_ACCOUNT_ID || '').trim(),
  databaseId: String(process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim(),
  apiToken: String(process.env.CLOUDFLARE_D1_API_TOKEN || '').trim(),
});

const query = async (sql, params = []) => {
  const { accountId, databaseId, apiToken } = config();
  if (!accountId || !databaseId || !apiToken) throw new Error('Cloudflare D1 pending-booking storage is not configured.');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) throw new Error(payload.errors?.[0]?.message || `Cloudflare D1 request failed (${response.status}).`);
  return payload.result?.[0]?.results || [];
};

const ensureSchema = async () => {
  await query(`CREATE TABLE IF NOT EXISTS pending_booking_snapshots (
    user_id TEXT PRIMARY KEY NOT NULL,
    dealer_code TEXT NOT NULL,
    payload TEXT NOT NULL,
    file_name TEXT,
    row_count INTEGER NOT NULL DEFAULT 0,
    uploaded_at TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_pending_booking_dealer ON pending_booking_snapshots (dealer_code)');
};

export const savePendingBookingSnapshot = async (userId, dealerCode, rows, metadata = {}) => {
  await ensureSchema();
  const uploadedAt = String(metadata.uploadedAt || new Date().toISOString());
  await query(`INSERT INTO pending_booking_snapshots
    (user_id, dealer_code, payload, file_name, row_count, uploaded_at, schema_version)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(user_id) DO UPDATE SET dealer_code=excluded.dealer_code,
    payload=excluded.payload, file_name=excluded.file_name, row_count=excluded.row_count,
    uploaded_at=excluded.uploaded_at, schema_version=excluded.schema_version`,
  [userId, dealerCode, JSON.stringify(rows), String(metadata.fileName || ''), rows.length, uploadedAt]);
  return { uploadedAt };
};

export const loadPendingBookingSnapshot = async (userId) => {
  await ensureSchema();
  const rows = await query(`SELECT payload, file_name, row_count, uploaded_at
    FROM pending_booking_snapshots WHERE user_id = ? LIMIT 1`, [userId]);
  if (!rows[0]) return null;
  let data;
  try { data = JSON.parse(rows[0].payload); } catch { data = []; }
  return {
    rows: Array.isArray(data) ? data : [],
    metadata: {
      fileName: rows[0].file_name || 'Cloud pending booking data',
      totalRows: Number(rows[0].row_count || 0),
      uploadedAt: rows[0].uploaded_at,
    },
  };
};
