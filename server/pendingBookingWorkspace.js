import { getAdmin, LoginError } from './loginService.js';
import { getUserAccountStatus } from '../src/utils/userAccountStatus.js';
import { loadPendingBookingSnapshot, savePendingBookingSnapshot } from './d1PendingBookingStore.js';

const fail = (message, status = 400) => { throw new LoginError('pending-booking-error', message, status); };

export const pendingBookingWorkspace = async (authorization, body) => {
  const token = /^Bearer (.+)$/i.exec(String(authorization || ''))?.[1];
  if (!token) fail('Sign in to access pending booking data.', 401);
  const { auth, firestore } = await getAdmin();
  let claims;
  try { claims = await auth.verifyIdToken(token, true); } catch { fail('Sign in again to access pending booking data.', 401); }
  const userId = String(body?.userId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId)) fail('Valid dealer account required.');
  const user = await firestore.collection('users').doc(userId).get();
  const data = user.data();
  if (!user.exists || claims.dealerCode !== data?.dealerCode || claims.accountActive !== true || claims.planActive !== true || getUserAccountStatus(data) !== 'active') {
    fail('Pending booking access is not allowed for this account.', 403);
  }
  if (body.mode === 'load') return { snapshot: await loadPendingBookingSnapshot(userId) };
  if (body.mode !== 'save' || !Array.isArray(body.rows) || body.rows.length > 50000) fail('Valid pending booking data required.');
  if (claims.role === 'viewer' || data?.role === 'viewer') fail('This account has read-only booking access.', 403);
  const result = await savePendingBookingSnapshot(userId, data.dealerCode, body.rows, body.metadata);
  return { saved: true, count: body.rows.length, uploadedAt: result.uploadedAt };
};
