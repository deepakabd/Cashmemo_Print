import { randomUUID } from 'node:crypto';

const config = () => ({
  accountId: String(process.env.CLOUDFLARE_D1_ACCOUNT_ID || '').trim(),
  databaseId: String(process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim(),
  apiToken: String(process.env.CLOUDFLARE_D1_API_TOKEN || '').trim(),
});

let schemaReadyPromise = null;

const query = async (sql, params = []) => {
  const { accountId, databaseId, apiToken } = config();
  if (!accountId || !databaseId || !apiToken) throw new Error('Cloudflare D1 consumer database is not configured.');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) throw new Error(payload.errors?.[0]?.message || `Cloudflare D1 request failed (${response.status}).`);
  return payload.result?.[0]?.results || [];
};

const ensureSchema = async () => {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
  await query(`CREATE TABLE IF NOT EXISTS consumer_database_snapshots (
    user_id TEXT PRIMARY KEY NOT NULL, dealer_code TEXT NOT NULL, upload_id TEXT NOT NULL,
    file_name TEXT, row_count INTEGER NOT NULL DEFAULT 0, chunk_count INTEGER NOT NULL DEFAULT 0,
    uploaded_at TEXT NOT NULL, schema_version INTEGER NOT NULL DEFAULT 1
  )`);
  await query(`CREATE TABLE IF NOT EXISTS consumer_database_chunks (
    user_id TEXT NOT NULL, upload_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, payload TEXT NOT NULL,
    PRIMARY KEY (user_id, upload_id, chunk_index)
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_consumer_database_dealer ON consumer_database_snapshots (dealer_code)');
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });
  return schemaReadyPromise;
};

export const loadConsumerDatabaseMetadata = async (userId) => {
  await ensureSchema();
  const snapshots = await query(`SELECT upload_id, file_name, row_count, chunk_count, uploaded_at
    FROM consumer_database_snapshots WHERE user_id = ? LIMIT 1`, [userId]);
  const snapshot = snapshots[0];
  if (!snapshot) return null;
  return {
    uploadId: snapshot.upload_id,
    fileName: snapshot.file_name || 'Consumer database',
    totalRows: Number(snapshot.row_count || 0),
    chunkCount: Number(snapshot.chunk_count || 0),
    uploadedAt: snapshot.uploaded_at,
  };
};

const chunkRows = (rows, targetSize = 350000) => {
  const chunks = [];
  let current = [];
  let size = 2;
  for (const row of rows) {
    const encoded = JSON.stringify(row);
    if (current.length && size + encoded.length + 1 > targetSize) {
      chunks.push(current);
      current = [];
      size = 2;
    }
    current.push(row);
    size += encoded.length + 1;
  }
  if (current.length) chunks.push(current);
  return chunks;
};

export const saveConsumerDatabase = async (userId, dealerCode, rows, metadata = {}) => {
  await ensureSchema();
  const uploadId = randomUUID();
  const chunks = chunkRows(rows);
  for (let index = 0; index < chunks.length; index += 1) {
    await query(`INSERT INTO consumer_database_chunks (user_id, upload_id, chunk_index, payload)
      VALUES (?, ?, ?, ?)`, [userId, uploadId, index, JSON.stringify(chunks[index])]);
  }
  const uploadedAt = String(metadata.uploadedAt || new Date().toISOString());
  await query(`INSERT INTO consumer_database_snapshots
    (user_id, dealer_code, upload_id, file_name, row_count, chunk_count, uploaded_at, schema_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(user_id) DO UPDATE SET dealer_code=excluded.dealer_code, upload_id=excluded.upload_id,
    file_name=excluded.file_name, row_count=excluded.row_count, chunk_count=excluded.chunk_count,
    uploaded_at=excluded.uploaded_at, schema_version=excluded.schema_version`,
  [userId, dealerCode, uploadId, String(metadata.fileName || ''), rows.length, chunks.length, uploadedAt]);
  await query('DELETE FROM consumer_database_chunks WHERE user_id = ? AND upload_id <> ?', [userId, uploadId]);
  return { uploadedAt, chunkCount: chunks.length };
};

export const beginConsumerDatabaseUpload = async () => {
  await ensureSchema();
  return randomUUID();
};

export const appendConsumerDatabaseChunk = async (userId, uploadId, chunkIndex, rows) => {
  await ensureSchema();
  await query(`INSERT INTO consumer_database_chunks (user_id, upload_id, chunk_index, payload)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, upload_id, chunk_index) DO UPDATE SET payload=excluded.payload`,
  [userId, uploadId, chunkIndex, JSON.stringify(rows)]);
};

export const commitConsumerDatabaseUpload = async (userId, dealerCode, uploadId, metadata = {}, rowCount = 0, chunkCount = 0) => {
  await ensureSchema();
  const stored = await query(`SELECT COUNT(*) AS count FROM consumer_database_chunks
    WHERE user_id = ? AND upload_id = ?`, [userId, uploadId]);
  if (Number(stored[0]?.count || 0) !== chunkCount) throw new Error('Consumer upload is incomplete. Please retry.');
  const uploadedAt = String(metadata.uploadedAt || new Date().toISOString());
  await query(`INSERT INTO consumer_database_snapshots
    (user_id, dealer_code, upload_id, file_name, row_count, chunk_count, uploaded_at, schema_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(user_id) DO UPDATE SET dealer_code=excluded.dealer_code, upload_id=excluded.upload_id,
    file_name=excluded.file_name, row_count=excluded.row_count, chunk_count=excluded.chunk_count,
    uploaded_at=excluded.uploaded_at, schema_version=excluded.schema_version`,
  [userId, dealerCode, uploadId, String(metadata.fileName || ''), rowCount, chunkCount, uploadedAt]);
  await query('DELETE FROM consumer_database_chunks WHERE user_id = ? AND upload_id <> ?', [userId, uploadId]);
  return { uploadId, uploadedAt, chunkCount };
};

export const loadConsumerDatabase = async (userId) => {
  const metadata = await loadConsumerDatabaseMetadata(userId);
  if (!metadata) return null;
  const chunks = await query(`SELECT payload FROM consumer_database_chunks
    WHERE user_id = ? AND upload_id = ? ORDER BY chunk_index`, [userId, metadata.uploadId]);
  const rows = chunks.flatMap((chunk) => { try { const value = JSON.parse(chunk.payload); return Array.isArray(value) ? value : []; } catch { return []; } });
  return { rows, metadata };
};

let operationalSchemaReadyPromise = null;
const ensureOperationalSchema = async () => {
  if (operationalSchemaReadyPromise) return operationalSchemaReadyPromise;
  operationalSchemaReadyPromise = (async () => {
    await ensureSchema();
    await query(`CREATE TABLE IF NOT EXISTS operational_data_snapshots (
    user_id TEXT NOT NULL, data_type TEXT NOT NULL, upload_id TEXT NOT NULL, file_name TEXT,
    row_count INTEGER NOT NULL DEFAULT 0, chunk_count INTEGER NOT NULL DEFAULT 0, uploaded_at TEXT NOT NULL,
    PRIMARY KEY (user_id, data_type)
  )`);
    await query(`CREATE TABLE IF NOT EXISTS operational_data_chunks (
    user_id TEXT NOT NULL, data_type TEXT NOT NULL, upload_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, payload TEXT NOT NULL,
    PRIMARY KEY (user_id, data_type, upload_id, chunk_index)
  )`);
  })().catch((error) => {
    operationalSchemaReadyPromise = null;
    throw error;
  });
  return operationalSchemaReadyPromise;
};

export const loadOperationalMetadata = async (userId, dataType) => {
  await ensureOperationalSchema();
  const rows = await query(`SELECT upload_id, file_name, row_count, chunk_count, uploaded_at FROM operational_data_snapshots
    WHERE user_id = ? AND data_type = ? LIMIT 1`, [userId, dataType]);
  const row = rows[0];
  return row ? { uploadId: row.upload_id, fileName: row.file_name, totalRows: Number(row.row_count), chunkCount: Number(row.chunk_count), uploadedAt: row.uploaded_at } : null;
};
export const appendOperationalChunk = async (userId, dataType, uploadId, chunkIndex, rows) => {
  await ensureOperationalSchema();
  await query(`INSERT INTO operational_data_chunks (user_id,data_type,upload_id,chunk_index,payload) VALUES (?,?,?,?,?)`, [userId, dataType, uploadId, chunkIndex, JSON.stringify(rows)]);
};
export const commitOperationalUpload = async (userId, dataType, uploadId, metadata, rowCount, chunkCount) => {
  await ensureOperationalSchema();
  const uploadedAt = String(metadata?.uploadedAt || new Date().toISOString());
  await query(`INSERT INTO operational_data_snapshots (user_id,data_type,upload_id,file_name,row_count,chunk_count,uploaded_at)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,data_type) DO UPDATE SET upload_id=excluded.upload_id,file_name=excluded.file_name,row_count=excluded.row_count,chunk_count=excluded.chunk_count,uploaded_at=excluded.uploaded_at`,
  [userId, dataType, uploadId, String(metadata?.fileName || ''), rowCount, chunkCount, uploadedAt]);
  await query(`DELETE FROM operational_data_chunks WHERE user_id=? AND data_type=? AND upload_id<>?`, [userId, dataType, uploadId]);
  return { uploadId, uploadedAt, chunkCount };
};
export const loadOperationalData = async (userId, dataType) => {
  const metadata = await loadOperationalMetadata(userId, dataType);
  if (!metadata) return null;
  const chunks = await query(`SELECT payload FROM operational_data_chunks WHERE user_id=? AND data_type=? AND upload_id=? ORDER BY chunk_index`, [userId, dataType, metadata.uploadId]);
  return { metadata, rows: chunks.flatMap((chunk) => { try { const value = JSON.parse(chunk.payload); return Array.isArray(value) ? value : []; } catch { return []; } }) };
};
