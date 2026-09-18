import { describe, expect, it, vi } from 'vitest';
import { saveAdminUserTransaction, saveAdminUser } from '../server/adminUsers.js';
import { hashPin, verifyPin } from '../server/pinCredentials.js';
import { rejectAdminRegistrationTransaction } from '../server/adminUserWorkflows.js';

const sdk = vi.hoisted(() => ({ verifyIdToken: vi.fn(), firestore: null }));
vi.mock('../server/loginService.js', async (original) => ({
  ...await original(), getAdmin: async () => ({ auth: sdk, firestore: sdk.firestore }),
}));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'timestamp' } }));

// Optimistic transaction harness: concurrent writes to a read document retry
// the callback and only successful commits publish their staged writes.
const database = (initial = {}, failCommitFor = '') => {
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
        update: (target, data) => writes.push({ target, data, update: true }),
        delete: (target) => writes.push({ target, remove: true }),
      };
      const result = await callback(tx);
      if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) continue;
      if (failCommitFor && writes.some(({ target }) => target.path.startsWith(failCommitFor))) {
        throw new Error('Commit failed');
      }
      for (const { target, data, options, remove, update } of writes) {
        if (remove) records.delete(target.path);
        else if (update) {
          if (!records.has(target.path)) throw new Error('Missing update target');
          const next = structuredClone(records.get(target.path));
          for (const [field, value] of Object.entries(data)) {
            const keys = field.split('.');
            let parent = next;
            for (const key of keys.slice(0, -1)) parent = parent[key] ??= {};
            parent[keys.at(-1)] = value;
          }
          records.set(target.path, next);
        }
        else records.set(target.path, options?.merge || options?.mergeFields ? { ...records.get(target.path), ...data } : data);
        versions.set(target.path, (versions.get(target.path) || 0) + 1);
      }
      return result;
    }
    throw new Error('Transaction retry limit exceeded');
  } };
  return { firestore, records };
};
const create = (firestore, code, mode = 'create', userId) => saveAdminUserTransaction(firestore,
  { mode, userId, ...(mode === 'approve' ? { requestId: 'request' } : {}),
    data: { dealerCode: code, dealerName: 'Test', status: 'active' } }, 'timestamp');

describe('server dealer code uniqueness', () => {
  it('hashes raw API PINs and preserves credentials for blank edit PINs', async () => {
    const { firestore, records } = database();
    const result = await saveAdminUserTransaction(firestore, { data: { dealerCode: '123', pin: '123456', pinHash: null } }, 'timestamp');
    const stored = records.get(`users/${result.id}`);
    expect(stored.pin).toBeNull();
    expect(await verifyPin('123456', stored.pinHash)).toMatchObject({ matches: true, legacy: false });
    await saveAdminUserTransaction(firestore, { mode: 'update', userId: result.id, data: { pin: '', pinHash: null } }, 'later');
    expect(records.get(`users/${result.id}`).pinHash).toBe(stored.pinHash);
    expect(JSON.stringify(result)).not.toContain('123456');
  });

  it.each(['hash', 'legacy'])('approves using stored registration credentials (%s)', async (format) => {
    const credentials = format === 'hash' ? { pinHash: await hashPin('654321'), pin: null } : { pin: '654321' };
    const { firestore, records } = database({ 'registrationRequests/request': { dealerCode: '123', status: 'pending', ...credentials } });
    const result = await create(firestore, '123', 'approve');
    for (const path of [`users/${result.id}`, 'registrationRequests/request']) {
      expect(records.get(path).pin).toBeNull();
      expect(await verifyPin('654321', records.get(path).pinHash)).toMatchObject({ matches: true, legacy: false });
    }
  });

  it.each(['req-real', 'legacy-real'])('rejects a real registration %s atomically with one audit, and replays safely', async (requestId) => {
    const { firestore, records } = database({ [`registrationRequests/${requestId}`]: { dealerCode: '123', status: 'pending' } });
    await rejectAdminRegistrationTransaction(firestore, requestId, 'timestamp', 'admin');
    expect(records.get(`registrationRequests/${requestId}`)).toMatchObject({ status: 'rejected', rejectedBy: 'admin', rejectedAt: 'timestamp' });
    const before = [...records.entries()];
    expect(await rejectAdminRegistrationTransaction(firestore, requestId, 'later')).toMatchObject({ alreadyRejected: true });
    expect([...records.entries()]).toEqual(before);
    expect([...records.keys()].filter((path) => path.startsWith('adminAuditTrail/'))).toHaveLength(1);
  });

  it.each([{}, { 'registrationRequests/request': { status: 'approved' } }])('refuses missing or already approved registrations without changing data', async (initial) => {
    const { firestore, records } = database(initial);
    await expect(rejectAdminRegistrationTransaction(firestore, 'request', 'timestamp')).rejects.toBeInstanceOf(Error);
    expect([...records.entries()]).toEqual(Object.entries(initial));
  });

  it('rolls back rejection when its audit cannot commit', async () => {
    const initial = { 'registrationRequests/request': { status: 'pending' } };
    const { firestore, records } = database(initial, 'adminAuditTrail/');
    await expect(rejectAdminRegistrationTransaction(firestore, 'request', 'timestamp')).rejects.toThrow('Commit failed');
    expect([...records.entries()]).toEqual(Object.entries(initial));
  });

  it('allows only one terminal action when approve and reject race', async () => {
    const { firestore, records } = database({ 'registrationRequests/request': { dealerCode: '123', status: 'pending' } });
    const results = await Promise.allSettled([
      create(firestore, '123', 'approve'), rejectAdminRegistrationTransaction(firestore, 'request', 'timestamp'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const status = records.get('registrationRequests/request').status;
    expect(['approved', 'rejected']).toContain(status);
    expect([...records.keys()].filter((path) => path.startsWith('users/'))).toHaveLength(status === 'approved' ? 1 : 0);
  });

  it.each([['Demo Package - 1 Day', 1], ['Basic Package - 7 Days', 7]])('approves stored legacy package %s with its correct validity', async (packageName, days) => {
    const { firestore, records } = database({ 'registrationRequests/request': { dealerCode: '123', status: 'pending', package: packageName } });
    const saved = await saveAdminUserTransaction(firestore, { mode: 'approve', requestId: 'request',
      data: { dealerCode: '123', package: packageName, packageDays: 0 } }, 'timestamp');
    expect(records.get('registrationRequests/request').status).toBe('approved');
    expect(records.get(`users/${saved.id}`).packageDays).toBe(days);
    expect(new Date(records.get(`users/${saved.id}`).validTill).getTime()).toBeGreaterThan(Date.now());
  });

  it('does not allow legacy package exceptions for new users or an unrelated registration package', async () => {
    const { firestore, records } = database({ 'registrationRequests/request': { dealerCode: '123', package: 'Premium Package - 30 Days' } });
    for (const mode of ['create', 'approve']) {
      await expect(saveAdminUserTransaction(firestore, { mode, requestId: 'request',
        data: { dealerCode: '123', package: 'Demo Package - 1 Day' } }, 'timestamp'))
        .rejects.toMatchObject({ code: 'invalid-input' });
    }
    expect(records.size).toBe(1);
  });

  it('updates partial fields and dotted approval status while preserving the dealer code and singleton copies', async () => {
    const { firestore, records } = database({ 'users/a': { dealerCode: '123', status: 'active',
      pendingUpdates: { rates: { status: 'pending', payload: [{ rate: 10 }] } } } });
    await saveAdminUserTransaction(firestore, { mode: 'update', userId: 'a', data: {
      ratesData: [{ rate: 20 }], 'pendingUpdates.rates.status': 'approved', mobile: '9876543210',
    } }, 'timestamp');
    expect(records.get('users/a')).toMatchObject({ dealerCode: '123', mobile: '9876543210', ratesDataCount: 1,
      pendingUpdates: { rates: { status: 'approved', payload: [{ rate: 10 }] } } });
    expect(records.get('users/a/rates/current')).toEqual({ value: [{ rate: 20 }], updatedAt: 'timestamp' });
  });

  it.each([{ mobile: '123' }, { package: 'unknown' }, { status: 'unknown' }, { ratesData: {} }, { 'dealerCode.value': '456' }])('rejects invalid partial data %j before any writes', async (data) => {
      const { firestore, records } = database({ 'users/a': { dealerCode: '123' } });
      await expect(saveAdminUserTransaction(firestore, { mode: 'update', userId: 'a', data }, 'timestamp'))
        .rejects.toMatchObject({ status: 400, code: 'invalid-input' });
      expect([...records.entries()]).toEqual([['users/a', { dealerCode: '123' }]]);
    });

  it('refuses partial patches to missing users', async () => {
    const { firestore, records } = database();
    await expect(saveAdminUserTransaction(firestore, { mode: 'update', userId: 'missing', data: { status: 'active' } }, 'timestamp'))
      .rejects.toMatchObject({ status: 404, code: 'user-not-found' });
    expect(records.size).toBe(0);
  });

  it('publishes neither parent nor singleton changes when a partial update cannot commit', async () => {
    const before = { 'users/a': { dealerCode: '123', ratesData: [{ rate: 10 }] },
      'users/a/rates/current': { value: [{ rate: 10 }] } };
    const { firestore, records } = database(before, 'users/a/rates/');
    await expect(saveAdminUserTransaction(firestore, { mode: 'update', userId: 'a', data: { ratesData: [{ rate: 20 }] } }, 'timestamp'))
      .rejects.toThrow('Commit failed');
    expect([...records.entries()]).toEqual(Object.entries(before));
  });

  it('dispatches an authenticated deletion through the server transaction', async () => {
    const { firestore, records } = database({ 'users/a': { dealerCode: '123' } });
    sdk.firestore = firestore;
    sdk.verifyIdToken.mockResolvedValueOnce({ role: 'admin', uid: 'admin' });
    expect(await saveAdminUser('Bearer admin', { mode: 'delete', userId: 'a' })).toEqual({ id: 'a' });
    expect(records.has('users/a')).toBe(false);
  });

  it.each(['delete', 'reply', 'completeDictionary', 'rejectRegistration'])('requires an admin claim for workflow %s', async (mode) => {
    sdk.verifyIdToken.mockResolvedValueOnce({ role: 'operator' });
    await expect(saveAdminUser('Bearer dealer', { mode, userId: 'a' })).rejects.toMatchObject({ status: 403 });
  });

  it('dispatches authenticated registration rejection through the API service', async () => {
    const { firestore, records } = database({ 'registrationRequests/request': { status: 'pending' } });
    sdk.firestore = firestore;
    sdk.verifyIdToken.mockResolvedValueOnce({ role: 'admin', uid: 'admin' });
    expect(await saveAdminUser('Bearer admin', { mode: 'rejectRegistration', requestId: 'request' }))
      .toMatchObject({ status: 'rejected' });
    expect(records.get('registrationRequests/request').status).toBe('rejected');
  });

  it('commits activation, request completion and one audit together, and replays without rewriting the user', async () => {
    const { firestore, records } = database({
      'registrationRequests/request': { dealerCode: '123', status: 'pending' },
    });
    const first = await create(firestore, '123', 'approve');
    expect(records.get(`users/${first.id}`).status).toBe('active');
    expect(records.get('registrationRequests/request')).toMatchObject({
      status: 'approved', approvedUserId: first.id, approvedAt: 'timestamp', approvedBy: 'admin',
    });
    const before = [...records.entries()];
    expect(await saveAdminUserTransaction(firestore, { mode: 'approve', requestId: 'request',
      data: { dealerCode: '123', package: 'Enterprise Package - 365 Days', validTill: '2999-01-01' } }, 'later'))
      .toEqual({ id: first.id, dealerCode: '123', alreadyApproved: true });
    expect([...records.entries()]).toEqual(before);
    expect([...records.keys()].filter((path) => path.startsWith('adminAuditTrail/'))).toHaveLength(1);
  });

  it.each(['registrationRequests/', 'adminAuditTrail/'])('publishes no activation when the transaction cannot commit %s', async (failedPath) => {
    const initial = { 'registrationRequests/request': { dealerCode: '123', status: 'pending' },
      'users/old': { dealerCode: '123', status: 'pending' } };
    const { firestore, records } = database(initial, failedPath);
    await expect(create(firestore, '123', 'approve')).rejects.toThrow('Commit failed');
    expect([...records.entries()]).toEqual(Object.entries(initial));
  });

  it('serializes simultaneous approvals of the same request with one user and one audit', async () => {
    const { firestore, records } = database({ 'registrationRequests/request': { dealerCode: '123', status: 'pending' } });
    const results = await Promise.all([create(firestore, '123', 'approve'), create(firestore, '123', 'approve')]);
    expect(results[0].id).toBe(results[1].id);
    expect(results.filter((result) => result.alreadyApproved)).toHaveLength(1);
    expect([...records.keys()].filter((path) => /^users\/[^/]+$/.test(path))).toHaveLength(1);
    expect([...records.keys()].filter((path) => path.startsWith('adminAuditTrail/'))).toHaveLength(1);
  });

  it('refuses missing, rejected, mismatched or inconsistent previously approved requests without any writes', async () => {
    for (const request of [null, { dealerCode: '123', status: 'rejected' },
      { dealerCode: '456', status: 'pending' }, { dealerCode: '123', status: 'approved' },
      { dealerCode: '123', status: 'approved', approvedUserId: 'missing' }]) {
      const initial = request ? { 'registrationRequests/request': request } : {};
      const { firestore, records } = database(initial);
      await expect(create(firestore, '123', 'approve')).rejects.toBeInstanceOf(Error);
      expect([...records.entries()]).toEqual(Object.entries(initial));
    }
    await expect(saveAdminUserTransaction(database().firestore, { mode: 'approve', data: { dealerCode: '123' } }, 'timestamp'))
      .rejects.toMatchObject({ status: 400 });
  });

  it('updates server-owned configuration and its singleton in the same transaction', async () => {
    const { firestore, records } = database({ 'users/a': {
      dealerCode: '123', role: 'manager', profileData: { distributorName: 'Old', obsolete: true },
    }, 'users/a/profile/main': { value: { distributorName: 'Old' } } });
    await saveAdminUserTransaction(firestore, { mode: 'update', userId: 'a', data: {
      dealerCode: '123', profileData: { distributorName: 'Current' }, ratesData: [],
    } }, 'timestamp');
    expect(records.get('users/a')).toMatchObject({ role: 'manager',
      profileData: { distributorName: 'Current' }, ratesData: [], ratesDataCount: 0 });
    expect(records.get('users/a').profileData).not.toHaveProperty('obsolete');
    expect(records.get('users/a/profile/main')).toEqual({ value: { distributorName: 'Current' }, updatedAt: 'timestamp' });
    expect(records.get('users/a/rates/current')).toEqual({ value: [], updatedAt: 'timestamp' });
  });
  it('restores only supported account data, retaining a hash without reviving legacy access or workflows', async () => {
    const { firestore, records } = database();
    const pinHash = await hashPin('1234');
    await saveAdminUserTransaction(firestore, { mode: 'restore', userId: 'deleted', data: {
      dealerCode: '123', dealerName: 'Dealer', package: 'Premium Package - 30 Days', status: 'active',
      profileData: { distributorName: 'Dealer' }, ratesData: [{ rate: 10 }], pinHash,
      pin: '1234', confirmPin: '1234', approved: false, blocked: true, expired: true,
      authUid: 'old-auth', uid: 'old', loginDevices: [{ deviceId: 'old' }],
      pendingUpdates: { rates: { status: 'pending' } }, approvalStatus: { profile: 'pending' },
      pendingDictionaryRequests: [{ id: 'old' }], dictionaryPendingCount: 99,
      deletedAt: 'yesterday', deletedBy: 'admin', deleteReason: 'old', obsoleteSchemaField: 'old',
      createdAt: 'old', restoredBy: 'admin', restoreCount: 1,
    } }, 'timestamp');
    const restored = records.get('users/deleted');
    expect(restored).toEqual({ dealerCode: '123', dealerName: 'Dealer', package: 'Premium Package - 30 Days', status: 'active',
      profileData: { distributorName: 'Dealer' }, ratesData: [{ rate: 10 }], ratesDataCount: 1, pinHash, pin: null,
      role: 'operator', approvalStatus: {}, restoredBy: 'admin', restoreCount: 1,
      createdAt: 'timestamp', updatedAt: 'timestamp', approvedAt: 'timestamp', restoredAt: 'timestamp',
    });
    expect(records.get('users/deleted/profile/main')).toEqual({ value: { distributorName: 'Dealer' }, updatedAt: 'timestamp' });
    expect(records.get('users/deleted/rates/current')).toEqual({ value: [{ rate: 10 }], updatedAt: 'timestamp' });
    expect(records.get('users/deleted/bank/details')).toEqual({ value: null, updatedAt: 'timestamp' });
  });

  it('drops invalid credential hashes and refuses to overwrite a user that already exists', async () => {
    const { firestore, records } = database();
    await saveAdminUserTransaction(firestore, { mode: 'restore', userId: 'deleted',
      data: { dealerCode: '123', pinHash: 'plaintext' } }, 'timestamp');
    expect(records.get('users/deleted')).not.toHaveProperty('pinHash');
    const before = [...records.entries()];
    await expect(create(firestore, '123', 'restore', 'deleted')).rejects.toMatchObject({
      status: 409, code: 'user-already-exists',
    });
    expect([...records.entries()]).toEqual(before);
  });

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
    const { firestore, records } = database({ 'users/old': { dealerCode: '123', role: 'manager' },
      'registrationRequests/request': { dealerCode: '123', status: 'pending' } });
    expect(await create(firestore, '123', 'approve')).toMatchObject({ id: 'old' });
    expect(records.get('users/old')).toMatchObject({ status: 'active', role: 'manager' });
    expect([...records.keys()].filter((path) => path.startsWith('users/'))).toHaveLength(1);
  });

  it('rejects approval when legacy duplicates already exist', async () => {
    const { firestore, records } = database({ 'users/a': { dealerCode: '123' }, 'users/b': { dealerCode: '123' },
      'registrationRequests/request': { dealerCode: '123', status: 'pending' } });
    await expect(create(firestore, '123', 'approve')).rejects.toMatchObject({ status: 409 });
    expect(records.size).toBe(3);
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
