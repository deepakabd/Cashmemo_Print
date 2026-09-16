import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../src/firebase', () => ({ auth: {}, db: {} }));

import { lookupDealerByCode } from '../src/auth/userAuth.js';

afterEach(() => vi.unstubAllGlobals());

it('distinguishes an unreachable login server', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(lookupDealerByCode('test', 'test')).rejects.toThrow('Cannot reach the login server');
});

it('reports the HTTP status without exposing unexpected server response details', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'private backend detail', code: 'server-error' }) }));
  await expect(lookupDealerByCode('test', 'test')).rejects.toThrow('Login server returned HTTP 500. Check the server terminal for the login error.');
});

it.each([null, {}, { token: 123 }])('rejects a successful response without a usable token: %j', async (payload) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
  await expect(lookupDealerByCode('test', 'test')).rejects.toThrow('missing sign-in token');
});

it('identifies a non-JSON response from the wrong route', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError(); } }));
  await expect(lookupDealerByCode('test', 'test')).rejects.toThrow('missing sign-in token');
});
