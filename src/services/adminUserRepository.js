import { fetchFirestoreCollectionPageRest, retryFirestoreRequest } from './firestoreRest';
import { getUserAccountStatus } from '../utils/userAccountStatus';

// Publish only a complete read. A failed later page must never turn into
// successful, truncated counters, search results, or duplicate checks.
export const fetchAllAdminUsers = async () => {
  const users = new Map();
  const seenTokens = new Set();
  let pageToken = null;
  do {
    const page = await retryFirestoreRequest(() =>
      fetchFirestoreCollectionPageRest('users', 200, { pageToken }), 3);
    for (const user of page.documents) {
      const safeUser = { ...user };
      delete safeUser.pin;
      users.set(user.id, safeUser);
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
