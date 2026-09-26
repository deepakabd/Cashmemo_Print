import { auth } from '../firebase';

const request = async (body) => {
  if (!auth.currentUser) throw new Error('Sign in to access this workspace.');
  const send = async (refresh = false) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in to access this workspace.');
    const token = await user.getIdToken(refresh);
    return fetch('/api/consumer-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  };
  let response = await send();
  if (response.status === 401) response = await send(true);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Data request failed.');
  return result;
};

export const loadOperationalMetadata = async (userId, dataType) =>
  (await request({ mode: 'head', userId, dataType })).metadata || null;

export const loadOperationalData = async (userId, dataType) =>
  (await request({ mode: 'load', userId, dataType })).snapshot || null;

const chunkRows = (rows, targetSize = 250000) => {
  const chunks = [];
  let current = [];
  let size = 2;
  rows.forEach((row) => {
    const rowSize = JSON.stringify(row).length + 1;
    if (current.length && size + rowSize > targetSize) {
      chunks.push(current);
      current = [];
      size = 2;
    }
    current.push(row);
    size += rowSize;
  });
  if (current.length) chunks.push(current);
  return chunks;
};

export const saveOperationalData = async (userId, dataType, rows, metadata, onProgress) => {
  const { uploadId } = await request({ mode: 'save-start', userId, dataType });
  const chunks = chunkRows(rows);
  let nextIndex = 0;
  let completed = 0;
  const worker = async () => {
    while (nextIndex < chunks.length) {
      const index = nextIndex++;
      await request({ mode: 'save-chunk', userId, dataType, uploadId, chunkIndex: index, rows: chunks[index] });
      completed += 1;
      onProgress?.(completed, chunks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, chunks.length) }, worker));
  return request({ mode: 'save-commit', userId, dataType, uploadId, chunkCount: chunks.length, rowCount: rows.length, metadata });
};
