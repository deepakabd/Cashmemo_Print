import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { USER_SINGLETON_PATHS } from '../utils/userDataSchema';

// Singleton subdocuments own account configuration. Parent copies are updated
// in the same commit. Devices and dictionary workflows remain parent-owned.
export const updateUserData = async (uid, patch = {}) => {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { ...patch, updatedAt: serverTimestamp(),
    ...(Array.isArray(patch.ratesData) ? { ratesDataCount: patch.ratesData.length } : {}),
  });
  for (const [key, path] of Object.entries(USER_SINGLETON_PATHS)) {
    if (!Object.hasOwn(patch, key)) continue;
    const value = patch[key];
    if (value === undefined || (value && typeof value.isEqual === 'function')) {
      throw new Error(`Write a complete ${key} value instead of a field transform.`);
    }
    batch.set(doc(db, 'users', uid, ...path.split('/')), { value, updatedAt: serverTimestamp() });
  }
  return batch.commit();
};

export const readUserSubcollections = async (uid) => {
  if (!uid) return {};
  const entries = await Promise.all(Object.entries(USER_SINGLETON_PATHS).map(async ([key, path]) => {
    let snapshot;
    try {
      snapshot = await getDoc(doc(db, 'users', uid, ...path.split('/')));
    } catch (cause) {
      const denied = ['permission-denied', 'firestore/permission-denied'].includes(cause?.code);
      const error = new Error(denied
        ? `Firestore denied users/${uid}/${path}. Publish rules that allow the signed-in dealer to read user configuration subcollections.`
        : `Could not read users/${uid}/${path}: ${cause?.message || 'Firestore read failed.'}`);
      error.code = cause?.code;
      error.cause = cause;
      throw error;
    }
    if (snapshot.metadata?.fromCache) throw new Error('User data could not be confirmed from Firestore.');
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return [key, Object.hasOwn(data, 'value') ? data.value : data];
  }));
  return Object.fromEntries(entries.filter(Boolean));
};

// Only a missing subdocument uses the legacy parent fallback. Null/empty values
// intentionally clear configuration and override old copies.
export const mergeUserDocWithSubcollections = (user, sub) => user ? { ...user, ...sub } : user;
