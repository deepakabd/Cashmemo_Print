import { auth } from '../firebase';

const request = async (body) => {
  if (!auth.currentUser) throw new Error('Sign in to access Consumer Database.');
  const send = async (forceRefresh = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Sign in to access Consumer Database.');
    const token = await currentUser.getIdToken(forceRefresh);
    return fetch('/api/consumer-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  };
  let response = await send();
  // Retry once with a freshly minted Firebase ID token when the cached token
  // expired or predates the latest account claims.
  if (response.status === 401) response = await send(true);
  const result = await response.json();
  if (!response.ok) {
    const message = response.status === 401
      ? 'Login session expire ho gaya hai. Sign out karke dobara sign in karein.'
      : result.error || 'Consumer Database request failed.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return result;
};

export const loadConsumerDatabase = async (userId) => (await request({ mode: 'load', userId })).snapshot || null;
const chunkRows = (rows, targetSize = 250000) => {
  const chunks = [];
  let current = [];
  let size = 2;
  for (const row of rows) {
    const length = JSON.stringify(row).length + 1;
    if (current.length && size + length > targetSize) { chunks.push(current); current = []; size = 2; }
    current.push(row);
    size += length;
  }
  if (current.length) chunks.push(current);
  return chunks;
};

export const saveConsumerDatabase = async (userId, rows, metadata, onProgress) => {
  const { uploadId } = await request({ mode: 'save-start', userId });
  const chunks = chunkRows(rows);
  for (let index = 0; index < chunks.length; index += 1) {
    await request({ mode: 'save-chunk', userId, uploadId, chunkIndex: index, rows: chunks[index] });
    if (typeof onProgress === 'function') onProgress(index + 1, chunks.length);
  }
  return request({ mode: 'save-commit', userId, uploadId, chunkCount: chunks.length, rowCount: rows.length, metadata });
};
