import { fetchFirestoreCollectionPageRest, fetchFirestoreDocumentRest, retryFirestoreRequest } from './firestoreRest';
import { getUserAccountStatus } from '../utils/userAccountStatus';
import { auth, db } from '../firebase';
import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { mirrorUserPatchToSubcollections } from './userSubcollections';

const APPROVAL_TYPES = ['profile', 'profileData', 'bank', 'bankDetailsData', 'rates', 'rate', 'ratesData',
  'header', 'hindiHeaderData', 'deliveryArea', 'deliveryStaff', 'planUpgrade', 'dictionary'];
export const ADMIN_USER_LIST_FIELDS = [
  'dealerCode', 'dealerName', 'name', 'mobile', 'email', 'package', 'packageDays', 'validFrom', 'validTill',
  'role', 'status', 'createdAt', 'approvedAt', 'updatedAt', 'lastLoginAt', 'dictionaryPendingCount',
  'approvalStatus', 'cashMemoLabelSettings', 'ratesDataCount',
  'profileData.distributorCode', 'profileData.distributorName', 'bankDetailsData.bankName', 'hindiHeaderData.distributorName',
  ...APPROVAL_TYPES.flatMap((type) => ['status', 'requestedAt', 'approvedAt', 'rejectedAt', 'adminReply', 'adminReplyAt']
    .map((field) => `pendingUpdates.${type}.${field}`)),
];
const DETAIL_FIELDS = ['profileData', 'bankDetailsData', 'ratesData', 'hindiHeaderData', 'pendingUpdates',
  'loginDevices', 'pendingDictionaryRequests', 'deliveryAreaUpdates', 'deliveryStaffUpdates', 'authUid', 'uid'];

const projectFields = (data, paths) => {
  const result = {};
  for (const path of paths) {
    const keys = path.split('.');
    const value = keys.reduce((current, key) => current?.[key], data);
    if (value === undefined) continue;
    let target = result;
    for (const key of keys.slice(0, -1)) target = target[key] ??= {};
    target[keys[keys.length - 1]] = value;
  }
  return result;
};
const mapUser = (user, fields) => ({
  ...projectFields(user, fields), id: user.id,
  dealerCode: user.dealerCode || '', dealerName: user.dealerName || '',
  mobile: user.mobile || '', email: user.email || '', package: user.package || '',
  role: user.role || 'operator', status: getUserAccountStatus(user),
});
export const mapAdminUserList = (user) => mapUser(user, ADMIN_USER_LIST_FIELDS);
export const mapAdminUserDetail = (user) => mapUser(user, [...ADMIN_USER_LIST_FIELDS, ...DETAIL_FIELDS]);

// Publish only a complete read. A failed later page must never turn into
// successful, truncated counters, search results, or duplicate checks.
export const fetchAllAdminUsers = async () => {
  const users = new Map();
  const seenTokens = new Set();
  let pageToken = null;
  do {
    const page = await retryFirestoreRequest(() =>
      fetchFirestoreCollectionPageRest('users', 200, { pageToken, fieldPaths: ADMIN_USER_LIST_FIELDS }), 3);
    for (const user of page.documents) {
      users.set(user.id, mapAdminUserList(user));
    }
    pageToken = page.nextPageToken;
    if (pageToken && seenTokens.has(pageToken)) {
      throw new Error('Firestore returned a repeated users page token.');
    }
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken);
  return [...users.values()].sort((a, b) =>
    String(a.dealerCode || '').localeCompare(String(b.dealerCode || ''))
    || String(a.id).localeCompare(String(b.id)));
};

export const fetchAdminUserDetail = async (userId) => {
  if (!userId) return null;
  try {
    return mapAdminUserDetail(await retryFirestoreRequest(() => fetchFirestoreDocumentRest('users', userId)));
  } catch (error) {
    const snapshot = await getDoc(doc(db, 'users', userId));
    if (snapshot.metadata?.fromCache) throw error;
    return snapshot.exists() ? mapAdminUserDetail({ ...snapshot.data(), id: snapshot.id }) : null;
  }
};

export const fetchAdminPendingUserApprovals = async (users) => {
  const pendingUsers = users.filter((user) => Number(user.dictionaryPendingCount || 0) > 0
    || Object.values(user.pendingUpdates || {}).some((update) => String(update.status || 'pending').toLowerCase() === 'pending'));
  const approvals = await Promise.all(pendingUsers.map(async (user) => {
    const data = await retryFirestoreRequest(() => fetchFirestoreDocumentRest('users', user.id, {
      fieldPaths: ['pendingUpdates', 'pendingDictionaryRequests'],
    }));
    return [
      ...Object.entries(data.pendingUpdates || {}).filter(([, update]) => String(update.status || 'pending').toLowerCase() === 'pending').map(([type, update]) => ({
        ...update, status: 'pending', id: `userdoc-${user.id}-${type}`, source: 'userDoc', userId: user.id,
        dealerCode: user.dealerCode, dealerName: user.dealerName, type,
      })),
      ...(Array.isArray(data.pendingDictionaryRequests) ? data.pendingDictionaryRequests : [])
        .filter((request) => String(request.status || 'pending').toLowerCase() === 'pending').map((request, index) => ({
        ...request, status: 'pending', id: `userdict-${user.id}-${request.id || request.approvalId || index}`, source: 'userDoc',
        userId: user.id, dealerCode: user.dealerCode, dealerName: user.dealerName, type: 'dictionary',
        payload: request.payload || request, clientRequestId: request.id || request.payload?.clientRequestId || '',
      })),
    ];
  }));
  return approvals.flat();
};

export const saveAdminUser = async (data, { mode = 'create', userId } = {}) => {
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('Admin sign-in required.');
  const token = await auth.currentUser.getIdToken();
  const payload = { ...data };
  for (const key of ['createdAt', 'updatedAt', 'approvedAt', 'restoredAt']) delete payload[key];
  const response = await fetch('/api/admin-users', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode, userId, data: payload }),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'User write failed.');
    error.code = result.code;
    throw error;
  }
  return result;
};

export const patchAdminUser = async (userId, patch) => {
  if (Object.hasOwn(patch, 'dealerCode')) return saveAdminUser(patch, { mode: 'update', userId });
  const fields = { ...patch, updatedAt: serverTimestamp(),
    ...(Array.isArray(patch.ratesData) ? { ratesDataCount: patch.ratesData.length } : {}),
  };
  await updateDoc(doc(db, 'users', userId), fields);
  // Preserve the existing migration mirrors without turning an optional
  // subcollection write failure into failure of the authoritative write.
  mirrorUserPatchToSubcollections(userId, fields).forEach((operation) => { void operation.catch(() => {}); });
};
export const deleteAdminUser = (userId) => deleteDoc(doc(db, 'users', userId));

export const completeAdminDictionaryRequest = async (userId, approvalDocId, matches, status, pendingType) => {
  return runTransaction(db, async (transaction) => {
    const userRef = userId ? doc(db, 'users', userId) : null;
    const snapshot = userRef ? await transaction.get(userRef) : null;
    if (snapshot?.exists()) {
      const pending = Array.isArray(snapshot.data().pendingDictionaryRequests) ? snapshot.data().pendingDictionaryRequests : [];
      const remaining = pending.filter((request) => !matches(request));
      transaction.update(userRef, {
        pendingDictionaryRequests: remaining, dictionaryPendingCount: remaining.length,
        ...(pendingType ? { [`pendingUpdates.${pendingType}.status`]: status } : {}), updatedAt: serverTimestamp(),
      });
    }
    if (approvalDocId) transaction.update(doc(db, 'updateApprovals', approvalDocId), { status, updatedAt: serverTimestamp() });
  });
};

// Input is the complete repository dataset, never a table page.
export const getAdminUserStatistics = (users) => {
  const stats = { total: users.length, byStatus: {}, byPackage: {} };
  for (const user of users) {
    const status = getUserAccountStatus(user);
    const packageName = String(user.package || '');
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    stats.byPackage[packageName] = (stats.byPackage[packageName] || 0) + 1;
  }
  return stats;
};
