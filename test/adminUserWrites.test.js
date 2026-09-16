import { describe, expect, it, vi } from 'vitest';
import { saveAdminUserTransaction, saveAdminUser } from '../server/adminUsers.js';

const sdk = vi.hoisted(() => ({ verifyIdToken: vi.fn(), firestore: null }));
vi.mock('../server/loginService.js', async (original) => ({
  ...await original(), getAdmin: async () => ({ auth: sdk, firestore: sdk.firestore }),
}));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'timestamp' } }));

// Optimistic transaction harness: concurrent writes to a read document retry
// the callback and only successful commits publish their staged writes.
const database = (initial = {}) => {
  const records = new Map(Object.entries(initial));
  const versions = new Map();
  let nextId = 0;
  const ref = (path) => ({ path, id: path.split('/').pop() });
  const collection = (name) => ({
    doc: (id = `generated-${++nextId}`) => ref(`${name}/${id}`),
    where: (field, op, value) => ({ limit: (count) => ({ query: { name, field, value, count } }) }),
  });
  const snapshot = (docRef) => ({ ...docRef, ref: docRef, exists: records.has(docRef.path),
    data: () => ({ ...records.get(docRef.path) }),
  });
  const firestore = { collection, runTransaction: async (callback) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const reads = new Map();
      const writes = [];
      const tx = {
        get: async (target) => {
          expect(writes).toHaveLength(0);
          if (target.query) {
            const { name, field, value, count } = target.query;
            const docs = [...records.entries()].filter(([path, data]) =>
              path.startsWith(`${name}/`) && data[field] === value)
              .slice(0, count).map(([path]) => snapshot(ref(path)));
            for (const doc of docs) reads.set(doc.path, versions.get(doc.path) || 0);
            return { size: docs.length, docs };
          }
          reads.set(target.path, versions.get(target.path) || 0);
          return snapshot(target);
        },
        set: (target, data, options) => writes.push({ target, data, options }),
        delete: (target) => writes.push({ target, remove: true }),
      };
      const result = await callback(tx);
      if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) continue;
      for (const { target, data, options, remove } of writes) {
        if (remove) records.delete(target.path);
        else records.set(target.path, options?.merge ? { ...records.get(target.path), ...data } : data);
        versions.set(target.path, (versions.get(target.path) || 0) + 1);
      }
      return result;
    }
    throw new Error('Transaction retry limit exceeded');
  } };
  return { firestore, records };
};
const create = (firestore, code, mode = 'create', userId) => saveAdminUserTransaction(firestore,
  { mode, userId, data: { dealerCode: code, dealerName: 'Test', status: 'active' } }, 'timestamp');

describe('server dealer code uniqueness', () => {
  it('rejects a legacy Firestore user without relying on UI state or an existing guard', async () => {
    const { firestore, records } = database({ 'users/old': { dealerCode: '41012345' } });
    await expect(create(firestore, '41012345')).rejects.toMatchObject({ status: 409, code: 'duplicate-dealer-code' });
    expect(records.size).toBe(1);
  });

  it('allows exactly one of two simultaneous creates of the normalized code', async () => {
    const { firestore, records } = database();
    const results = await Promise.allSettled([create(firestore, ' abc '), create(firestore, 'ABC')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected').reason.code).toBe('duplicate-dealer-code');
    expect([...records.keys()].filter((path) => path.startsWith('users/'))).toHaveLength(1);
    expect([...records.values()].filter((data) => data.userId)).toHaveLength(1);
  });

  it('finds the actual existing user during approval and preserves their role', async () => {
    const { firestore, records } = database({ 'users/old': { dealerCode: '123', role: 'manager' } });
    expect(await create(firestore, '123', 'approve')).toMatchObject({ id: 'old' });
    expect(records.get('users/old')).toMatchObject({ status: 'active', role: 'manager' });
    expect([...records.keys()].filter((path) => path.startsWith('users/'))).toHaveLength(1);
  });

  it('rejects approval when legacy duplicates already exist', async () => {
    const { firestore, records } = database({ 'users/a': { dealerCode: '123' }, 'users/b': { dealerCode: '123' } });
    await expect(create(firestore, '123', 'approve')).rejects.toMatchObject({ status: 409 });
    expect(records.size).toBe(2);
  });

  it('rejects editing or restoring another user onto an occupied code', async () => {
    const { firestore, records } = database({ 'users/a': { dealerCode: '123' }, 'users/b': { dealerCode: '456' } });
    await expect(create(firestore, '123', 'update', 'b')).rejects.toMatchObject({ status: 409 });
    await expect(create(firestore, '123', 'restore', 'deleted')).rejects.toMatchObject({ status: 409 });
    expect(records.get('users/b').dealerCode).toBe('456');
    expect(records.has('users/deleted')).toBe(false);
  });

  it('releases reservations on rename and recovers reservations whose owner was deleted', async () => {
    const { firestore, records } = database();
    const saved = await create(firestore, '123');
    await create(firestore, '456', 'update', saved.id);
    await expect(create(firestore, '123')).resolves.toMatchObject({ dealerCode: '123' });
    records.delete(`users/${saved.id}`);
    await expect(create(firestore, '456')).resolves.toMatchObject({ dealerCode: '456' });
  });

  it('rejects absent/invalid/non-admin credentials before performing any user writes', async () => {
    await expect(saveAdminUser('', {})).rejects.toMatchObject({ status: 401 });
    sdk.verifyIdToken.mockRejectedValueOnce(new Error('expired'));
    await expect(saveAdminUser('Bearer bad', {})).rejects.toMatchObject({ status: 401 });
    sdk.verifyIdToken.mockResolvedValueOnce({ role: 'operator' });
    await expect(saveAdminUser('Bearer dealer', {})).rejects.toMatchObject({ status: 403 });
  });
});
