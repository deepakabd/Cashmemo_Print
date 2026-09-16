import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { loadAdminSnapshot, readAdminSnapshotCache } from '../src/services/adminDataRepository';
import { fetchAllAdminUsers } from '../src/services/adminUserRepository';
import { fetchFirestoreCollectionPageRest } from '../src/services/firestoreRest';
import AdminDataStatus from '../src/components/AdminDataStatus';

vi.mock('../src/services/adminUserRepository', () => ({
  fetchAllAdminUsers: vi.fn(), fetchAdminPendingUserApprovals: async () => [], mapAdminUserList: (user) => user,
}));
vi.mock('../src/services/firestoreRest', () => ({
  fetchFirestoreCollectionPageRest: vi.fn(), retryFirestoreRequest: (fn) => fn(),
}));

const cached = (id = 'cached', lastSyncAt = '2026-09-16T08:00:00Z') => ({
  version: 1, lastSyncAt, users: [{ id, status: 'active' }], requests: [], approvals: [], audit: [],
});
beforeEach(() => {
  fetchAllAdminUsers.mockReset().mockResolvedValue([{ id: 'live', status: 'active' }]);
  fetchFirestoreCollectionPageRest.mockReset().mockResolvedValue({ documents: [], nextPageToken: null });
});

describe('admin snapshot provenance', () => {
  it.each([true, false])('does not mark approvals-only success as live (cache available=%s)', async (hasCache) => {
    const previous = hasCache ? cached() : null;
    fetchAllAdminUsers.mockRejectedValue(new Error('users unavailable'));
    fetchFirestoreCollectionPageRest.mockImplementation(async (name) => {
      if (name !== 'updateApprovals') throw new Error(`${name} unavailable`);
      return { documents: [{ id: 'approval' }], nextPageToken: null };
    });
    const result = await loadAdminSnapshot(previous);
    expect(result.snapshot).toBe(previous);
    expect(result.health).toMatchObject({
      source: hasCache ? 'offline' : 'unavailable',
      lastSyncAt: previous?.lastSyncAt || '', firebaseReachable: false,
    });
    expect(result.health.error).toContain('users: users unavailable');
    expect(result.health.error).toContain('requests: registrationRequests unavailable');
    expect(localStorage.getItem('adminDataSnapshot')).toBeNull();
  });

  it('does not mark live users plus a failed audit read as a complete live snapshot', async () => {
    const previous = cached();
    fetchFirestoreCollectionPageRest.mockImplementation(async (name) => {
      if (name === 'adminAuditTrail') throw new Error('audit permission denied');
      return { documents: [], nextPageToken: null };
    });
    const result = await loadAdminSnapshot(previous);
    expect(result.snapshot.users).toEqual(previous.users);
    expect(result.health.source).toBe('offline');
    expect(result.health.error).toContain('audit: audit permission denied');
  });

  it('treats successful reads of entirely empty collections as live', async () => {
    fetchAllAdminUsers.mockResolvedValue([]);
    const result = await loadAdminSnapshot();
    expect(result.health).toMatchObject({ source: 'live', firebaseReachable: true, error: '' });
    expect(result.snapshot).toMatchObject({ users: [], requests: [], approvals: [], audit: [] });
  });

  it('publishes a complete live snapshot and records the successful sync timestamp', async () => {
    fetchFirestoreCollectionPageRest.mockImplementation(async (name) => ({
      documents: name === 'registrationRequests' ? [{ id: 'request', pin: '1234', confirmPin: '1234' }] : [],
      nextPageToken: null,
    }));
    const result = await loadAdminSnapshot();
    expect(result.health.source).toBe('live');
    expect(result.health.lastSyncAt).toBe(result.snapshot.lastSyncAt);
    const stored = JSON.parse(localStorage.getItem('adminDataSnapshot'));
    expect(stored.requests).toEqual([{ id: 'request' }]);
    expect(stored.users).toEqual([{ id: 'live', status: 'active' }]);
    expect(stored.lastSyncAt).toBe(result.health.lastSyncAt);
  });

  it('does not publish partial reads or replace a newer in-memory snapshot with older disk data', async () => {
    localStorage.setItem('adminDataSnapshot', JSON.stringify(cached('old')));
    const previous = cached('newer', '2026-09-16T10:00:00Z');
    fetchFirestoreCollectionPageRest.mockImplementation(async (name) => {
      if (name === 'updateApprovals') throw new Error('permission denied');
      return { documents: [{ id: 'partial-live' }], nextPageToken: null };
    });
    const result = await loadAdminSnapshot(previous);
    expect(result.snapshot).toBe(previous);
    expect(result.health).toMatchObject({ source: 'offline', lastSyncAt: previous.lastSyncAt, firebaseReachable: false });
    expect(result.health.error).toContain('approvals: permission denied');
    expect(JSON.parse(localStorage.getItem('adminDataSnapshot')).users[0].id).toBe('old');
  });

  it('uses the cache timestamp on failure and returns to live after recovery, including empty collections', async () => {
    localStorage.setItem('adminDataSnapshot', JSON.stringify(cached()));
    fetchAllAdminUsers.mockRejectedValueOnce(new Error('offline'));
    const offline = await loadAdminSnapshot();
    expect(offline.health).toMatchObject({ source: 'offline', lastSyncAt: cached().lastSyncAt });
    fetchAllAdminUsers.mockResolvedValue([]);
    const live = await loadAdminSnapshot(offline.snapshot);
    expect(live.health.source).toBe('live');
    expect(live.snapshot.users).toEqual([]);
    expect(live.snapshot.audit).toEqual([]);
    expect(live.health.lastSyncAt).not.toBe(cached().lastSyncAt);
  });

  it('labels legacy cache sync time as unknown and reports unavailable without a cache', async () => {
    fetchAllAdminUsers.mockRejectedValue(new Error('offline'));
    expect((await loadAdminSnapshot()).health.source).toBe('unavailable');
    localStorage.setItem('usersData', JSON.stringify([{ id: 'legacy', pin: '1234' }]));
    const result = await loadAdminSnapshot();
    expect(result.health).toMatchObject({ source: 'offline', lastSyncAt: '' });
    expect(result.snapshot.users).toEqual([{ id: 'legacy' }]);
    render(<AdminDataStatus health={result.health} />);
    expect(screen.getByText('OFFLINE CACHE')).toBeTruthy();
    expect(screen.getByText('LAST SYNC: Unknown')).toBeTruthy();
    expect(screen.getByText(/Admin changes are disabled/)).toBeTruthy();
  });

  it('does not mislabel successful Firebase reads when storage is full', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    expect((await loadAdminSnapshot()).health.source).toBe('live');
  });

  it('follows continuation pages for requests and approvals', async () => {
    fetchFirestoreCollectionPageRest.mockImplementation(async (name, size, options) => ({
      documents: [{ id: `${name}-${options.pageToken || 'first'}` }],
      nextPageToken: name === 'adminAuditTrail' || options.pageToken ? null : 'second',
    }));
    const result = await loadAdminSnapshot();
    expect(result.snapshot.requests).toHaveLength(2);
    expect(result.snapshot.approvals).toHaveLength(2);
    expect(readAdminSnapshotCache().requests).toHaveLength(2);
  });
});
