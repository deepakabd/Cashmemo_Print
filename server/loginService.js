/**
 * Shared logic for the `POST /api/login` endpoint.
 *
 * Flow (trusted layer):
 *   dealerCode + PIN  ->  look up user (admin credentials)  ->  verifyPin()
 *                     ->  status/expiry checks  ->  mint Firebase custom token
 *
 * The plaintext PIN is only used for the scrypt comparison and is never stored
 * or logged. The client exchanges the returned custom token for a real Firebase
 * Auth session via `signInWithCustomToken`, which is what makes Firestore
 * Security Rules enforceable.
 *
 * This module is intentionally dependency-tolerant: `firebase-admin` is loaded
 * lazily so the app still builds/runs (in a degraded, "locked" mode) before the
 * service account is configured.
 */

import { verifyPin, hashPin, isHashedPin } from './pinCredentials.js';
import { resolveAdminCredential } from './adminCredential.js';

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

export class LoginError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let adminApp = null;
let adminInitError = null;

/**
 * Lazily initialises firebase-admin from either:
 *   - GOOGLE_APPLICATION_CREDENTIALS (path to a service account JSON), or
 *   - FIREBASE_SERVICE_ACCOUNT (inline JSON string), or
 *   - Application Default Credentials (Cloud Functions / GCP runtime).
 */
const getAdmin = async () => {
  if (adminApp) return adminApp;
  if (adminInitError) throw adminInitError;

  try {
    // Built at runtime so a bundler never tries to statically resolve the
    // optional `firebase-admin` dependency into the client build.
    const loadAdmin = (subpath) => import(/* @vite-ignore */ subpath);
    const { initializeApp, getApps, cert, applicationDefault } = await loadAdmin('firebase-admin/app');

    const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!inline && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_PROJECT) {
      // Surface this before the SDK fails with an opaque metadata error.
      throw new Error('Could not load the default credentials: no GOOGLE_APPLICATION_CREDENTIALS set.');
    }
    const credential = resolveAdminCredential({ cert, applicationDefault });

    const app = getApps()[0] || initializeApp({
      credential,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    });

    const { getAuth } = await loadAdmin('firebase-admin/auth');
    const { getFirestore } = await loadAdmin('firebase-admin/firestore');

    adminApp = { app, auth: getAuth(app), firestore: getFirestore(app) };
    return adminApp;
  } catch (error) {
    // Distinguish "not installed" / "no credentials" from "credentials rejected",
    // because the fix is different in each case.
    const reason = String(error?.message || error?.code || error);
    const detail = /Cannot find module|ERR_MODULE_NOT_FOUND/i.test(reason)
      ? 'firebase-admin is not installed. Run: npm install firebase-admin --save-optional'
      : /invalid_grant|invalid-credential|Could not load the default credentials|metadata/i.test(reason)
        ? 'Server credentials are missing or expired. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON for this Firebase project.'
        : `Admin SDK init failed: ${reason}`;

    console.error('[login] admin init failed:', reason);

    adminInitError = new LoginError('server-not-configured', detail, 503);
    adminInitError.cause = error;
    throw adminInitError;
  }
};

/** Resolves the Firestore doc for a dealer code, rejecting ambiguous/absent ones. */
const findUserByDealerCode = async (firestore, dealerCode) => {
  const snapshot = await firestore
    .collection('users')
    .where('dealerCode', '==', dealerCode)
    .limit(2)
    .get();

  if (snapshot.size > 1) {
    throw new LoginError('duplicate', 'Multiple accounts found for this dealer code.', 409);
  }
  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
};

/** Maps internal status to the client-visible outcome. */
const resolveAccountStatus = (status) => {
  const normalized = String(status || 'active').toLowerCase();
  if (normalized === 'pending') return 'pending';
  if (normalized === 'disabled') return 'disabled';
  if (normalized === 'expired') return 'expired';
  return 'active';
};

/**
 * Verifies dealer code + PIN and returns a Firebase custom token.
 *
 * @param {{ dealerCode: string, pin: string }} credentials
 * @returns {Promise<{ token: string, dealerCode: string, uid: string }>}
 */
export const verifyDealerLogin = async ({ dealerCode, pin }) => {
  const code = String(dealerCode ?? '').trim();
  const plainPin = String(pin ?? '');

  if (!code || !plainPin) {
    throw new LoginError('invalid-input', 'Dealer code and PIN are required.', 400);
  }

  const { auth, firestore } = await getAdmin();
  const user = await findUserByDealerCode(firestore, code);

  if (!user) {
    throw new LoginError('not-found', 'Dealer code not found.', 404);
  }

  const storedPin = user.pinHash ?? user.pin ?? '';
  const { matches, legacy } = await verifyPin(plainPin, storedPin);

  if (!matches) {
    throw new LoginError('bad-credentials', 'Dealer code or PIN is incorrect.', 401);
  }

  const accountStatus = resolveAccountStatus(user.status);
  if (accountStatus === 'pending') {
    throw new LoginError('pending', 'Your registration is pending admin approval.', 403);
  }
  if (accountStatus === 'disabled') {
    throw new LoginError('disabled', 'Your account is disabled. Contact admin.', 403);
  }

  const validTill = user.validTill ? new Date(user.validTill) : null;
  const expired = validTill && !Number.isNaN(validTill.getTime()) && Date.now() > validTill.getTime();

  // Expired accounts may still sign in (the UI shows the renewal guide), but the
  // claim records it so Security Rules can deny data access.
  let uid = user.authUid || user.uid;

  if (!uid) {
    // First login after migration: attach a real Firebase Auth user to the doc.
    // A Firestore doc id is not always a valid Auth uid, so fall back to an
    // auto-generated uid and remember the mapping on the user document.
    let created;
    try {
      created = await auth.createUser({ uid: user.id });
    } catch (error) {
      if (error?.code === 'auth/uid-already-exists') {
        created = await auth.getUser(user.id);
      } else {
        created = await auth.createUser({});
      }
    }
    uid = created.uid;
    try {
      await firestore.collection('users').doc(user.id).update({ authUid: uid });
    } catch {
      // Best-effort: a repeated login will resolve the same uid again.
    }
  }

  await auth.setCustomUserClaims(uid, {
    dealerCode: code,
    role: user.role || 'operator',
    accountActive: accountStatus === 'active',
    planActive: !expired,
  });

  const token = await auth.createCustomToken(uid, {
    dealerCode: code,
    accountActive: accountStatus === 'active',
    planActive: !expired,
  });

  // Opportunistic upgrade of legacy plaintext PINs. Never blocks the login.
  if (legacy) {
    try {
      const pinHash = await hashPin(plainPin);
      await firestore.collection('users').doc(user.id).update({
        pinHash,
        pin: null,
        pinMigratedAt: new Date().toISOString(),
      });
    } catch {
      // Best-effort: an admin backfill script can finish the migration.
    }
  } else if (!user.pinHash && isHashedPin(storedPin)) {
    try {
      await firestore.collection('users').doc(user.id).update({ pinHash: storedPin, pin: null });
    } catch {
      // Best-effort.
    }
  }

  return { token, dealerCode: code, uid };
};

/** Exported for tests / tooling. */
export const __internals = { findUserByDealerCode, resolveAccountStatus, FIRESTORE_SCOPE };
