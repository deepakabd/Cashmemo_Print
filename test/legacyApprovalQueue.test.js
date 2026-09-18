import { expect, it } from 'vitest';
import { buildLegacyApprovalQueue } from '../scripts/legacyApprovalQueue.js';

it('migrates user-only payloads and keeps dictionary matching identifiers', () => {
  const users = [{ id: 'u', pendingUpdates: { profile: { status: 'pending', payload: { name: 'New' } },
    bank: { status: 'approved', payload: {} } }, pendingDictionaryRequests: [
    { id: 'client', status: 'pending', payload: { clientRequestId: 'client', englishWord: 'Milk' } },
  ] }];
  const records = buildLegacyApprovalQueue(users, []);
  expect(records).toHaveLength(2);
  expect(records[0]).toMatchObject({ userId: 'u', type: 'profile', pendingType: 'profile', payload: { name: 'New' } });
  expect(records[1]).toMatchObject({ userId: 'u', type: 'dictionary', clientRequestId: 'client' });
  expect(buildLegacyApprovalQueue(users, records)).toEqual([]);
  expect(buildLegacyApprovalQueue(users, records.map((entry) => ({ ...entry, status: 'approved' })))).toEqual([]);
});

it('does not duplicate collection requests or reopen a completed dictionary request', () => {
  const users = [{ id: 'u', pendingUpdates: { profileData: { payload: { name: 'New' } } },
    pendingDictionaryRequests: [{ id: 'client', approvalId: 'dict', payload: { englishWord: 'Milk' } }] }];
  expect(buildLegacyApprovalQueue(users, [
    { id: 'profile', userId: 'u', type: 'profile', status: 'pending' },
    { id: 'dict', userId: 'u', type: 'dictionary', status: 'approved' },
  ])).toEqual([]);
});
