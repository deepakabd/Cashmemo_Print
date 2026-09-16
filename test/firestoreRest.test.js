import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ authStateReady: vi.fn(), currentUser: null }));
vi.mock('../src/firebase', () => ({ auth }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const loadService = async () => {
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
  vi.resetModules();
  return import('../src/services/firestoreRest.js');
};

describe('authenticated Firestore REST requests', () => {
  it('pauses forbidden audit reads until an explicit retry', async () => {
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('test-token') };
    auth.authStateReady.mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 403,
      json: async () => ({ error: { status: 'PERMISSION_DENIED', message: 'Missing permissions.' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = await loadService();
    const read = () => service.fetchFirestoreCollectionRest('adminAuditTrail', 200, { pauseOnForbidden: true });
    await expect(read()).rejects.toMatchObject({ status: 403 });
    await expect(read()).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    service.retryDeniedFirestoreReads();
    await expect(read()).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('another-token') };
    await expect(read()).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('waits for auth and sends the ID token in the header', async () => {
    const user = { getIdToken: vi.fn().mockResolvedValue('test-token') };
    auth.currentUser = null;
    auth.authStateReady.mockImplementation(async () => { auth.currentUser = user; });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const service = await loadService();
    await expect(service.fetchFirestoreCollectionRest('adminAuditTrail')).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/adminAuditTrail?'), {
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('does not send an anonymous request after sign-out', async () => {
    auth.currentUser = null;
    auth.authStateReady.mockResolvedValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = await loadService();
    await expect(service.fetchFirestoreCollectionRest('adminAuditTrail')).rejects.toThrow('sign-in required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retains permission-denied details instead of treating them as empty data', async () => {
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('test-token') };
    auth.authStateReady.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403,
      json: async () => ({ error: { status: 'PERMISSION_DENIED', message: 'Missing permissions.' } }),
    }));
    const service = await loadService();
    await expect(service.fetchFirestoreCollectionRest('adminAuditTrail')).rejects.toMatchObject({
      status: 403, code: 'PERMISSION_DENIED', message: 'Missing permissions.',
    });
  });
});
