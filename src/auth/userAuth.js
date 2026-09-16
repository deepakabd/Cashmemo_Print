import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
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
import { getUserAccountStatus } from '../utils/userAccountStatus';
import { mergeCashMemoLabelSettings } from "../utils/cashmemoHelpers";
import { fetchFirestoreDocumentRest } from "../services/firestoreRest";

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
  status: getUserAccountStatus(docData),
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
    const status = getUserAccountStatus(docData);
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

// Legacy PIN writes accompany the browser-based login flow.
export const buildPinWritePatch = async (pin) => {
  const value = String(pin ?? '').trim();
  return value ? { pin: value, pinHash: null, pinUpdatedAt: new Date().toISOString() } : {};
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
  if (getUserAccountStatus(firestoreUser) !== 'expired') return false;
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

// Admin collection loading and statistics live in adminUserRepository.
// These field lists apply to the SDK fallback for a single user detail read.
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
  status: getUserAccountStatus(docSnap.data()),
});

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
