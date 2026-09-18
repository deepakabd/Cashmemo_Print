import { afterEach, expect, it, vi } from 'vitest';
import { loadAdminSnapshot } from '../src/services/adminDataRepository';
import { getAdminUserStatistics } from '../src/services/adminUserRepository';
import { fetchFirestoreCollectionPageRest } from '../src/services/firestoreRest';

vi.mock('../src/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/firestore', () => ({
  deleteDoc: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(),
}));
vi.mock('../src/services/userSubcollections', () => ({
  updateUserData: vi.fn(), readUserSubcollections: vi.fn(), mergeUserDocWithSubcollections: vi.fn(),
}));
vi.mock('../src/services/firestoreRest', () => ({
  fetchFirestoreCollectionPageRest: vi.fn(), fetchFirestoreDocumentRest: vi.fn(), retryFirestoreRequest: (fn) => fn(),
}));
afterEach(() => { vi.resetAllMocks(); localStorage.clear(); });

it('loads all users into the production snapshot and computes canonical counters despite contradictory legacy flags', async () => {
  const usersPage = vi.fn()
    .mockResolvedValueOnce({ documents: Array.from({ length: 200 }, (_, index) => ({
      id: `u-${index}`, dealerCode: `${index}`, status: 'active', approved: false, blocked: true,
    })), nextPageToken: 'second' })
    .mockResolvedValueOnce({ documents: [
      { id: 'tail-active', dealerCode: '41012345', status: 'active', approved: false },
      { id: 'tail-disabled', status: 'disabled', active: true },
      { id: 'tail-expired', status: 'expired', active: true },
      { id: 'tail-pending', status: 'pending', active: true },
      { id: 'tail-legacy', approved: true, active: true },
    ], nextPageToken: null });
  fetchFirestoreCollectionPageRest.mockImplementation((name, size, options) => name === 'users'
    ? usersPage(name, size, options) : Promise.resolve({ documents: [], nextPageToken: null }));
  const { snapshot, health } = await loadAdminSnapshot();
  expect(health.source).toBe('live');
  expect(snapshot.users).toHaveLength(205);
  expect(getAdminUserStatistics(snapshot.users)).toMatchObject({ total: 205,
    byStatus: { active: 201, disabled: 1, expired: 1, pending: 2 } });
  expect(snapshot.users).toContainEqual(expect.objectContaining({ dealerCode: '41012345' }));
  expect(usersPage).toHaveBeenNthCalledWith(2, 'users', 200,
    expect.objectContaining({ pageToken: 'second' }));
});
