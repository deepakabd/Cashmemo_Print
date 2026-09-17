import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AdminPage from '../src/AdminPage';
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
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('renders counters and rows from all repository pages using canonical status despite contradictory legacy flags', async () => {
  fetchFirestoreCollectionPageRest
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
  render(<AdminPage />);
  expect(await screen.findByText('Total Users: 205')).toBeTruthy();
  for (const label of ['Active Users: 201', 'Blocked Users: 1', 'Expired Users: 1', 'Pending Accounts: 2']) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  expect(screen.getByText('41012345')).toBeTruthy();
  expect(screen.getAllByRole('row')).toHaveLength(206);
  expect(fetchFirestoreCollectionPageRest).toHaveBeenNthCalledWith(2, 'users', 200,
    expect.objectContaining({ pageToken: 'second' }));
});
