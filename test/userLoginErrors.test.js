import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { signInWithCustomToken } from 'firebase/auth';
import { getDoc, getDocs } from 'firebase/firestore';
import { lookupDealerByCode, buildPinWritePatch } from '../src/auth/userAuth';
import { readUserSubcollections } from '../src/services/userSubcollections';

vi.mock('../src/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signInWithCustomToken: vi.fn(), signInWithEmailAndPassword: vi.fn(), signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), query: vi.fn(), serverTimestamp: vi.fn(), updateDoc: vi.fn(), where: vi.fn() }));
vi.mock('../src/services/userSubcollections', () => ({ mergeUserDocWithSubcollections: (user, sub) => ({ ...user, ...sub }), readUserSubcollections: vi.fn() }));

const api = (body, ok = true) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }));
beforeEach(() => {
  vi.resetAllMocks();
  api({ token: 'custom-token', dealerCode: '123', userId: 'dealer-doc' });
  signInWithCustomToken.mockResolvedValue({ user: { getIdToken: vi.fn().mockResolvedValue('id-token') } });
  getDoc.mockResolvedValue({ id: 'dealer-doc', exists: () => true, metadata: { fromCache: false },
    data: () => ({ dealerCode: '123', pinHash: 'secret-hash', pin: null, status: 'active' }) });
  readUserSubcollections.mockResolvedValue({});
});
afterEach(() => vi.unstubAllGlobals());

it('authenticates before reading a user without an extra forced token refresh or anonymous query', async () => {
  let confirmSignIn;
  signInWithCustomToken.mockImplementation(() => new Promise((resolve) => { confirmSignIn = resolve; }));
  const pending = lookupDealerByCode('123', '1234');
  await vi.waitFor(() => expect(signInWithCustomToken).toHaveBeenCalled());
  expect(getDoc).not.toHaveBeenCalled();
  expect(getDocs).not.toHaveBeenCalled();
  const getIdToken = vi.fn().mockResolvedValue('fresh-token');
  confirmSignIn({ user: { getIdToken } });
  const result = await pending;
  expect(getIdToken).toHaveBeenCalledWith();
  expect(result.outcome).toBe('ok');
  expect(result.firestoreUser.id).toBe('dealer-doc');
  expect(result.firestoreUser.pin).toBeUndefined();
  expect(result.firestoreUser.pinHash).toBeUndefined();
  expect(fetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({ body: JSON.stringify({ dealerCode: '123', pin: '1234' }) }));
});

it.each([
  ['bad-credentials', 'not-found', 'not-found'], ['not-found', 'not-found', 'not-found'],
  ['pending', 'not-found', 'pending'], ['disabled', 'not-found', 'disabled'], ['duplicate', 'duplicate', undefined],
])('handles server rejection %s without reading Firestore', async (code, outcome, status) => {
  api({ code, error: 'Denied' }, false);
  const result = await lookupDealerByCode('123', '1234');
  expect(result.outcome).toBe(outcome);
  expect(result.dealerLookupStatus).toBe(status);
  expect(signInWithCustomToken).not.toHaveBeenCalled();
  expect(getDoc).not.toHaveBeenCalled();
  expect(getDocs).not.toHaveBeenCalled();
});

it('returns authoritative subdocument configuration', async () => {
  readUserSubcollections.mockResolvedValue({ profileData: { distributorName: 'Current' }, ratesData: [] });
  expect((await lookupDealerByCode('123', '1234')).firestoreUser).toMatchObject({
    profileData: { distributorName: 'Current' }, ratesData: [],
  });
});
it('propagates configuration and account read failures', async () => {
  readUserSubcollections.mockRejectedValue(new Error('configuration offline'));
  await expect(lookupDealerByCode('123', '1234')).rejects.toThrow('configuration offline');
  getDoc.mockRejectedValue(new Error('permission-denied'));
  await expect(lookupDealerByCode('123', '1234')).rejects.toThrow('permission-denied');
});
it('preserves actionable API setup errors without anonymous fallback', async () => {
  api({ code: 'server-not-configured', error: 'Server credentials missing' }, false);
  await expect(lookupDealerByCode('123', '1234')).rejects.toMatchObject({ code: 'server-not-configured' });
  expect(getDocs).not.toHaveBeenCalled();
});
it('supports an older token API only through an authenticated code-restricted query', async () => {
  api({ token: 'custom-token', dealerCode: '123' });
  getDocs.mockResolvedValue({ docs: [{ id: 'dealer-doc', data: () => ({ dealerCode: '123', status: 'active' }) }] });
  expect((await lookupDealerByCode('123', '1234')).outcome).toBe('ok');
  expect(signInWithCustomToken.mock.invocationCallOrder[0]).toBeLessThan(getDocs.mock.invocationCallOrder[0]);
});
it('returns only server-hashed credentials and skips blank PIN changes', async () => {
  const pinHash = `scrypt$16384$8$1$${'A'.repeat(22)}==$${'B'.repeat(86)}==`;
  api({ pin: null, pinHash, pinUpdatedAt: '2026-09-18T00:00:00.000Z' });
  expect(await buildPinWritePatch(' 1234 ')).toEqual({ pin: null, pinHash, pinUpdatedAt: '2026-09-18T00:00:00.000Z' });
  expect(fetch).toHaveBeenCalledWith('/api/pin-hash', expect.objectContaining({ body: JSON.stringify({ pin: '1234' }) }));
  fetch.mockClear();
  expect(await buildPinWritePatch('')).toEqual({});
  expect(fetch).not.toHaveBeenCalled();
});
it('never falls back to plaintext when hashing fails or returns unsafe data', async () => {
  api({ error: 'Hash service unavailable' }, false);
  await expect(buildPinWritePatch('1234')).rejects.toThrow('Hash service unavailable');
  api({ pin: '1234', pinHash: null });
  await expect(buildPinWritePatch('1234')).rejects.toThrow('invalid response');
  fetch.mockRejectedValue(new Error('offline'));
  await expect(buildPinWritePatch('1234')).rejects.toThrow('offline');
});
