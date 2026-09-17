import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, writeBatch } from 'firebase/firestore';
import { updateUserData, readUserSubcollections, mergeUserDocWithSubcollections } from '../src/services/userSubcollections';

vi.mock('../src/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...parts) => parts.join('/'), getDoc: vi.fn(),
  serverTimestamp: () => 'timestamp', writeBatch: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());

describe('authoritative user configuration', () => {
  it('uses newer subdocument values, including cleared arrays/null, while retaining unmigrated fields', () => {
    expect(mergeUserDocWithSubcollections({ profileData: { name: 'old' }, ratesData: [1], bankDetailsData: { bank: 'old' },
      hindiHeaderData: { name: 'legacy' }, loginDevices: [] }, {
      profileData: { name: 'new' }, ratesData: [], bankDetailsData: null,
    })).toEqual({ profileData: { name: 'new' }, ratesData: [], bankDetailsData: null,
      hindiHeaderData: { name: 'legacy' }, loginDevices: [] });
  });

  it('reads only configuration, falling back only for missing documents', async () => {
    getDoc.mockImplementation(async (path) => ({ exists: () => path.endsWith('/rates/current'),
      data: () => ({ value: [] }), metadata: { fromCache: false } }));
    expect(await readUserSubcollections('u')).toEqual({ ratesData: [] });
    expect(getDoc).toHaveBeenCalledTimes(7);
    expect(getDoc.mock.calls.flat()).not.toContain('users/u/devices');
  });

  it('propagates permission/network failures and rejects cached reads instead of presenting stale data', async () => {
    getDoc.mockRejectedValue(new Error('permission-denied'));
    await expect(readUserSubcollections('u')).rejects.toThrow('permission-denied');
    getDoc.mockResolvedValue({ metadata: { fromCache: true }, exists: () => true, data: () => ({ value: 'old' }) });
    await expect(readUserSubcollections('u')).rejects.toThrow('could not be confirmed');
  });

  it('identifies the denied nested path and the rule fix while preserving the Firestore error code', async () => {
    getDoc.mockRejectedValue(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));
    await expect(readUserSubcollections('u')).rejects.toMatchObject({
      code: 'permission-denied', message: expect.stringContaining('users/u/profile/main'),
    });
    await expect(readUserSubcollections('u')).rejects.toThrow('Publish rules');
  });

  it('commits parent and complete replacement subdocuments atomically, including explicit clearing', async () => {
    const batch = { update: vi.fn(), set: vi.fn(), commit: vi.fn().mockResolvedValue() };
    writeBatch.mockReturnValue(batch);
    await updateUserData('u', { profileData: { name: 'new' }, ratesData: [], bankDetailsData: null });
    expect(batch.update).toHaveBeenCalledWith('users/u', {
      profileData: { name: 'new' }, ratesData: [], bankDetailsData: null, ratesDataCount: 0, updatedAt: 'timestamp',
    });
    expect(batch.set).toHaveBeenCalledWith('users/u/profile/main', { value: { name: 'new' }, updatedAt: 'timestamp' });
    expect(batch.set).toHaveBeenCalledWith('users/u/bank/details', { value: null, updatedAt: 'timestamp' });
    expect(batch.set).toHaveBeenCalledWith('users/u/rates/current', { value: [], updatedAt: 'timestamp' });
    expect(batch.commit).toHaveBeenCalledTimes(1);
    batch.commit.mockRejectedValue(new Error('commit denied'));
    await expect(updateUserData('u', { ratesData: [1] })).rejects.toThrow('commit denied');
  });

  it('rejects unsupported configuration transforms before committing', async () => {
    const batch = { update: vi.fn(), set: vi.fn(), commit: vi.fn() };
    writeBatch.mockReturnValue(batch);
    await expect(updateUserData('u', { ratesData: { isEqual: () => true } })).rejects.toThrow('complete ratesData');
    expect(batch.commit).not.toHaveBeenCalled();
  });
});
