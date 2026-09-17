import { afterEach, describe, expect, it, vi } from 'vitest';
import { runTransaction } from 'firebase/firestore';
import { saveAdminApprovalReply } from '../src/services/adminUserRepository';

vi.mock('../src/firebase', () => ({ auth: {}, db: {} }));
vi.mock('../src/services/userSubcollections', () => ({
  updateUserData: vi.fn(), readUserSubcollections: vi.fn(), mergeUserDocWithSubcollections: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...path) => path.join('/'), runTransaction: vi.fn(), serverTimestamp: () => 'timestamp',
  deleteDoc: vi.fn(), getDoc: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());

const database = (initial, failCommit = false) => {
  const records = structuredClone(initial);
  runTransaction.mockImplementation(async (_db, callback) => {
    const writes = [];
    const result = await callback({
      get: async (path) => {
        expect(writes).toHaveLength(0);
        return { exists: () => Object.hasOwn(records, path), data: () => structuredClone(records[path]) };
      },
      update: (path, patch) => writes.push({ path, patch }),
    });
    if (failCommit) throw new Error('permission-denied');
    for (const { path, patch } of writes) {
      for (const [field, value] of Object.entries(patch)) {
        const keys = field.split('.');
        let target = records[path];
        for (const key of keys.slice(0, -1)) target = target[key] ??= {};
        target[keys.at(-1)] = value;
      }
    }
    return result;
  });
  return records;
};
const initial = () => ({
  'updateApprovals/a': { payload: { distributorName: 'Current', other: 'keep' } },
  'users/u': { pendingUpdates: { profile: { status: 'pending', payload: { distributorName: 'Current' } } } },
});
const reply = (extra = {}) => saveAdminApprovalReply({
  approvalDocId: 'a', userId: 'u', type: 'profile', message: ' Please correct GST ', ...extra,
});

describe('confirmed approval reply persistence', () => {
  it('updates both destinations atomically while preserving current payload and request status', async () => {
    const records = database(initial());
    const result = await reply();
    expect(records['updateApprovals/a']).toMatchObject({ adminReply: 'Please correct GST',
      payload: { distributorName: 'Current', other: 'keep', adminReply: 'Please correct GST' } });
    expect(records['users/u'].pendingUpdates.profile).toEqual({ status: 'pending',
      payload: { distributorName: 'Current' }, adminReply: result.message, adminReplyAt: result.replyAt });
  });

  it('rejects a failed commit without publishing a reply to either destination', async () => {
    const before = initial();
    const records = database(before, true);
    await expect(reply()).rejects.toThrow('permission-denied');
    expect(records).toEqual(before);
  });

  it.each(['users/u', 'updateApprovals/a'])('rejects a missing destination %s without changing the other', async (path) => {
    const before = initial();
    delete before[path];
    const records = database(before);
    await expect(reply()).rejects.toThrow('no longer exists');
    expect(records).toEqual(before);
  });

  it('preserves array payloads and stores the reply outside the array', async () => {
    const records = database({ 'updateApprovals/a': { payload: [{ rate: 10 }] } });
    await reply({ userId: undefined, type: 'rates' });
    expect(records['updateApprovals/a'].payload).toEqual([{ rate: 10 }]);
    expect(records['updateApprovals/a'].adminReply).toBe('Please correct GST');
  });

  it('replies to a user-only request under its actual legacy type key', async () => {
    const records = database({ 'users/u': { pendingUpdates: { profileData: { status: 'pending' } } } });
    await reply({ approvalDocId: undefined, source: 'userDoc', pendingType: 'profileData' });
    expect(records['users/u'].pendingUpdates.profileData.adminReply).toBe('Please correct GST');
    expect(records['users/u'].pendingUpdates).not.toHaveProperty('profile');
  });

  it('updates only the matching embedded dictionary request and refuses removed requests', async () => {
    const records = database({ 'users/u': { pendingDictionaryRequests: [{ id: 'one' },
      { id: 'two', payload: { englishWord: 'milk', adminReply: 'Old reply' } }] } });
    const options = { approvalDocId: undefined, source: 'userDoc', type: 'dictionary',
      matchesDictionaryRequest: (request) => request.id === 'two' };
    await reply(options);
    expect(records['users/u'].pendingDictionaryRequests[0]).toEqual({ id: 'one' });
    expect(records['users/u'].pendingDictionaryRequests[1].adminReply).toBe('Please correct GST');
    expect(records['users/u'].pendingDictionaryRequests[1].payload).toMatchObject({
      englishWord: 'milk', adminReply: 'Please correct GST',
    });
    const before = structuredClone(records);
    await expect(reply({ ...options, matchesDictionaryRequest: () => false })).rejects.toThrow('no longer exists');
    expect(records).toEqual(before);
  });

  it('rejects a reply with no authoritative destination instead of allowing local-only success', async () => {
    await expect(reply({ approvalDocId: undefined, userId: undefined })).rejects.toThrow('valid request');
    expect(runTransaction).not.toHaveBeenCalled();
  });
});
