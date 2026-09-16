import { expect, it, vi } from 'vitest';
vi.mock('../src/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), limit: vi.fn(), orderBy: vi.fn(), query: vi.fn(), serverTimestamp: vi.fn(), startAfter: vi.fn(), updateDoc: vi.fn(), where: vi.fn() }));
vi.mock('../src/services/userSubcollections', () => ({ mirrorUserPatchToSubcollections: vi.fn(), mergeUserDocWithSubcollections: vi.fn(), readUserSubcollections: vi.fn().mockResolvedValue({}) }));
import { getDocs } from 'firebase/firestore';
import { lookupDealerByCode, buildPinWritePatch } from '../src/auth/userAuth';
const account = (pin) => getDocs.mockResolvedValue({size:1,empty:false,docs:[{id:'dealer-doc',data:()=>({dealerCode:'123',pin,status:'active'})}]});
it('accepts the original dealer PIN without a login API request', async () => {
  account('1234');
  const result = await lookupDealerByCode('123', '1234');
  expect(result.outcome).toBe('ok');
  expect(result.firestoreUser.id).toBe('dealer-doc');
  expect(result.firestoreUser.pin).toBeUndefined();
});
it('rejects the wrong PIN', async () => { account('1234'); expect((await lookupDealerByCode('123','9999')).outcome).toBe('not-found'); });
it('rejects duplicate dealers', async () => { getDocs.mockResolvedValue({size:2}); expect((await lookupDealerByCode('123','1234')).outcome).toBe('duplicate'); });
it('propagates database failures', async () => { getDocs.mockRejectedValue(new Error('offline')); await expect(lookupDealerByCode('123','1234')).rejects.toThrow('offline'); });
it('stores replacement PINs compatible with legacy login', async () => { expect(await buildPinWritePatch(' 1234 ')).toMatchObject({pin:'1234',pinHash:null}); expect(await buildPinWritePatch('')).toEqual({}); });
