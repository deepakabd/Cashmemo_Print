import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ authStateReady: vi.fn(), currentUser: null }));
vi.mock('../src/firebase', () => ({ auth }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Firestore request retry', () => {
  it('waits 500ms and then 1s before retrying and returns recovered data', async () => {
    vi.useFakeTimers();
    const { retryFirestoreRequest } = await loadService();
    const read = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('still offline'))
      .mockResolvedValue(['recovered']);
    const result = retryFirestoreRequest(read, 3);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual(['recovered']);
    expect(read).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('throws the last failure after three attempts so the caller can fall back', async () => {
    vi.useFakeTimers();
    const { retryFirestoreRequest } = await loadService();
    const finalError = new Error('final failure');
    const read = vi.fn().mockRejectedValueOnce(new Error('first failure')).mockRejectedValue(finalError);
    const result = expect(retryFirestoreRequest(read)).rejects.toBe(finalError);
    await vi.advanceTimersByTimeAsync(1500);
    await result;
    expect(read).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns immediately on success without scheduling a retry', async () => {
    vi.useFakeTimers();
    const { retryFirestoreRequest } = await loadService();
    const read = vi.fn().mockResolvedValue([]);
    await expect(retryFirestoreRequest(read)).resolves.toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

const loadService = async () => {
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
  vi.resetModules();
  return import('../src/services/firestoreRest.js');
};

describe('authenticated Firestore REST requests', () => {
  it('encodes continuation tokens and preserves the next page token', async () => {
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('test-token') };
    auth.authStateReady.mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ documents: [], nextPageToken: 'last-page' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = await loadService();
    await expect(service.fetchFirestoreCollectionPageRest('users', 200, { pageToken: 'next +/page' }))
      .resolves.toEqual({ documents: [], nextPageToken: 'last-page' });
    expect(fetchMock.mock.calls[0][0]).toContain('pageToken=next%20%2B%2Fpage');
  });

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
