import { signInWithCustomToken, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
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
  const response = await fetch('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealerCode: String(dealerCode || '').trim().toUpperCase(), pin }),
  });
  let result;
  try { result = await response.json(); } catch {
    throw new Error('Login API is unavailable. Check the server deployment.');
  }
  if (!response.ok) {
    if (result.code === 'duplicate') return { outcome: 'duplicate' };
    if (['pending', 'disabled'].includes(result.code)) return { outcome: 'not-found', dealerLookupStatus: result.code };
    if (['not-found', 'bad-credentials'].includes(result.code)) return { outcome: 'not-found', dealerLookupStatus: 'not-found' };
    const error = new Error(result.error || 'Firebase login check failed. Please try again.');
    error.code = result.code;
    throw error;
  }
  if (!result.token || !result.dealerCode) throw new Error('Login API returned an invalid sign-in response.');
  const credential = await signInWithCustomToken(auth, result.token);
  await credential.user.getIdToken();
  let documents;
  if (result.userId) {
    const snapshot = await getDoc(doc(db, 'users', result.userId));
    if (snapshot.metadata?.fromCache) throw new Error('User account could not be confirmed from Firestore.');
    documents = snapshot.exists() ? [snapshot] : [];
  } else {
    // Compatibility with an API deployment that predates userId. This query
    // runs only after authentication and is restricted to the claimed code.
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('dealerCode', '==', result.dealerCode));
    const snap = await getDocs(q);
    if (snap.metadata?.fromCache) throw new Error('User account could not be confirmed from Firestore.');
    documents = snap.docs;
  }
  if (documents.length > 1) return { outcome: 'duplicate' };
  if (documents.length === 1) {
    const snapshot = documents[0];
    const docData = snapshot.data();
    if (docData.dealerCode !== result.dealerCode) throw new Error('Signed-in account does not match the dealer code.');
    const status = getUserAccountStatus(docData);
    const dealerLookupStatus =
      status === "pending"
        ? "pending"
        : status === "disabled"
          ? "disabled"
          : "dealer-found";
    const firestoreUser = mergeUserDocWithSubcollections(
      mapFirestoreUserDoc(snapshot.id, docData, result.dealerCode),
      await readUserSubcollections(snapshot.id),
    );
    return { outcome: 'ok', firestoreUser, dealerLookupStatus };
  }
  throw new Error('Signed-in user record no longer exists. Please contact admin.');
};

// Legacy writes remain compatible with the server's plaintext-to-hash upgrade.
export const buildPinWritePatch = async (pin) => {
  const value = String(pin ?? '').trim();
  return value ? { pin: value, pinHash: null, pinUpdatedAt: new Date().toISOString() } : {};
};

export const registerLoginDevice = async (firestoreUser, { deferSave = false } = {}) => {
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

  const save = async () => {
    const loginDevices = upsertLoginDevice(
      firestoreUser.loginDevices,
      currentDeviceInfo,
    );
    try {
      await updateDoc(doc(db, "users", firestoreUser.id), {
        loginDevices,
        lastLoginAt: loginDevices[0]?.lastLoginAt || new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      return { outcome: 'save-failed', error };
    }
    firestoreUser.loginDevices = loginDevices;
    return { outcome: "ok", loginDevices };
  };
  return deferSave ? { outcome: 'ready', save } : save();
};

export const markUserExpiredIfDue = async (firestoreUser) => {
  if (getUserAccountStatus(firestoreUser) !== 'expired') {
    return { ok: true, changed: false, reason: 'not-expired' };
  }
  try {
    await updateDoc(doc(db, "users", firestoreUser.id), {
      status: "expired",
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    return { ok: false, changed: false, reason: error?.code || error?.message || 'expiry-update-failed' };
  }
  firestoreUser.status = "expired";
  return { ok: true, changed: true };
};

export const adminSignIn = (loginId, password) =>
  signInWithEmailAndPassword(auth, loginId, password);

export const adminSignOut = () => signOut(auth);
