import { auth } from '../firebase';

let deniedReads = new WeakMap();
const pendingReads = new WeakMap();
export const retryDeniedFirestoreReads = () => { deniedReads = new WeakMap(); };

export const retryFirestoreRequest = async (fn, maxAttempts = 3) => {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be a positive integer.');
  }
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
    }
  }
};

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

const decodeValue = (value = {}) => {
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) return (value.arrayValue.values || []).map(decodeValue);
  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) return decodeFields(value.mapValue.fields || {});
  if (Object.prototype.hasOwnProperty.call(value, 'referenceValue')) return value.referenceValue;
  return undefined;
};

const decodeFields = (fields = {}) => Object.fromEntries(
  Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
);

const baseUrl = () => {
  if (!projectId || !apiKey) throw new Error('Firebase project configuration is missing.');
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
};

const request = async (path, { pauseOnForbidden = false } = {}) => {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Firebase sign-in required. Please log in again.');
  if (!pauseOnForbidden) return sendRequest(path, user);
  const denied = deniedReads.get(user)?.get(path);
  if (denied) throw denied;
  if (!pendingReads.has(user)) pendingReads.set(user, new Map());
  const pending = pendingReads.get(user);
  if (pending.has(path)) return pending.get(path);
  const deniedForAttempt = deniedReads;
  const operation = sendRequest(path, user).catch((error) => {
    if (error.status === 403) {
      if (!deniedForAttempt.has(user)) deniedForAttempt.set(user, new Map());
      deniedForAttempt.get(user).set(path, error);
    }
    throw error;
  }).finally(() => pending.delete(path));
  pending.set(path, operation);
  return operation;
};

const sendRequest = async (path, user, body) => {
  const token = await user.getIdToken();
  const response = await fetch(`${baseUrl()}${path.startsWith(':') ? '' : '/'}${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`, {
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const error = new Error(details?.error?.message || `Firestore REST request failed (${response.status}).`);
    error.status = response.status;
    error.code = details?.error?.status || 'UNKNOWN';
    throw error;
  }
  return response.json();
};

export const fetchFirestoreCollectionPageRest = async (collectionName, pageSize = 200, options = {}) => {
  if (options.where) {
    await auth.authStateReady();
    if (!auth.currentUser) throw new Error('Firebase sign-in required. Please log in again.');
    const { field, value } = options.where;
    const rows = await sendRequest(':runQuery', auth.currentUser, { structuredQuery: {
      from: [{ collectionId: collectionName }],
      where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
      limit: pageSize,
      ...(options.pageToken ? { startAt: { values: [{ referenceValue: options.pageToken }], before: false } } : {}),
    } });
    const documents = rows.filter((row) => row.document).map(({ document }) => ({
      ...decodeFields(document.fields), id: document.name.split('/').pop(),
    }));
    const last = rows.filter((row) => row.document).at(-1)?.document;
    return { documents, nextPageToken: documents.length === pageSize ? last.name : null };
  }
  const pageToken = options.pageToken ? `&pageToken=${encodeURIComponent(options.pageToken)}` : '';
  const mask = (options.fieldPaths || []).map((path) => `&mask.fieldPaths=${encodeURIComponent(path)}`).join('');
  const order = options.orderBy ? `&orderBy=${encodeURIComponent(options.orderBy)}` : '';
  const data = await request(`${encodeURIComponent(collectionName)}?pageSize=${pageSize}${pageToken}${mask}${order}`, options);
  const documents = (data.documents || []).map((document) => ({
    id: document.name.split('/').pop(),
    ...decodeFields(document.fields),
  }));
  return { documents, nextPageToken: data.nextPageToken || null };
};

export const fetchFirestoreCollectionRest = async (collectionName, pageSize = 200, options = {}) => {
  const { documents } = await fetchFirestoreCollectionPageRest(collectionName, pageSize, options);
  return documents;
};

export const fetchFirestoreDocumentRest = async (collectionName, documentId, options = {}) => {
  if (!documentId) return null;
  const mask = (options.fieldPaths || []).map((path) => `mask.fieldPaths=${encodeURIComponent(path)}`).join('&');
  const data = await request(`${encodeURIComponent(collectionName)}/${encodeURIComponent(documentId)}${mask ? `?${mask}` : ''}`, options);
  return { id: documentId, ...decodeFields(data.fields) };
};
