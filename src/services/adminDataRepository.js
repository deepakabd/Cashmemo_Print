import { fetchAllAdminUsers, mapAdminUserList } from './adminUserRepository';
import { fetchFirestoreCollectionPageRest, retryFirestoreRequest } from './firestoreRest';
import { sanitizeUsersForCache } from '../utils/adminUiHelpers';
import { sanitizeRegistrationRequests } from '../utils/registrationStorage';

const SNAPSHOT_KEY = 'adminDataSnapshot';
const collections = ['requests', 'users', 'approvals', 'audit'];
const validSnapshot = (value) => value?.version === 1
  && collections.every((key) => Array.isArray(value[key]));
const sanitizeSnapshot = (snapshot) => ({
  ...snapshot,
  users: sanitizeUsersForCache(snapshot.users).map(mapAdminUserList),
  requests: sanitizeRegistrationRequests(snapshot.requests),
});

export const readAdminSnapshotCache = () => {
  try {
    const snapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null');
    if (validSnapshot(snapshot)) return sanitizeSnapshot(snapshot);
    // Legacy caches have no trustworthy successful-sync timestamp.
    const readList = (key) => {
      try {
        const list = JSON.parse(localStorage.getItem(key) || 'null');
        return Array.isArray(list) ? list : null;
      } catch { return null; }
    };
    const users = readList('usersData');
    const requests = readList('registrationRequests');
    const audit = readList('adminAuditTrail');
    if (users || requests || audit) return sanitizeSnapshot({
      version: 1, lastSyncAt: '', users: users || [], requests: requests || [], approvals: [], audit: audit || [],
    });
  } catch { /* Browser cache unavailable. */ }
  return null;
};

const readAll = async (name, { limit = Infinity, orderBy, where } = {}) => {
  const documents = [];
  const seenTokens = new Set();
  let pageToken = null;
  do {
    const page = await retryFirestoreRequest(() => fetchFirestoreCollectionPageRest(name, Math.min(200, limit - documents.length), {
      pageToken, orderBy, where, pauseOnForbidden: name === 'adminAuditTrail',
    }));
    documents.push(...page.documents);
    if (documents.length >= limit) break;
    pageToken = page.nextPageToken;
    if (pageToken && seenTokens.has(pageToken)) throw new Error('Repeated Firestore page token.');
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken);
  return documents.slice(0, limit);
};

export const loadAdminSnapshot = async (previousSnapshot = null) => {
  // The dashboard retains only the latest 150 audit events.
  const readAudit = () => readAll('adminAuditTrail', { limit: 150, orderBy: 'createdAt desc' });
  // Pending work comes exclusively from the queue, without user detail reads.
  // Retain a bounded rejected history for the existing rejected-requests tab.
  const readApprovals = async () => {
    const [pending, rejected] = await Promise.all([
      readAll('updateApprovals', { where: { field: 'status', value: 'pending' } }),
      readAll('updateApprovals', { limit: 150, where: { field: 'status', value: 'rejected' } }),
    ]);
    return [...pending, ...rejected];
  };
  const results = await Promise.allSettled([
    readAll('registrationRequests'), fetchAllAdminUsers(), readApprovals(), readAudit(),
  ]);
  const errors = results.flatMap((result, index) => result.status === 'rejected'
    ? [`${collections[index]}: ${result.reason?.message || 'Firestore read failed.'}`] : []);
  if (errors.length > 0) {
    // Preserve the in-memory snapshot first, so refresh failures never roll
    // the screen back to an older browser cache. Publish no partial live read.
    const snapshot = previousSnapshot || readAdminSnapshotCache();
    return {
      snapshot,
      health: { source: snapshot ? 'offline' : 'unavailable', lastSyncAt: snapshot?.lastSyncAt || '',
        firebaseReachable: false, error: errors.join(' ') },
    };
  }
  const snapshot = {
    version: 1, lastSyncAt: new Date().toISOString(),
    ...Object.fromEntries(results.map((result, index) => [collections[index], result.value])),
  };
  snapshot.requests = sanitizeRegistrationRequests(snapshot.requests);
  snapshot.audit = snapshot.audit.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 150);
  // Cache failure cannot turn a successful Firebase read into an offline read.
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(sanitizeSnapshot(snapshot))); } catch { /* Optional cache. */ }
  return { snapshot, health: { source: 'live', lastSyncAt: snapshot.lastSyncAt, firebaseReachable: true, error: '' } };
};
