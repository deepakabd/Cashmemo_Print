import { signInWithEmailAndPassword, signOut } from "firebase/auth";
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
  where,
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

export const lookupDealerByCode = async (dealerCode, pin) => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("dealerCode", "==", dealerCode));
  const snap = await getDocs(q);

  if (snap.size > 1) return { outcome: "duplicate" };

  if (!snap.empty) {
    const docData = snap.docs[0].data();
    const status = String(docData?.status || "active").toLowerCase();
    const dealerLookupStatus =
      status === "pending"
        ? "pending"
        : status === "disabled"
          ? "disabled"
          : "dealer-found";
    if (String(docData?.pin || "") === pin) {
      const firestoreUser = mapFirestoreUserDoc(
        snap.docs[0].id,
        docData,
        dealerCode,
      );
      // Login par bhi poora user object chahiye — heavy structures
      // subcollections se merge karo (top-level fallback ke saath).
      try {
        const sub = await readUserSubcollections(snap.docs[0].id);
        mergeUserDocWithSubcollections(firestoreUser, sub);
      } catch {
        // subcollection read fail ho toh top-level data hi kaafi hai
      }
      if (status !== "active") firestoreUser.status = status;
      return { outcome: "ok", firestoreUser, dealerLookupStatus };
    }
    return { outcome: "not-found", dealerLookupStatus };
  }

  return { outcome: "not-found", dealerLookupStatus: "not-found" };
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
