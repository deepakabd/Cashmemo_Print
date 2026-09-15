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

const request = async (path) => {
  const response = await fetch(`${baseUrl()}/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) throw new Error(`Firestore REST request failed (${response.status}).`);
  return response.json();
};

export const fetchFirestoreCollectionRest = async (collectionName, pageSize = 200) => {
  const data = await request(`${encodeURIComponent(collectionName)}?pageSize=${pageSize}`);
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
