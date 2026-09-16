import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllAdminUsers, getAdminUserStatistics } from '../src/services/adminUserRepository';
import { fetchFirestoreCollectionPageRest } from '../src/services/firestoreRest';

vi.mock('../src/firebase', () => ({ auth: {} }));
vi.mock('../src/services/firestoreRest', async (importOriginal) => ({
  ...await importOriginal(),
  fetchFirestoreCollectionPageRest: vi.fn(),
}));

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe('complete admin user repository', () => {
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
    expect(fetchFirestoreCollectionPageRest).toHaveBeenNthCalledWith(2, 'users', 200, { pageToken: 'next +/page' });
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
    await expect(fetchAllAdminUsers()).resolves.toEqual([{ id: 'last' }]);
  });
});
