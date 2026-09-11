import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  getCurrentDeviceInfo,
  normalizeLoginDevices,
  upsertLoginDevice,
} from "../utils/adminUiHelpers";
import { isUserExpired } from "../utils/packageHelpers";
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
      if (status !== "active") firestoreUser.status = status;
      return { outcome: "ok", firestoreUser, dealerLookupStatus };
    }
    return { outcome: "not-found", dealerLookupStatus };
  }

  return { outcome: "not-found", dealerLookupStatus: "not-found" };
};

export const registerLoginDevice = async (firestoreUser) => {
  const currentDeviceInfo = getCurrentDeviceInfo();
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
