import { signInWithCustomToken, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  mirrorUserPatchToSubcollections,
  mergeUserDocWithSubcollections,
  readUserSubcollections,
} from "../services/userSubcollections";
import {
  getCurrentDeviceInfo,
  normalizeLoginDevices,
  upsertLoginDevice,
} from "../utils/adminUiHelpers";
import { isUserExpired } from "../utils/packageHelpers";
import { mergeCashMemoLabelSettings } from "../utils/cashmemoHelpers";
import { fetchFirestoreCollectionRest, fetchFirestoreDocumentRest } from "../services/firestoreRest";

export const mapFirestoreUserDoc = (docId, docData, dealerCode) => ({
  id: docId,
  dealerCode: docData.dealerCode || dealerCode,
  dealerName: docData.dealerName || "",
  mobile: docData.mobile || "",
  email: docData.email || "",
  package: docData.package || "",
  packageDays: docData.packageDays || 0,
  validFrom: docData.validFrom || "",
  validTill: docData.validTill || "",
  // PIN intentionally omitted — must never live in runtime state, cache, or session.
  role: docData.role || "operator",
  status: docData.status || "active",
  approvalStatus: docData.approvalStatus || {},
  pendingUpdates: docData.pendingUpdates || {},
  dictionaryPendingCount: Number(docData.dictionaryPendingCount || 0),
  profileData: docData.profileData || null,
  bankDetailsData: docData.bankDetailsData || null,
  ratesData: Array.isArray(docData.ratesData) ? docData.ratesData : [],
  cashMemoLabelSettings: mergeCashMemoLabelSettings(
    docData.cashMemoLabelSettings || {},
  ),
  deliveryAreaUpdates: Array.isArray(docData.deliveryAreaUpdates)
    ? docData.deliveryAreaUpdates
    : [],
  deliveryStaffUpdates: Array.isArray(docData.deliveryStaffUpdates)
    ? docData.deliveryStaffUpdates
    : [],
  loginDevices: normalizeLoginDevices(docData.loginDevices),
});

// ---------------------------------------------------------------------------
// Dealer login — SERVER-VERIFIED.
//
// The PIN is no longer compared in the browser against a plaintext Firestore
// field. `POST /api/login` verifies it against a scrypt hash on the trusted
// layer and returns a Firebase custom token; we exchange that for a real Auth
// session so Firestore Security Rules can be enforced.
// ---------------------------------------------------------------------------
const LOGIN_ENDPOINT = '/api/login';

// Maps the server's error code to the outcome strings the UI already handles.
const NOT_FOUND_OUTCOMES = new Set(['not-found', 'bad-credentials']);

export const lookupDealerByCode = async (dealerCode, pin) => {
  let response;
  try {
    response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealerCode: String(dealerCode ?? '').trim(), pin: String(pin ?? '') }),
    });
  } catch {
    // Network failure — surface as a hard error so the caller shows a retry
    // message instead of a misleading "wrong PIN".
    throw new Error('Cannot reach the login server. Check your connection and that the dev server is running.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const code = payload?.code || 'server-error';

    if (code === 'duplicate') return { outcome: 'duplicate' };
    if (code === 'server-not-configured') {
      // The server's message states the actual fix (missing/expired service
      // account), so surface it rather than a generic failure.
      throw new Error(payload?.error || 'Login service is not configured.');
    }
    if (code === 'pending') return { outcome: 'not-found', dealerLookupStatus: 'pending' };
    if (code === 'disabled') return { outcome: 'not-found', dealerLookupStatus: 'disabled' };
    if (NOT_FOUND_OUTCOMES.has(code)) {
      // A wrong PIN on an existing code must not reveal whether the account
      // exists, so mirror the previous generic lookup status.
      return { outcome: 'not-found', dealerLookupStatus: code === 'not-found' ? 'not-found' : 'dealer-found' };
    }
    if (code === 'rate-limited') throw new Error('login-rate-limited');
    throw new Error(`Login server returned HTTP ${response.status}. Check the server terminal for the login error.`);
  }

  const payload = await response.json().catch(() => null);
  const token = payload?.token;
  if (typeof token !== 'string' || !token) {
    throw new Error('Login server returned an invalid response (missing sign-in token). Check that this page is connected to the correct API server.');
  }

  // Exchange the custom token for a real Firebase Auth session.
  const credential = await signInWithCustomToken(auth, token);

  const firestoreUser = await fetchOwnUserProfile(credential.user.uid);
  if (!firestoreUser) return { outcome: 'not-found', dealerLookupStatus: 'not-found' };

  return { outcome: 'ok', firestoreUser, dealerLookupStatus: 'dealer-found' };
};

// ---------------------------------------------------------------------------
// PIN writes — server-hashed.
//
// Hashing in the browser would be pointless: the client could skip it and write
// anything. So the plaintext PIN is sent once to the login service, which
// returns the `pinHash`/`pin: null` patch to persist. When the service is
// unavailable the PIN is dropped rather than stored in the clear.
// ---------------------------------------------------------------------------
const PIN_HASH_ENDPOINT = '/api/pin-hash';

export const buildPinWritePatch = async (pin) => {
  const plaintext = String(pin ?? '').trim();
  if (!plaintext) return {};

  try {
    const response = await fetch(PIN_HASH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: plaintext }),
    });
    if (!response.ok) throw new Error('pin-hash-failed');

    const patch = await response.json();
    return {
      pinHash: patch.pinHash,
      pin: null,
      pinUpdatedAt: patch.pinUpdatedAt,
    };
  } catch {
    // Never fall back to writing plaintext. The account keeps its previous PIN
    // (or none) and an admin can re-set it once the service is reachable.
    return {};
  }
};

/** Reads the signed-in user's own document (allowed by Security Rules). */
const fetchOwnUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;

  const docData = snap.data();
  const status = String(docData?.status || "active").toLowerCase();
  const firestoreUser = mapFirestoreUserDoc(snap.id, docData, docData?.dealerCode || '');

  // Heavy structures (rates, label settings, ...) live in subcollections.
  try {
    const sub = await readUserSubcollections(snap.id);
    mergeUserDocWithSubcollections(firestoreUser, sub);
  } catch {
    // Subcollection read failure: the top-level document is still sufficient.
  }

  if (status !== "active") firestoreUser.status = status;
  return firestoreUser;
};

export const registerLoginDevice = async (firestoreUser) => {
  // NOTE: ye client-side convenience check hai, security boundary nahi.
  // blocked flag client ke apne fetch kiye loginDevices par decide hota hai,
  // aur naye deviceId se (localStorage clear) block bypass ho sakta hai.
  // Strong enforcement ke liye security rules / Cloud Function / App Check
  // chahiye. Yahan iska role sirf "abuse management convenience" hai.
  const currentDeviceInfo = await getCurrentDeviceInfo();
  const currentDevice = normalizeLoginDevices(firestoreUser.loginDevices).find(
    (device) => device.deviceId === currentDeviceInfo.deviceId,
  );
  if (currentDevice?.blocked) return { outcome: "blocked" };

  const loginDevices = upsertLoginDevice(
    firestoreUser.loginDevices,
    currentDeviceInfo,
  );
  firestoreUser.loginDevices = loginDevices;
  try {
    await updateDoc(doc(db, "users", firestoreUser.id), {
      loginDevices,
      lastLoginAt: loginDevices[0]?.lastLoginAt || new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
    mirrorUserPatchToSubcollections(firestoreUser.id, { loginDevices }).forEach(
      (p) => { void p.catch(() => {}); },
    );
  } catch (e) {
    void e;
  }
  return { outcome: "ok", loginDevices };
};

export const markUserExpiredIfDue = async (firestoreUser) => {
  if (!isUserExpired(firestoreUser)) return false;
  try {
    await updateDoc(doc(db, "users", firestoreUser.id), {
      status: "expired",
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    void e;
  }
  firestoreUser.status = "expired";
  return true;
};

export const adminSignIn = (loginId, password) =>
  signInWithEmailAndPassword(auth, loginId, password);

export const adminSignOut = () => signOut(auth);

// ---------------------------------------------------------------------------
// Admin users fetch — scalable replacement for getDocs(collection(db,'users'))
//
// Old approach downloaded every user doc (including heavy nested payloads:
// ratesData, loginDevices, profileData, ...) in a single
// snapshot. That works for dozens of users but breaks down at thousands.
//
// New approach:
//   1. Field projection — list pages only carry the columns the admin table
//      renders (dealerCode, dealerName, package, status, role, validity,
//      flags). Heavy payloads (ratesData, loginDevices,
//      profileData, bankDetailsData, pendingUpdates...) are fetched lazily,
//      per user, only when the admin opens the detail view or edits.
//   2. Cursor pagination — each page is a bounded query (orderBy + limit +
//      startAfter), so memory/network cost per page stays constant no matter
//      how large the collection grows.
// ---------------------------------------------------------------------------

// Columns needed by the admin users table, search box, dashboard counters and
// package-breakdown chips. Heavy nested payloads are intentionally excluded.
const ADMIN_USER_LIST_FIELDS = [
  "dealerCode",
  "dealerName",
  "mobile",
  "email",
  "package",
  "packageDays",
  "validFrom",
  "validTill",
  "role",
  "status",
  "createdAt",
  "approvedAt",
  "updatedAt",
  "lastLoginAt",
  "dictionaryPendingCount",
  "cashMemoLabelSettings",
];

// Full payloads — only fetched when a single user's detail view is opened.
const ADMIN_USER_DETAIL_FIELDS = [
  ...ADMIN_USER_LIST_FIELDS,
  "profileData",
  "bankDetailsData",
  "ratesData",
  "hindiHeaderData",
  "approvalStatus",
  "pendingUpdates",
  "deliveryAreaUpdates",
  "deliveryStaffUpdates",
  "loginDevices",
];

const pickFields = (docData, fields) => {
  const out = {};
  fields.forEach((f) => {
    if (docData && Object.prototype.hasOwnProperty.call(docData, f)) {
      out[f] = docData[f];
    }
  });
  return out;
};

const mapAdminUserDoc = (docSnap, fields) => ({
  id: docSnap.id,
  ...pickFields(docSnap.data(), fields),
});

export const ADMIN_USERS_PAGE_SIZE = 200;

/**
 * Fetch one page of users for the admin table, ordered by dealerCode.
 * Pass `cursor` (a doc snapshot value from the previous page) for the next page.
 * Returns { users, cursor, hasMore }.
 */
export const fetchAdminUsersPage = async ({ pageSize = ADMIN_USERS_PAGE_SIZE, cursor = null } = {}) => {
  const usersRef = collection(db, "users");
  const constraints = [orderBy("dealerCode"), limit(pageSize + 1)];
  if (cursor) constraints.push(startAfter(cursor));
  let snap;
  let usedFallback = false;
  try {
    snap = await getDocs(query(usersRef, ...constraints));
  } catch (queryError) {
    // Older Firestore rule sets can allow a collection read while rejecting
    // an ordered query.  Keep the admin usable in that case instead of
    // silently rendering every count as zero.
    if (cursor) throw queryError;
    try {
      snap = await getDocs(usersRef);
      usedFallback = true;
    } catch (collectionError) {
      try {
        const users = await fetchFirestoreCollectionRest('users', pageSize);
        return { users, cursor: null, hasMore: false, usedFallback: true };
      } catch {
        const message = collectionError?.message || queryError?.message || "Unable to read users from Firestore.";
        throw new Error(message);
      }
    }
  }

  const docs = usedFallback
    ? [...snap.docs].sort((a, b) => String(a.data()?.dealerCode || "").localeCompare(String(b.data()?.dealerCode || "")))
    : snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const users = pageDocs.map((docSnap) => mapAdminUserDoc(docSnap, ADMIN_USER_LIST_FIELDS));
  const nextCursor = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
  return { users, cursor: nextCursor, hasMore, usedFallback };
};

/**
 * Fetch the FULL document of a single user (all admin-relevant fields,
 * including heavy payloads). Used when opening the detail view or editing.
 */
export const fetchAdminUserDetail = async (userId) => {
  if (!userId) return null;
  let detail;
  try {
    const fallback = await fetchFirestoreDocumentRest('users', userId);
    if (!fallback) return null;
    detail = mapFirestoreUserDoc(fallback.id, fallback, fallback.dealerCode || '');
  } catch {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) return null;
    detail = mapAdminUserDoc(snap, ADMIN_USER_DETAIL_FIELDS);
  }
  return detail;
};
