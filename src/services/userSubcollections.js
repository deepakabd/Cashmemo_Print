import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// ---------------------------------------------------------------------------
// users/{uid} doc slimming — heavy structures live in subcollections.
//
// Singleton docs (read with getDoc, merge-friendly):
//   users/{uid}/profile/main          -> profileData
//   users/{uid}/bank/details          -> bankDetailsData
//   users/{uid}/settings/cashmemo     -> cashMemoLabelSettings
//   users/{uid}/rates/current         -> ratesData
//   users/{uid}/header/current        -> hindiHeaderData
//   users/{uid}/deliveryArea/updates  -> deliveryAreaUpdates
//   users/{uid}/deliveryStaff/updates -> deliveryStaffUpdates
//
// Collection docs (one doc per item):
//   users/{uid}/devices/{deviceId}          -> loginDevices
//   users/{uid}/dictionaryRequests/{requestId} -> pendingDictionaryRequests
//
// Migration strategy (non-breaking):
//   WRITE = dual-write. Top-level doc keeps receiving the legacy fields so
//           every existing reader keeps working; mirrors land in
//           subcollections for the new structure.
//   READ  = subcollection-first with top-level fallback. A missing/absent
//           top-level field falls back to its subcollection, and vice versa
//           for fields not yet mirrored.
//   Truth = during migration the TOP-LEVEL field wins on conflict; once all
//           writers are migrated, flip READ_SOURCE to 'sub'.
// ---------------------------------------------------------------------------

const READ_SOURCE = "top"; // flip to 'sub' after full migration + backfill

const SINGLETONS = {
  profileData: "profile/main",
  bankDetailsData: "bank/details",
  cashMemoLabelSettings: "settings/cashmemo",
  ratesData: "rates/current",
  hindiHeaderData: "header/current",
  deliveryAreaUpdates: "deliveryArea/updates",
  deliveryStaffUpdates: "deliveryStaff/updates",
};

const COLLECTIONS = {
  loginDevices: "devices",
  pendingDictionaryRequests: "dictionaryRequests",
};

// Keys that must be mirrored into subcollections when patched onto users/{uid}.
const HEAVY_KEYS = new Set([
  ...Object.keys(SINGLETONS),
  ...Object.keys(COLLECTIONS),
]);

const isFieldValueSentinel = (value) =>
  Boolean(
    value &&
    typeof value === "object" &&
    typeof value.isEqual === "function" &&
    !Array.isArray(value),
  );

const stableItemId = (item, index) =>
  String(
    item?.deviceId ||
      item?.requestId ||
      item?.approvalId ||
      item?.id ||
      "",
  ).replace(/[/#?[\]*]/g, "_") || `item-${index}`;

const singletonDocRef = (uid, key) =>
  doc(db, "users", uid, ...SINGLETONS[key].split("/"));

/**
 * Mirror heavy patch keys from a users/{uid} write into subcollections.
 * FieldValue sentinels (arrayUnion etc.) can't be mirrored item-wise and are
 * skipped — the top-level field remains authoritative for those.
 * Fire-and-forget safe: returns promises you may await or ignore.
 */
export const mirrorUserPatchToSubcollections = (uid, patch = {}) => {
  try {
    if (!uid) return [];
    const ops = [];
    Object.entries(patch).forEach(([key, value]) => {
      if (
        !HEAVY_KEYS.has(key) ||
        value === undefined ||
        value === null ||
        isFieldValueSentinel(value)
      )
        return;

      if (SINGLETONS[key]) {
        ops.push(
          Promise.resolve(
            setDoc(
              singletonDocRef(uid, key),
              { value, updatedAt: new Date().toISOString() },
              { merge: true },
            ),
          ).catch(() => {}),
        );
        return;
      }

      if (!Array.isArray(value)) return;
      const collectionName = COLLECTIONS[key];
      value.forEach((item, index) => {
        const id = stableItemId(item, index);
        ops.push(
          Promise.resolve(
            setDoc(
              doc(db, "users", uid, collectionName, id),
              { ...item, __itemId: id },
              { merge: true },
            ),
          ).catch(() => {}),
        );
      });
    });
    return ops;
  } catch {
    // Mirroring is best-effort — never break the parent write flow.
    return [];
  }
};

const readSingleton = async (uid, key) => {
  try {
    const snap = await getDoc(singletonDocRef(uid, key));
    if (!snap.exists()) return undefined;
    const data = snap.data();
    return data?.value !== undefined ? data.value : data;
  } catch {
    return undefined;
  }
};

const readItemCollection = async (uid, key) => {
  try {
    const snap = await getDocs(collection(db, "users", uid, COLLECTIONS[key]));
    return snap.docs.map((d) => {
      const { __itemId, ...rest } = d.data();
      return rest;
    });
  } catch {
    return [];
  }
};

/**
 * Read all heavy user structures from subcollections. Returns only the
 * fields actually found (docs exist), so callers can spread-merge safely.
 */
export const readUserSubcollections = async (uid) => {
  if (!uid) return {};
  const [singletons, loginDevices, pendingDictionaryRequests] =
    await Promise.all([
      Promise.all(
        Object.keys(SINGLETONS).map(async (key) => [
          key,
          await readSingleton(uid, key),
        ]),
      ),
      readItemCollection(uid, "loginDevices"),
      readItemCollection(uid, "pendingDictionaryRequests"),
    ]);
  const out = {};
  singletons.forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  if (loginDevices.length > 0) out.loginDevices = loginDevices;
  if (pendingDictionaryRequests.length > 0)
    out.pendingDictionaryRequests = pendingDictionaryRequests;
  return out;
};

/**
 * Merge strategy: legacy top-level field wins on conflict during migration;
 * a subcollection value only fills in when the top-level field is absent.
 * After backfill, flip READ_SOURCE to 'sub' to invert the preference.
 */
export const mergeUserDocWithSubcollections = (user, sub) => {
  if (!user || !sub) return user;
  const merged = { ...user };
  const preferSub = READ_SOURCE === "sub";
  Object.entries(sub).forEach(([key, value]) => {
    const hasTopLevel =
      merged[key] !== undefined &&
      merged[key] !== null &&
      !(Array.isArray(merged[key]) && merged[key].length === 0);
    if (preferSub || !hasTopLevel) merged[key] = value;
  });
  return merged;
};

/** Convenience: does this patch contain heavy keys worth mirroring? */
export const hasHeavyUserKeys = (patch = {}) =>
  Object.keys(patch).some((key) => HEAVY_KEYS.has(key));
