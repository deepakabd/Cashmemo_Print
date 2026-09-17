import { createHash } from 'node:crypto';
import { getAdmin, LoginError } from './loginService.js';
import { buildAdminUserRestoreData } from '../src/utils/adminUserRestore.js';
import { isHashedPin } from './pinCredentials.js';
import { USER_SINGLETON_PATHS } from '../src/utils/userDataSchema.js';

const normalizeCode = (value) => String(value || '').trim().toUpperCase();
const guardId = (code) => createHash('sha256').update(code).digest('hex');
const validId = (id) => typeof id === 'string' && id.length > 0 && !id.includes('/') && id !== '.' && id !== '..';
const duplicate = (code) => new LoginError('duplicate-dealer-code', `Dealer code ${code} already exists. Edit the existing user instead.`, 409);

// Admin SDK transactions support query reads, including legacy documents
// created before reservations existed. The shared guard serializes new writes.
export const saveAdminUserTransaction = async (firestore, { mode = 'create', userId, requestId, data } = {}, timestamp, actor = 'admin') => {
  if (!['create', 'update', 'approve', 'restore'].includes(mode)
    || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new LoginError('invalid-input', 'Invalid user write.', 400);
  }
  const code = normalizeCode(data.dealerCode);
  if (!code || code.length > 128 || (userId != null && !validId(userId))
    || (mode === 'update' && !userId) || (mode === 'approve' && !validId(requestId))) {
    throw new LoginError('invalid-input', 'Valid dealer code and user ID required.', 400);
  }
  const patch = { ...(mode === 'restore' ? buildAdminUserRestoreData(data) : data), dealerCode: code, updatedAt: timestamp };
  if (mode === 'restore') {
    if (!isHashedPin(patch.pinHash)) delete patch.pinHash;
    patch.approvalStatus = {};
  }
  if (Array.isArray(patch.ratesData)) patch.ratesDataCount = patch.ratesData.length;
  delete patch.id;
  delete patch.approved;
  delete patch.confirmPin;
  const users = firestore.collection('users');
  const guards = firestore.collection('dealerCodeReservations');
  // Stable across transaction retries; never create multiple auto-IDs on retry.
  const candidateRef = userId ? users.doc(userId) : users.doc();

  return firestore.runTransaction(async (tx) => {
    const requestRef = mode === 'approve' ? firestore.collection('registrationRequests').doc(requestId) : null;
    const request = requestRef ? await tx.get(requestRef) : null;
    if (requestRef && !request.exists) {
      throw new LoginError('request-not-found', 'Registration request no longer exists.', 404);
    }
    if (request && normalizeCode(request.data().dealerCode) !== code) {
      throw new LoginError('request-mismatch', 'Registration dealer code changed. Refresh and retry.', 409);
    }
    if (request && !['pending', 'approved'].includes(request.data().status || 'pending')) {
      throw new LoginError('request-not-pending', 'Registration request is no longer pending.', 409);
    }
    if (request?.data().status === 'approved') {
      const approvedUserId = request.data().approvedUserId;
      if (!validId(approvedUserId)) {
        throw new LoginError('approval-inconsistent', 'Previous approval has no linked user. Admin reconciliation required.', 409);
      }
      const approvedUser = await tx.get(users.doc(approvedUserId));
      if (!approvedUser.exists || normalizeCode(approvedUser.data().dealerCode) !== code) {
        throw new LoginError('approval-inconsistent', 'Previously approved user is missing or changed. Admin reconciliation required.', 409);
      }
      return { id: approvedUserId, dealerCode: code, alreadyApproved: true };
    }
    const guardRef = guards.doc(guardId(code));
    const guard = await tx.get(guardRef);
    const matches = await tx.get(users.where('dealerCode', '==', code).limit(2));
    if (matches.size > 1) throw duplicate(code);
    const existing = matches.docs[0];
    if (mode === 'create' && existing) throw duplicate(code);
    if (existing && mode !== 'approve' && existing.id !== candidateRef.id) throw duplicate(code);
    const targetRef = mode === 'approve' && existing ? existing.ref : candidateRef;
    const current = await tx.get(targetRef);
    if (mode === 'restore' && current.exists) {
      throw new LoginError('user-already-exists', 'User already exists. Refresh the list instead of restoring over it.', 409);
    }
    if (mode === 'update' && !current.exists) {
      throw new LoginError('user-not-found', 'User no longer exists.', 404);
    }
    const ownerId = guard.exists ? guard.data().userId : null;
    if (ownerId && ownerId !== targetRef.id) {
      const owner = await tx.get(users.doc(ownerId));
      // A deleted/renamed owner must not permanently reserve the old code.
      if (owner.exists && normalizeCode(owner.data().dealerCode) === code) throw duplicate(code);
    }
    const oldCode = current.exists ? normalizeCode(current.data().dealerCode) : '';
    let oldGuardRef;
    let oldGuard;
    if (oldCode && oldCode !== code) {
      oldGuardRef = guards.doc(guardId(oldCode));
      oldGuard = await tx.get(oldGuardRef);
    }
    // Every read precedes every write.
    if (oldGuard?.exists && oldGuard.data().userId === targetRef.id) tx.delete(oldGuardRef);
    tx.set(guardRef, { dealerCode: code, userId: targetRef.id });
    const next = { ...patch };
    if (!current.exists) {
      next.createdAt = timestamp;
      next.approvalStatus ??= {};
      next.role ??= 'operator';
      next.ratesDataCount ??= 0;
      next.status ??= 'active';
      if (next.status === 'active') next.approvedAt = timestamp;
    }
    if (mode === 'approve') {
      next.role = current.exists ? (current.data().role || 'operator') : 'operator';
      next.status = 'active';
      next.approvedAt = timestamp;
    }
    if (mode === 'restore') next.restoredAt = timestamp;
    for (const [field, path] of Object.entries(USER_SINGLETON_PATHS)) {
      if (Object.hasOwn(next, field) || mode === 'restore') {
        tx.set(users.doc(`${targetRef.id}/${path}`), { value: next[field] ?? null, updatedAt: timestamp });
      }
    }
    // Replace patched maps as complete values, matching their singleton copies.
    tx.set(targetRef, next, mode === 'restore' ? { merge: false } : { mergeFields: Object.keys(next) });
    if (requestRef) {
      tx.set(requestRef, { status: 'approved', approvedUserId: targetRef.id,
        approvedAt: timestamp, approvedBy: actor }, { merge: true });
      tx.set(firestore.collection('adminAuditTrail').doc(`registration-approved-${guardId(requestId)}`), {
        action: 'registration_approved', actor, createdAt: timestamp,
        details: { id: requestId, dealerCode: code, userId: targetRef.id },
      });
    }
    return { id: targetRef.id, dealerCode: code };
  });
};

export const saveAdminUser = async (authorization, body) => {
  const token = /^Bearer (.+)$/i.exec(String(authorization || ''))?.[1];
  if (!token) throw new LoginError('unauthorized', 'Admin sign-in required.', 401);
  const { auth, firestore } = await getAdmin();
  let claims;
  try { claims = await auth.verifyIdToken(token, true); } catch {
    throw new LoginError('unauthorized', 'Admin session is invalid. Please sign in again.', 401);
  }
  if (claims.role !== 'admin') throw new LoginError('forbidden', 'Admin role required.', 403);
  const { FieldValue } = await import('firebase-admin/firestore');
  return saveAdminUserTransaction(firestore, body, FieldValue.serverTimestamp(), claims.email || claims.uid || 'admin');
};
