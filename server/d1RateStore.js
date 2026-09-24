import { createHash } from 'node:crypto';

const config = () => ({
  accountId: String(process.env.CLOUDFLARE_D1_ACCOUNT_ID || '').trim(),
  databaseId: String(process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim(),
  apiToken: String(process.env.CLOUDFLARE_D1_API_TOKEN || '').trim(),
});

const query = async (sql, params = []) => {
  const { accountId, databaseId, apiToken } = config();
  if (!accountId || !databaseId || !apiToken) throw new Error('Cloudflare D1 rate storage is not configured.');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) throw new Error(payload.errors?.[0]?.message || `Cloudflare D1 request failed (${response.status}).`);
  return payload.result?.[0]?.results || [];
};

const ensureSchema = () => query(`CREATE TABLE IF NOT EXISTS dealer_product_rates (
  user_id TEXT NOT NULL, dealer_code TEXT NOT NULL, product_key TEXT NOT NULL,
  product_code TEXT, item_name TEXT NOT NULL, hsn_code TEXT, basic_price REAL,
  sgst REAL, cgst REAL, rsp REAL, rate_month TEXT NOT NULL, effective_from TEXT NOT NULL,
  status TEXT NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL, approved_at TEXT,
  payload TEXT NOT NULL,
  PRIMARY KEY (user_id, effective_from, product_key)
)`);

export const saveDealerRates = async (userId, dealerCode, rates) => {
  await ensureSchema();
  const now = new Date().toISOString();
  for (const row of rates) {
    const item = String(row.Item || '').trim();
    const effectiveFrom = String(row.RateEffectiveFrom || '').trim();
    if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) continue;
    const productKey = createHash('sha256').update(`${String(row.Code || '').trim()}|${item.toLowerCase()}`).digest('hex');
    await query(`INSERT INTO dealer_product_rates
      (user_id, dealer_code, product_key, product_code, item_name, hsn_code, basic_price, sgst, cgst, rsp, rate_month, effective_from, status, updated_by, updated_at, approved_at, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, effective_from, product_key) DO UPDATE SET dealer_code=excluded.dealer_code,
      product_code=excluded.product_code, item_name=excluded.item_name, hsn_code=excluded.hsn_code,
      basic_price=excluded.basic_price, sgst=excluded.sgst, cgst=excluded.cgst, rsp=excluded.rsp,
      rate_month=excluded.rate_month, status=excluded.status, updated_by=excluded.updated_by,
      updated_at=excluded.updated_at, approved_at=excluded.approved_at, payload=excluded.payload`,
    [userId, dealerCode, productKey, String(row.Code ?? ''), item, String(row.HSNCode ?? ''), Number(row.BasicPrice || 0), Number(row.SGST || 0), Number(row.CGST || 0), Number(row.RSP || 0), String(row.RateMonth || effectiveFrom.slice(0, 7)), effectiveFrom, String(row.RateStatus || 'Pending'), String(row.RateUpdatedBy || ''), String(row.RateUpdatedAt || now), row.RateApprovedAt ? String(row.RateApprovedAt) : null, JSON.stringify(row)]);
  }
  return true;
};

export const loadDealerRates = async (userId) => {
  await ensureSchema();
  const rows = await query('SELECT payload FROM dealer_product_rates WHERE user_id = ? ORDER BY effective_from, item_name', [userId]);
  return rows.map((row) => { try { return JSON.parse(row.payload); } catch { return null; } }).filter(Boolean);
};
