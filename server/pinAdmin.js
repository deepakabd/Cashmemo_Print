/**
 * Server-side PIN management.
 *
 * A PIN must never be hashed in the browser: the client cannot be trusted to
 * pick the algorithm, and anyone can POST whatever they like to Firestore. So
 * all PIN *writes* go through this module too, and only the hash is persisted.
 */

import { hashPin, isHashedPin } from "./pinCredentials.js";
import { LoginError } from "./loginService.js";

/**
 * Builds the field patch for storing a PIN: a scrypt hash plus a null plaintext
 * field so any pre-existing readable value is wiped in the same write.
 *
 * @param {string} pin plaintext PIN as entered by the admin/user
 * @returns {Promise<{ pinHash: string, pin: null, pinUpdatedAt: string }>}
 */
export const buildPinHashPatch = async (pin) => {
  const plaintext = String(pin ?? "");
  if (!plaintext)
    throw new LoginError("invalid-input", "PIN is required.", 400);
  if (plaintext.length > 64)
    throw new LoginError("invalid-input", "PIN is too long.", 400);

  return {
    pinHash: await hashPin(plaintext),
    pin: null,
    pinUpdatedAt: new Date().toISOString(),
  };
};

/**
 * Rewrites one user document so it no longer stores a readable PIN.
 * Returns the new patch when a change was made, or null when nothing to do.
 *
 * Used by the migration endpoint to backfill legacy plaintext accounts.
 */
export const migrateUserPin = async (userDoc) => {
  const stored = userDoc?.pinHash ?? userDoc?.pin ?? "";
  if (!stored) return null;

  if (isHashedPin(stored)) {
    // Already a hash — only normalise the field name if needed.
    if (!userDoc.pinHash) {
      return {
        pinHash: stored,
        pin: null,
        pinMigratedAt: new Date().toISOString(),
      };
    }
    return null;
  }

  // A legacy plaintext PIN cannot be re-hashed without the original value, so
  // the only safe action is to clear it and force a PIN reset.
  return {
    pin: null,
    pinHash: null,
    pinResetRequired: true,
    pinMigratedAt: new Date().toISOString(),
  };
};
