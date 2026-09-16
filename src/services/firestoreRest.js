import { auth } from '../firebase';

let deniedReads = new WeakMap();
const pendingReads = new WeakMap();
export const retryDeniedFirestoreReads = () => { deniedReads = new WeakMap(); };

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

const sendRequest = async (path, user) => {
  const token = await user.getIdToken();
  const response = await fetch(`${baseUrl()}/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
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

export const fetchFirestoreCollectionRest = async (collectionName, pageSize = 200, options = {}) => {
  const data = await request(`${encodeURIComponent(collectionName)}?pageSize=${pageSize}`, options);
  return (data.documents || []).map((document) => ({
    id: document.name.split('/').pop(),
    ...decodeFields(document.fields),
  }));
};

export const fetchFirestoreDocumentRest = async (collectionName, documentId) => {
  if (!documentId) return null;
  const data = await request(`${encodeURIComponent(collectionName)}/${encodeURIComponent(documentId)}`);
  return { id: documentId, ...decodeFields(data.fields) };
};
