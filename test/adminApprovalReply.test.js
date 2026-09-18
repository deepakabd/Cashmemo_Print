import { afterEach, describe, expect, it, vi } from 'vitest';
import { mutateAdminUserWorkflow } from '../server/adminUserWorkflows.js';

let firestore;
afterEach(() => { firestore = null; vi.resetAllMocks(); });

const database = (initial, failCommit = false) => {
  const records = structuredClone(initial);
  firestore = { collection: (name) => ({ doc: (id) => `${name}/${id}` }), runTransaction: async (callback) => {
    const writes = [];
    const result = await callback({
      get: async (path) => {
        expect(writes).toHaveLength(0);
        return { exists: Object.hasOwn(records, path), data: () => structuredClone(records[path]) };
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
  } };
  return records;
};
const initial = () => ({
  'updateApprovals/a': { payload: { distributorName: 'Current', other: 'keep' } },
  'users/u': { pendingUpdates: { profile: { status: 'pending', payload: { distributorName: 'Current' } } } },
});
const reply = (extra = {}) => mutateAdminUserWorkflow(firestore, { mode: 'reply',
  approvalDocId: 'a', userId: 'u', type: 'profile', message: ' Please correct GST ', ...extra,
}, 'timestamp');

describe('confirmed approval reply persistence', () => {
  it.each(['approved', 'rejected'])('refuses dictionary completion as %s when the supplied user is missing', async (status) => {
    const before = { 'updateApprovals/a': { status: 'pending', userId: 'missing' } };
    const records = database(before);
    await expect(mutateAdminUserWorkflow(firestore, { mode: 'completeDictionary', userId: 'missing', approvalDocId: 'a', status }, 'timestamp'))
      .rejects.toThrow('User document not found.');
    expect(records).toEqual(before);
  });

  it('completes both dictionary destinations, preserving other pending requests', async () => {
    const records = database({ 'users/u': { pendingDictionaryRequests: [
      { id: 'done', approvalId: 'a' }, { id: 'remaining' },
    ] }, 'updateApprovals/a': { userId: 'u', type: 'dictionary', status: 'pending' } });
    await mutateAdminUserWorkflow(firestore, { mode: 'completeDictionary', userId: 'u', approvalDocId: 'a',
      pendingType: 'dictionary', status: 'approved' }, 'timestamp');
    expect(records['users/u']).toMatchObject({ pendingDictionaryRequests: [{ id: 'remaining' }], dictionaryPendingCount: 1,
      pendingUpdates: { dictionary: { status: 'approved' } } });
    expect(records['updateApprovals/a'].status).toBe('approved');
  });

  it('preserves both dictionary destinations when the commit fails', async () => {
    const before = { 'users/u': { pendingDictionaryRequests: [{ approvalId: 'a' }] },
      'updateApprovals/a': { userId: 'u', status: 'pending' } };
    const records = database(before, true);
    await expect(mutateAdminUserWorkflow(firestore, { mode: 'completeDictionary', userId: 'u', approvalDocId: 'a', status: 'rejected' }, 'timestamp'))
      .rejects.toThrow('permission-denied');
    expect(records).toEqual(before);
  });

  it('supports approval-only dictionary completion and rejects mismatched owners', async () => {
    const records = database({ 'updateApprovals/a': { status: 'pending' } });
    await mutateAdminUserWorkflow(firestore, { mode: 'completeDictionary', approvalDocId: 'a', status: 'rejected' }, 'timestamp');
    expect(records['updateApprovals/a'].status).toBe('rejected');
    const before = { 'users/u': {}, 'updateApprovals/a': { userId: 'other', status: 'pending' } };
    const mismatched = database(before);
    await expect(mutateAdminUserWorkflow(firestore, { mode: 'completeDictionary', userId: 'u', approvalDocId: 'a', status: 'approved' }, 'timestamp'))
      .rejects.toThrow('different user');
    expect(mismatched).toEqual(before);
  });

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
      approval: { id: 'userdict-u-two' } };
    await reply(options);
    expect(records['users/u'].pendingDictionaryRequests[0]).toEqual({ id: 'one' });
    expect(records['users/u'].pendingDictionaryRequests[1].adminReply).toBe('Please correct GST');
    expect(records['users/u'].pendingDictionaryRequests[1].payload).toMatchObject({
      englishWord: 'milk', adminReply: 'Please correct GST',
    });
    const before = structuredClone(records);
    await expect(reply({ ...options, approval: { id: 'missing' } })).rejects.toThrow('no longer exists');
    expect(records).toEqual(before);
  });

  it('rejects a reply with no authoritative destination instead of allowing local-only success', async () => {
    await expect(reply({ approvalDocId: undefined, userId: undefined })).rejects.toThrow('valid destination');
    expect(firestore).toBeNull();
  });
});
