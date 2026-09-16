import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllAdminUsers, fetchAdminUserDetail, fetchAdminPendingUserApprovals, getAdminUserStatistics } from '../src/services/adminUserRepository';
import { fetchFirestoreCollectionPageRest, fetchFirestoreDocumentRest } from '../src/services/firestoreRest';
import { getDoc } from 'firebase/firestore';

vi.mock('../src/firebase', () => ({ auth: {}, db: {} }));
vi.mock('../src/services/userSubcollections', () => ({ mirrorUserPatchToSubcollections: () => [] }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, collection, id) => ({ id })), getDoc: vi.fn(),
  deleteDoc: vi.fn(), updateDoc: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(),
}));
vi.mock('../src/services/firestoreRest', async (importOriginal) => ({
  ...await importOriginal(),
  fetchFirestoreCollectionPageRest: vi.fn(),
  fetchFirestoreDocumentRest: vi.fn(),
}));

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe('complete admin user repository', () => {
  it('projects list reads on every page and never returns heavy details or credentials', async () => {
    fetchFirestoreCollectionPageRest.mockResolvedValueOnce({ documents: [{
      id: 'projected', status: 'active', pin: 'secret', pinHash: 'hash', confirmPin: 'secret',
      ratesData: [{ rate: 10 }], loginDevices: [{ deviceId: 'device' }],
      profileData: { distributorName: 'Dealer', photoDataUrl: 'large-image' },
      pendingUpdates: { rates: { status: 'pending', payload: [{ rate: 20 }] } },
    }], nextPageToken: null });
    const [user] = await fetchAllAdminUsers();
    expect(user.profileData).toEqual({ distributorName: 'Dealer' });
    expect(user.pendingUpdates).toEqual({ rates: { status: 'pending' } });
    for (const field of ['ratesData', 'loginDevices', 'pin', 'pinHash', 'confirmPin']) expect(user).not.toHaveProperty(field);
    const fields = fetchFirestoreCollectionPageRest.mock.calls[0][2].fieldPaths;
    expect(fields).toContain('dealerCode');
    expect(fields).toContain('pendingUpdates.rates.status');
    expect(fields).not.toContain('ratesData');
    expect(fields).not.toContain('profileData');
  });

  it('maps REST and SDK detail reads identically and preserves complete nested data', async () => {
    const data = { id: 'detail', status: 'active', profileData: { distributorName: 'Dealer', photoDataUrl: 'image' },
      bankDetailsData: { bankName: 'Bank', accountNo: '123' }, ratesData: [{ rate: 10 }],
      loginDevices: [{ deviceId: 'device' }], pendingUpdates: { rates: { status: 'pending', payload: [{ rate: 20 }] } },
      pin: 'secret', pinHash: 'hash', approved: true,
    };
    fetchFirestoreDocumentRest.mockResolvedValueOnce(data);
    const rest = await fetchAdminUserDetail('detail');
    expect(rest.profileData).toEqual(data.profileData);
    expect(rest.ratesData).toEqual(data.ratesData);
    expect(rest.pendingUpdates).toEqual(data.pendingUpdates);
    expect(rest).not.toHaveProperty('pin');
    expect(rest).not.toHaveProperty('pinHash');
    expect(rest).not.toHaveProperty('approved');
    vi.useFakeTimers();
    fetchFirestoreDocumentRest.mockRejectedValue(new Error('REST unavailable'));
    getDoc.mockResolvedValue({ id: 'detail', data: () => data, exists: () => true, metadata: { fromCache: false } });
    const fallback = fetchAdminUserDetail('detail');
    await vi.advanceTimersByTimeAsync(1500);
    expect(await fallback).toEqual(rest);
  });

  it('loads approval payloads only for pending users, using a dedicated document mask', async () => {
    fetchFirestoreDocumentRest.mockResolvedValueOnce({ pendingUpdates: {
      rates: { status: 'pending', payload: [{ rate: 20 }] }, profile: { status: 'approved' },
    } });
    const result = await fetchAdminPendingUserApprovals([
      { id: 'pending', dealerCode: '123', pendingUpdates: { rates: { status: 'pending' } } },
      { id: 'complete', dealerCode: '456', pendingUpdates: { profile: { status: 'approved' } } },
    ]);
    expect(result).toMatchObject([{ userId: 'pending', source: 'userDoc', type: 'rates', payload: [{ rate: 20 }] }]);
    expect(fetchFirestoreDocumentRest).toHaveBeenCalledTimes(1);
    expect(fetchFirestoreDocumentRest).toHaveBeenCalledWith('users', 'pending', {
      fieldPaths: ['pendingUpdates', 'pendingDictionaryRequests'],
    });
  });

  it('includes users beyond 200, missing dealer codes, and cross-page duplicates in statistics', async () => {
    const firstPage = Array.from({ length: 200 }, (_, i) => ({
      id: `user-${i}`, dealerCode: `${i}`, status: 'active', package: 'premium',
    }));
    fetchFirestoreCollectionPageRest
      .mockResolvedValueOnce({ documents: firstPage, nextPageToken: 'next +/page' })
      .mockResolvedValueOnce({ documents: [
        { id: 'blocked', dealerCode: '199', status: 'disabled', package: 'enterprise', pin: 'secret' },
        { id: 'missing-code', status: 'expired', package: 'premium' },
      ], nextPageToken: null });
    const users = await fetchAllAdminUsers();
    expect(users).toHaveLength(202);
    expect(users.filter((user) => user.dealerCode === '199')).toHaveLength(2);
    expect(users.find((user) => user.id === 'blocked')).not.toHaveProperty('pin');
    expect(fetchFirestoreCollectionPageRest).toHaveBeenNthCalledWith(2, 'users', 200,
      expect.objectContaining({ pageToken: 'next +/page', fieldPaths: expect.any(Array) }));
    expect(getAdminUserStatistics(users)).toEqual({
      total: 202, byStatus: { active: 200, disabled: 1, expired: 1 },
      byPackage: { premium: 201, enterprise: 1 },
    });
  });

  it('rejects a failed later page instead of returning partial users', async () => {
    vi.useFakeTimers();
    const failure = new Error('second page unavailable');
    fetchFirestoreCollectionPageRest
      .mockResolvedValueOnce({ documents: [{ id: 'first' }], nextPageToken: 'next' })
      .mockRejectedValue(failure);
    const result = expect(fetchAllAdminUsers()).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(1500);
    await result;
    expect(fetchFirestoreCollectionPageRest).toHaveBeenCalledTimes(4);
  });

  it('continues through an empty page with a continuation token', async () => {
    fetchFirestoreCollectionPageRest
      .mockResolvedValueOnce({ documents: [], nextPageToken: 'next' })
      .mockResolvedValueOnce({ documents: [{ id: 'last' }], nextPageToken: null });
    await expect(fetchAllAdminUsers()).resolves.toMatchObject([{ id: 'last' }]);
  });
});
