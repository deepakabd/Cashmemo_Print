import { getAdmin, LoginError } from './loginService.js';
import { getUserAccountStatus } from '../src/utils/userAccountStatus.js';
import { appendConsumerDatabaseChunk, appendOperationalChunk, beginConsumerDatabaseUpload, commitConsumerDatabaseUpload, commitOperationalUpload, loadConsumerDatabase, loadConsumerDatabaseMetadata, loadOperationalData, loadOperationalMetadata, saveConsumerDatabase } from './d1ConsumerDatabaseStore.js';

const fail = (message, status = 400) => { throw new LoginError('consumer-database-error', message, status); };

export const consumerDatabaseWorkspace = async (authorization, body) => {
  const token = /^Bearer (.+)$/i.exec(String(authorization || ''))?.[1];
  if (!token) fail('Sign in to access Consumer Database.', 401);
  const { auth, firestore } = await getAdmin();
  let claims;
  try { claims = await auth.verifyIdToken(token, true); } catch { fail('Sign in again to access Consumer Database.', 401); }
  const userId = String(body?.userId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId)) fail('Valid dealer account required.');
  const user = await firestore.collection('users').doc(userId).get();
  const data = user.data();
  if (!user.exists || claims.dealerCode !== data?.dealerCode || claims.accountActive !== true || claims.planActive !== true || getUserAccountStatus(data) !== 'active') fail('Consumer Database access is not allowed.', 403);
  const dataType = String(body.dataType || '');
  if (['pendingEkyc', 'pendingMi'].includes(dataType)) {
    if (body.mode === 'head') return { metadata: await loadOperationalMetadata(userId, dataType) };
    if (body.mode === 'load') return { snapshot: await loadOperationalData(userId, dataType) };
    if (claims.role === 'viewer' || data?.role === 'viewer') fail('This account has read-only access.', 403);
    if (body.mode === 'save-start') return { uploadId: await beginConsumerDatabaseUpload() };
    if (body.mode === 'save-chunk') {
      if (!/^[0-9a-f-]{36}$/i.test(String(body.uploadId || '')) || !Number.isInteger(body.chunkIndex) || body.chunkIndex < 0 || !Array.isArray(body.rows) || body.rows.length > 1000) fail('Invalid pending-data upload chunk.');
      if (Buffer.byteLength(JSON.stringify(body.rows), 'utf8') > 500000) fail('Pending-data upload chunk is too large.', 413);
      await appendOperationalChunk(userId, dataType, body.uploadId, body.chunkIndex, body.rows);
      return { saved: true, chunkIndex: body.chunkIndex };
    }
    if (body.mode === 'save-commit') {
      if (!/^[0-9a-f-]{36}$/i.test(String(body.uploadId || '')) || !Number.isInteger(body.chunkCount) || body.chunkCount < 1 || !Number.isInteger(body.rowCount) || body.rowCount < 1 || body.rowCount > 100000) fail('Invalid pending-data upload summary.');
      return { saved: true, count: body.rowCount, ...(await commitOperationalUpload(userId, dataType, body.uploadId, body.metadata, body.rowCount, body.chunkCount)) };
    }
    fail('Unsupported pending-data operation.');
  }
  if (body.mode === 'head') return { metadata: await loadConsumerDatabaseMetadata(userId) };
  if (body.mode === 'load') return { snapshot: await loadConsumerDatabase(userId) };
  if (body.mode === 'save-start') {
    if (claims.role === 'viewer' || data?.role === 'viewer') fail('This account has read-only access.', 403);
    return { uploadId: await beginConsumerDatabaseUpload() };
  }
  if (body.mode === 'save-chunk') {
    if (claims.role === 'viewer' || data?.role === 'viewer') fail('This account has read-only access.', 403);
    if (!/^[0-9a-f-]{36}$/i.test(String(body.uploadId || '')) || !Number.isInteger(body.chunkIndex) || body.chunkIndex < 0 || !Array.isArray(body.rows) || body.rows.length > 1000) fail('Invalid consumer upload chunk.');
    if (Buffer.byteLength(JSON.stringify(body.rows), 'utf8') > 500000) fail('Consumer upload chunk is too large.', 413);
    await appendConsumerDatabaseChunk(userId, body.uploadId, body.chunkIndex, body.rows);
    return { saved: true, chunkIndex: body.chunkIndex };
  }
  if (body.mode === 'save-commit') {
    if (claims.role === 'viewer' || data?.role === 'viewer') fail('This account has read-only access.', 403);
    if (!/^[0-9a-f-]{36}$/i.test(String(body.uploadId || '')) || !Number.isInteger(body.chunkCount) || body.chunkCount < 1 || !Number.isInteger(body.rowCount) || body.rowCount < 1 || body.rowCount > 100000) fail('Invalid consumer upload summary.');
    const saved = await commitConsumerDatabaseUpload(userId, data.dealerCode, body.uploadId, body.metadata, body.rowCount, body.chunkCount);
    return { saved: true, count: body.rowCount, ...saved };
  }
  if (body.mode !== 'save' || !Array.isArray(body.rows) || body.rows.length > 100000) fail('Valid consumer data required.');
  if (claims.role === 'viewer' || data?.role === 'viewer') fail('This account has read-only access.', 403);
  const saved = await saveConsumerDatabase(userId, data.dealerCode, body.rows, body.metadata);
  return { saved: true, count: body.rows.length, ...saved };
};
