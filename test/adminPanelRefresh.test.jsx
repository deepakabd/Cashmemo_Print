import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminPanel } from '../src/App';
import { loadAdminSnapshot } from '../src/services/adminDataRepository';

vi.mock('../src/firebase', () => ({ auth: { currentUser: { email: 'admin@example.com' } }, db: {} }));
vi.mock('../src/services/adminDataRepository', () => ({ loadAdminSnapshot: vi.fn() }));

const live = () => ({ snapshot: { version: 1, lastSyncAt: '2026-09-18T00:00:00Z',
  requests: [{ id: 'request', dealerCode: '123', dealerName: 'Refresh Agency', package: 'Premium Package - 30 Days', status: 'pending' }],
  users: [], approvals: [], audit: [],
}, health: { source: 'live', lastSyncAt: '2026-09-18T00:00:00Z', firebaseReachable: true, error: '' } });

function Parent() {
  const [revision, setRevision] = useState(0);
  const [dictionary, setDictionary] = useState({});
  return <>
    <button onClick={() => setRevision((value) => value + 1)}>Parent update {revision}</button>
    <button onClick={() => setDictionary({ Milk: 'दूध' })}>Dictionary update</button>
    <AdminPanel announcements={[]} announcementDraft={{}} announcementDraftRef={{ current: {} }}
      translationDictionary={dictionary} setTranslationDictionary={setDictionary}
      translationObservability={{ apiCount: 0, dictionaryCount: 0, transliterationCount: 0, queuedCount: 0 }}
      confirmAdminActionWithDialog={() => Promise.resolve(true)} readRecentActivitiesForDealer={() => []}
      pushToast={() => setRevision((value) => value + 1)} />
  </>;
}

beforeEach(() => {
  localStorage.setItem('activeAdminTab', JSON.stringify('pending-registration'));
  loadAdminSnapshot.mockReset().mockResolvedValue(live());
});

it('preserves the admin screen, search and loaded data across parent and dictionary updates', async () => {
  render(<Parent />);
  await screen.findByText('LIVE FIREBASE');
  const search = screen.getByPlaceholderText('Search current tab...');
  fireEvent.change(search, { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Parent update 0' }));
  fireEvent.click(screen.getByRole('button', { name: 'Dictionary update' }));
  expect(screen.getByPlaceholderText('Search current tab...')).toBe(search);
  expect(search.value).toBe('123');
  expect(screen.getByText('Refresh Agency')).toBeTruthy();
  expect(loadAdminSnapshot).toHaveBeenCalledTimes(1);
});

it('shares one refresh request while parent updates keep the panel mounted', async () => {
  render(<Parent />);
  await screen.findByText('LIVE FIREBASE');
  let complete;
  loadAdminSnapshot.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh Data' }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh Data' }));
  fireEvent.click(screen.getByRole('button', { name: 'Parent update 0' }));
  expect(loadAdminSnapshot).toHaveBeenCalledTimes(2);
  await act(async () => { complete(live()); });
  await waitFor(() => expect(screen.getByText('LIVE FIREBASE')).toBeTruthy());
  expect(loadAdminSnapshot).toHaveBeenCalledTimes(2);
});
