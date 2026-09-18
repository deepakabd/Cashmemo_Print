import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { patchAdminUser, deleteAdminUser, completeAdminDictionaryRequest, saveAdminApprovalReply } from '../src/services/adminUserRepository';
const auth = vi.hoisted(() => ({ authStateReady: vi.fn(), currentUser: null }));
vi.mock('../src/firebase', () => ({ auth, db: {} }));
vi.mock('../src/services/userSubcollections', () => ({ readUserSubcollections: vi.fn(), mergeUserDocWithSubcollections: vi.fn() }));

beforeEach(() => {
  auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('admin-token') };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'u' }) }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it.each([{ status: 'disabled' }, { dealerCode: '456' }, { mobile: '9876543210' },
  { ratesData: [{ rate: 10 }], 'pendingUpdates.rates.status': 'approved' }])('routes partial update %j through the authenticated API', async (patch) => {
  expect(await patchAdminUser('u', { ...patch, updatedAt: { clientTransform: true } })).toEqual({ id: 'u' });
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/admin-users', expect.objectContaining({
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
  }));
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ mode: 'update', userId: 'u', data: patch });
});

it('uses the same API for deletion, replies and dictionary completion', async () => {
  await deleteAdminUser('u');
  await saveAdminApprovalReply({ userId: 'u', approvalDocId: 'a', type: 'profile', message: 'Fix GST' });
  await completeAdminDictionaryRequest('u', 'a', { id: 'a' }, 'approved');
  expect(fetch.mock.calls.map(([, request]) => JSON.parse(request.body).mode)).toEqual(['delete', 'reply', 'completeDictionary']);
});

it('propagates server validation errors without a Firestore fallback', async () => {
  fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Invalid package.', code: 'invalid-input' }) });
  await expect(patchAdminUser('u', { package: 'unknown' })).rejects.toMatchObject({ message: 'Invalid package.', code: 'invalid-input' });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('rejects missing authentication before issuing a mutation', async () => {
  auth.currentUser = null;
  await expect(patchAdminUser('u', { status: 'active' })).rejects.toThrow('Admin sign-in required.');
  expect(fetch).not.toHaveBeenCalled();
});
