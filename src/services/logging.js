import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { ADMIN_AUDIT_COLLECTION } from "../utils/storageHelpers";

export const buildAuditEntry = (action, details = {}, actor = "admin") => ({
  id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  action,
  details,
  createdAt: new Date().toISOString(),
  actor,
});

export const readLocalAuditTrail = () => {
  try {
    return JSON.parse(localStorage.getItem("adminAuditTrail") || "[]");
  } catch {
    return [];
  }
};

export const writeLocalAuditTrail = (trail) => {
  try {
    localStorage.setItem(
      "adminAuditTrail",
      JSON.stringify(trail.slice(0, 150)),
    );
  } catch {
    // storage full — local audit write is best effort
  }
};

export const writeFirestoreAuditEntry = async (
  action,
  details = {},
  actor = "admin",
) => {
  await addDoc(collection(db, ADMIN_AUDIT_COLLECTION), {
    action,
    details,
    actor,
    createdAt: serverTimestamp(),
  });
};
