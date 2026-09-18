import { createHash } from 'node:crypto';

const pending = (entry) => String(entry?.status || 'pending').toLowerCase() === 'pending';
const normalizeType = (type) => ({ profileData: 'profile', bankDetailsData: 'bank', ratesData: 'rates', rate: 'rates',
  hindiHeaderData: 'header', dict: 'dictionary', translationdictionary: 'dictionary' }[type] || type);
const dictionaryIdentity = (entry) => entry.clientRequestId || entry.payload?.clientRequestId
  || JSON.stringify([entry.payload?.englishWord || entry.payload?.eng, entry.payload?.hindiTranslation, entry.payload?.phraseKind || 'token']);

export const buildLegacyApprovalQueue = (users, approvals) => {
  const result = [];
  const existingIds = new Set(approvals.map((entry) => entry.id));
  for (const user of users) {
    const candidates = [
      ...Object.entries(user.pendingUpdates || {}).filter(([, entry]) => pending(entry)).map(([type, entry]) => ({
        ...entry, type, pendingType: type, legacyKey: `update-${type}`,
      })),
      ...(user.pendingDictionaryRequests || []).filter(pending).map((entry, index) => ({
        ...entry, type: 'dictionary', payload: entry.payload || entry,
        clientRequestId: entry.id || entry.payload?.clientRequestId || '',
        legacyKey: `dictionary-${entry.id || entry.approvalId || index}`,
      })),
    ];
    for (const entry of candidates) {
      const id = `legacy-${createHash('sha256').update(`${user.id}/${entry.legacyKey}`).digest('hex')}`;
      if (existingIds.has(id) || existingIds.has(entry.approvalId)) continue;
      const type = normalizeType(entry.type);
      const duplicate = [...approvals, ...result].some((other) => other.userId === user.id
        && normalizeType(other.type) === type
        && (type === 'dictionary' ? dictionaryIdentity(other) === dictionaryIdentity(entry) : pending(other)));
      if (duplicate) continue;
      if (entry.payload == null) throw new Error(`Missing approval payload: ${user.id}/${entry.legacyKey}`);
      result.push({ id, userId: user.id, dealerCode: user.dealerCode || '', dealerName: user.dealerName || '',
        type: entry.type, status: 'pending', payload: entry.payload,
        requestedAt: entry.requestedAt || '', adminReply: entry.adminReply || '', adminReplyAt: entry.adminReplyAt || '',
        ...(entry.pendingType ? { pendingType: entry.pendingType } : {}),
        ...(entry.clientRequestId ? { clientRequestId: entry.clientRequestId } : {}), source: 'legacy-migration' });
    }
  }
  return result;
};
