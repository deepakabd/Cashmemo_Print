import { afterEach, expect, it, vi } from 'vitest';
import { updateDoc } from 'firebase/firestore';
import { registerLoginDevice, markUserExpiredIfDue } from '../src/auth/userAuth';

vi.mock('../src/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...path) => path.join('/'), updateDoc: vi.fn(),
  collection: vi.fn(), getDocs: vi.fn(), query: vi.fn(), where: vi.fn(), serverTimestamp: () => 'timestamp',
}));
vi.mock('../src/services/userSubcollections', () => ({
  mergeUserDocWithSubcollections: vi.fn(), readUserSubcollections: vi.fn(),
}));
vi.mock('../src/utils/adminUiHelpers', () => ({
  getCurrentDeviceInfo: async () => ({ deviceId: 'current' }),
  normalizeLoginDevices: (devices) => devices || [],
  upsertLoginDevice: (devices, device) => [...devices, device],
}));
afterEach(() => vi.resetAllMocks());

it('reports an expiry write failure without changing the runtime status', async () => {
  updateDoc.mockRejectedValue(Object.assign(new Error('Denied'), { code: 'permission-denied' }));
  const user = { id: 'u', status: 'active', validTill: '2000-01-01' };
  expect(await markUserExpiredIfDue(user)).toEqual({ ok: false, changed: false, reason: 'permission-denied' });
  expect(user.status).toBe('active');
});

it('changes runtime expiry status only after Firestore confirms the write', async () => {
  let confirmWrite;
  updateDoc.mockImplementation(() => new Promise((resolve) => { confirmWrite = resolve; }));
  const user = { id: 'u', status: 'active', validTill: '2000-01-01' };
  const pending = markUserExpiredIfDue(user);
  expect(user.status).toBe('active');
  expect(updateDoc).toHaveBeenCalledWith('users/u', { status: 'expired', updatedAt: 'timestamp' });
  confirmWrite();
  expect(await pending).toEqual({ ok: true, changed: true });
  expect(user.status).toBe('expired');
});

it('skips expiry writes for valid, pending and disabled accounts', async () => {
  for (const user of [
    { status: 'active', validTill: '2999-01-01' },
    { status: 'pending', validTill: '2000-01-01' },
    { status: 'disabled', validTill: '2000-01-01' },
  ]) {
    expect(await markUserExpiredIfDue(user)).toEqual({ ok: true, changed: false, reason: 'not-expired' });
  }
  expect(updateDoc).not.toHaveBeenCalled();
});

it('keeps device history unchanged and reports failure when the authoritative write fails', async () => {
  const error = new Error('permission-denied');
  updateDoc.mockRejectedValue(error);
  const user = { id: 'u', loginDevices: [{ deviceId: 'previous' }] };
  expect(await registerLoginDevice(user)).toEqual({ outcome: 'save-failed', error });
  expect(user.loginDevices).toEqual([{ deviceId: 'previous' }]);
});

it('publishes new device history only after the single authoritative write is confirmed', async () => {
  let confirmWrite;
  updateDoc.mockImplementation(() => new Promise((resolve) => { confirmWrite = resolve; }));
  const user = { id: 'u', loginDevices: [] };
  const pending = registerLoginDevice(user);
  await vi.waitFor(() => expect(updateDoc).toHaveBeenCalledOnce());
  expect(user.loginDevices).toEqual([]);
  expect(updateDoc).toHaveBeenCalledWith('users/u', expect.objectContaining({ loginDevices: [{ deviceId: 'current' }] }));
  confirmWrite();
  expect(await pending).toEqual({ outcome: 'ok', loginDevices: [{ deviceId: 'current' }] });
  expect(user.loginDevices).toEqual([{ deviceId: 'current' }]);
});

it('does not write a blocked device', async () => {
  expect(await registerLoginDevice({ id: 'u', loginDevices: [{ deviceId: 'current', blocked: true }] }))
    .toEqual({ outcome: 'blocked' });
  expect(updateDoc).not.toHaveBeenCalled();
});

it('checks blocking before deferring the device write until after login', async () => {
  const user = { id: 'u', loginDevices: [] };
  const result = await registerLoginDevice(user, { deferSave: true });
  expect(result.outcome).toBe('ready');
  expect(updateDoc).not.toHaveBeenCalled();
  expect(user.loginDevices).toEqual([]);
  updateDoc.mockResolvedValue();
  expect(await result.save()).toMatchObject({ outcome: 'ok' });
  expect(updateDoc).toHaveBeenCalledOnce();
  expect(await registerLoginDevice({ id: 'u', loginDevices: [{ deviceId: 'current', blocked: true }] }, { deferSave: true }))
    .toEqual({ outcome: 'blocked' });
  expect(updateDoc).toHaveBeenCalledOnce();
});
