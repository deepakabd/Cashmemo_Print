import { getAdmin, LoginError } from './loginService.js';
import { getUserAccountStatus } from '../src/utils/userAccountStatus.js';
import { loadDealerRates, saveDealerRates } from './d1RateStore.js';

const fail = (message, status = 400) => { throw new LoginError('rate-error', message, status); };

export const rateWorkspace = async (authorization, body) => {
  const token = /^Bearer (.+)$/i.exec(String(authorization || ''))?.[1];
  if (!token) fail('Sign in to access rates.', 401);
  const { auth, firestore } = await getAdmin();
  let claims;
  try { claims = await auth.verifyIdToken(token, true); } catch { fail('Sign in again to access rates.', 401); }
  const userId = String(body?.userId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId)) fail('Valid dealer account required.');
  const user = await firestore.collection('users').doc(userId).get();
  const data = user.data();
  if (!user.exists || claims.dealerCode !== data?.dealerCode || claims.accountActive !== true || claims.planActive !== true || getUserAccountStatus(data) !== 'active') fail('Rate access is not allowed for this account.', 403);
  if (body.mode === 'load') return { rates: await loadDealerRates(userId) };
  if (body.mode !== 'save' || !Array.isArray(body.rates) || body.rates.length > 1000) fail('Valid rate data required.');
  if (claims.role === 'viewer' || data?.role === 'viewer') fail('This account has read-only rate access.', 403);
  await saveDealerRates(userId, data.dealerCode, body.rates);

  // Approval writes run through the Admin SDK so saving rates does not depend
  // on browser Firestore rules or on freshly propagated custom claims.
  const now = new Date();
  const requestedAt = now.toISOString();
  const approvalRef = firestore.collection('updateApprovals').doc(`rates-${userId}`);
  const batch = firestore.batch();
  batch.set(approvalRef, {
    userId,
    dealerCode: data.dealerCode || '',
    dealerName: data.dealerName || '',
    type: 'rates',
    payload: body.rates,
    status: 'pending',
    requestedAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.update(user.ref, {
    'pendingUpdates.rates': {
      status: 'pending',
      payload: body.rates,
      requestedAt,
      adminReply: '',
      adminReplyAt: '',
    },
    lastApprovalStorage: 'collection',
    updatedAt: now,
  });
  await batch.commit();
  return { saved: true, approvalPending: true, count: body.rates.length };
};
