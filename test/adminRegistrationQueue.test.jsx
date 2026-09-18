import { expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAdminData } from '../src/hooks/useAdminData';

const pendingIds = (requests) => requests.filter((request) => (request.status || 'pending') === 'pending').map((request) => request.id);

it.each(['approved', 'rejected'])('removes a confirmed %s request and keeps it removed through stale or failed refreshes', (status) => {
  const { result } = renderHook(() => useAdminData());
  const stale = [{ id: 'done', status: 'pending' }, { id: 'other', status: 'pending' }];
  act(() => result.current.setRequests(stale));
  act(() => result.current.completeRegistrationRequest('done', status));
  expect(pendingIds(result.current.requests)).toEqual(['other']);
  for (const live of [false, true]) {
    act(() => result.current.setRequests(result.current.reconcileRegistrationRequests(stale, live)));
    expect(pendingIds(result.current.requests)).toEqual(['other']);
    expect(result.current.requests[0].status).toBe(status);
  }
  act(() => result.current.setRequests(result.current.reconcileRegistrationRequests([
    { id: 'done', status }, { id: 'other', status: 'pending' },
  ], true)));
  expect(pendingIds(result.current.requests)).toEqual(['other']);
});

it('retains multiple confirmed bulk actions without losing earlier completions', () => {
  const { result } = renderHook(() => useAdminData());
  const stale = [{ id: 'one' }, { id: 'two' }, { id: 'other' }];
  act(() => result.current.setRequests(stale));
  act(() => {
    result.current.completeRegistrationRequest('one', 'approved');
    result.current.completeRegistrationRequest('two', 'rejected');
  });
  expect(pendingIds(result.current.requests)).toEqual(['other']);
  expect(result.current.reconcileRegistrationRequests(stale, true).map((request) => request.status))
    .toEqual(['approved', 'rejected', undefined]);
});

it('does not hide pending requests using obsolete browser-only status overrides', () => {
  localStorage.setItem('registrationStatusOverrides', JSON.stringify({ request: 'rejected' }));
  const { result } = renderHook(() => useAdminData());
  act(() => result.current.setRequests(result.current.reconcileRegistrationRequests([{ id: 'request', status: 'pending' }], true)));
  expect(pendingIds(result.current.requests)).toEqual(['request']);
});
