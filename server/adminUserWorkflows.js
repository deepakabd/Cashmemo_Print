import { LoginError } from './loginService.js';
import { isMatchingDictionaryRequest } from '../src/utils/dictionaryHelpers.js';

const TYPES = ['profile', 'profileData', 'bank', 'bankDetailsData', 'rates', 'rate', 'ratesData',
  'header', 'hindiHeaderData', 'deliveryArea', 'deliveryStaff', 'planUpgrade', 'dictionary'];
const validId = (id) => typeof id === 'string' && id.length > 0 && !id.includes('/') && id !== '.' && id !== '..';
const fail = (message, status = 400) => { throw new LoginError(status === 404 ? 'not-found' : 'invalid-input', message, status); };

export const mutateAdminUserWorkflow = async (firestore, body, timestamp) => {
  const { mode, userId, approvalDocId, type, pendingType = type, source, message, approval: identity = {}, status } = body;
  if (![userId, approvalDocId].some(Boolean) || (userId && !validId(userId)) || (approvalDocId && !validId(approvalDocId))) fail('Mutation needs a valid destination.');
  if (mode === 'delete' && !userId) fail('User ID required.');
  const reply = String(message || '').trim();
  if (mode === 'reply' && (!reply || !TYPES.includes(type))) fail('Reply needs a valid request and message.');
  if (mode === 'completeDictionary' && !['approved', 'rejected'].includes(status)) fail('Invalid dictionary completion status.');
  if (pendingType && !TYPES.includes(pendingType)) fail('Invalid pending request type.');
  return firestore.runTransaction(async (tx) => {
    const userRef = userId ? firestore.collection('users').doc(userId) : null;
    const approvalRef = approvalDocId ? firestore.collection('updateApprovals').doc(approvalDocId) : null;
    const user = userRef ? await tx.get(userRef) : null;
    const approval = approvalRef ? await tx.get(approvalRef) : null;
    if (userRef && !user.exists) fail(mode === 'completeDictionary' ? 'User document not found.' : 'User no longer exists.', 404);
    if (approvalRef && !approval.exists) fail('Approval request no longer exists.', 404);
    if (approval?.data().userId && userId && approval.data().userId !== userId) fail('Approval belongs to a different user.');
    if (mode === 'delete') {
      tx.delete(userRef);
      return { id: userId };
    }
    // Match by stable IDs, using the authoritative collection payload when present.
    const requestIdentity = approval ? { ...approval.data(), id: approvalDocId }
      : identity;
    const matches = (request) => isMatchingDictionaryRequest(request, requestIdentity, userId);
    const requests = Array.isArray(user?.data().pendingDictionaryRequests) ? user.data().pendingDictionaryRequests : [];
    const patch = { updatedAt: timestamp };
    if (mode === 'completeDictionary') {
      const remaining = requests.filter((request) => !matches(request));
      if (userRef) {
        patch.pendingDictionaryRequests = remaining;
        patch.dictionaryPendingCount = remaining.length;
        if (pendingType) patch[`pendingUpdates.${pendingType}.status`] = status;
        tx.update(userRef, patch);
      }
      if (approvalRef) tx.update(approvalRef, { status, updatedAt: timestamp });
      return { status };
    }
    const replyAt = new Date().toISOString();
    if (userRef && type === 'dictionary') {
      let matched = false;
      const next = requests.map((request) => {
        if (!matches(request)) return request;
        matched = true;
        const payload = request.payload;
        return { ...request, adminReply: reply, adminReplyAt: replyAt,
          ...(payload && typeof payload === 'object' && !Array.isArray(payload)
            ? { payload: { ...payload, adminReply: reply, adminReplyAt: replyAt } } : {}),
        };
      });
      if (source === 'userDoc' && !matched) fail('Dictionary request no longer exists.', 404);
      if (matched) patch.pendingDictionaryRequests = next;
    } else if (userRef) {
      const pending = user.data().pendingUpdates || {};
      const key = pending[pendingType] ? pendingType : type;
      if (source === 'userDoc' && !pending[key]) fail('User approval request no longer exists.', 404);
      patch[`pendingUpdates.${key}.adminReply`] = reply;
      patch[`pendingUpdates.${key}.adminReplyAt`] = replyAt;
    }
    if (approvalRef) {
      const replyPatch = { adminReply: reply, adminReplyAt: replyAt, updatedAt: timestamp };
      const payload = approval.data().payload;
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        replyPatch['payload.adminReply'] = reply;
        replyPatch['payload.adminReplyAt'] = replyAt;
      }
      tx.update(approvalRef, replyPatch);
    }
    if (userRef) tx.update(userRef, patch);
    return { message: reply, replyAt };
  });
};
