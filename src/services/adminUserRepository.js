import { fetchFirestoreCollectionPageRest, fetchFirestoreDocumentRest, retryFirestoreRequest } from './firestoreRest';
import { getUserAccountStatus } from '../utils/userAccountStatus';
import { buildAdminUserRestoreData } from '../utils/adminUserRestore';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { readUserSubcollections, mergeUserDocWithSubcollections } from './userSubcollections';

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
  let user;
  try {
    user = await retryFirestoreRequest(() => fetchFirestoreDocumentRest('users', userId));
  } catch (error) {
    const snapshot = await getDoc(doc(db, 'users', userId));
    if (snapshot.metadata?.fromCache) throw error;
    if (!snapshot.exists()) return null;
    user = { ...snapshot.data(), id: snapshot.id };
  }
  return mapAdminUserDetail(mergeUserDocWithSubcollections(user, await readUserSubcollections(userId)));
};

const mutateAdminUser = async (body) => {
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('Admin sign-in required.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/admin-users', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'User write failed.');
    error.code = result.code;
    throw error;
  }
  return result;
};

export const saveAdminUser = (data, { mode = 'create', userId, requestId } = {}) => {
  const payload = mode === 'restore' ? buildAdminUserRestoreData(data) : { ...data };
  for (const key of ['createdAt', 'updatedAt', 'approvedAt', 'restoredAt']) delete payload[key];
  return mutateAdminUser({ mode, userId, requestId, data: payload });
};

export const patchAdminUser = (userId, patch) => saveAdminUser(patch, { mode: 'update', userId });
export const deleteAdminUser = (userId) => mutateAdminUser({ mode: 'delete', userId });
export const rejectAdminRegistrationRequest = (requestId) => mutateAdminUser({ mode: 'rejectRegistration', requestId });

export const saveAdminApprovalReply = (options) => mutateAdminUser({ ...options, mode: 'reply' });

export const completeAdminDictionaryRequest = (userId, approvalDocId, approval, status, pendingType) => (
  mutateAdminUser({ mode: 'completeDictionary', userId, approvalDocId, approval, status, pendingType })
);

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
