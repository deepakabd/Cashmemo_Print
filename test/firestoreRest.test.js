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
  it('filters pending approvals on the server and follows an exclusive document-name cursor', async () => {
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('test-token') };
    const name = 'projects/test-project/databases/(default)/documents/updateApprovals/a';
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [
      { document: { name, fields: { status: { stringValue: 'pending' }, payload: { mapValue: { fields: {
        englishWord: { stringValue: 'Milk' },
      } } } } } },
    ] }).mockResolvedValueOnce({ ok: true, json: async () => [{ readTime: 'now' }] });
    vi.stubGlobal('fetch', fetchMock);
    const service = await loadService();
    const options = { where: { field: 'status', value: 'pending' } };
    const first = await service.fetchFirestoreCollectionPageRest('updateApprovals', 1, options);
    expect(first).toEqual({ documents: [{ id: 'a', status: 'pending', payload: { englishWord: 'Milk' } }], nextPageToken: name });
    const second = await service.fetchFirestoreCollectionPageRest('updateApprovals', 1, { ...options, pageToken: first.nextPageToken });
    expect(second).toEqual({ documents: [], nextPageToken: null });
    expect(fetchMock.mock.calls[0][0]).toContain('/documents:runQuery?');
    const request = fetchMock.mock.calls[1][1];
    expect(request.method).toBe('POST');
    expect(request.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(request.body).structuredQuery).toEqual({
      from: [{ collectionId: 'updateApprovals' }],
      where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } } },
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: 1,
      startAt: { values: [{ referenceValue: name }], before: false },
    });
  });

  it('encodes the requested audit ordering and page size', async () => {
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('test-token') };
    auth.authStateReady.mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const service = await loadService();
    await service.fetchFirestoreCollectionPageRest('adminAuditTrail', 150, { orderBy: 'createdAt desc' });
    const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(params.get('orderBy')).toBe('createdAt desc');
    expect(params.get('pageSize')).toBe('150');
  });
  it('loads 450 admin users through real REST decoding, including a short intermediate page', async () => {
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('test-token') };
    auth.authStateReady.mockResolvedValue(undefined);
    const documents = Array.from({ length: 450 }, (_, index) => ({
      name: `projects/test-project/databases/(default)/documents/users/user-${index}`,
      fields: { dealerCode: { stringValue: String(index).padStart(6, '0') }, status: { stringValue: 'active' } },
    }));
    const pages = [
      { documents: documents.slice(0, 200), nextPageToken: 'page 2+/' },
      { documents: documents.slice(200, 201), nextPageToken: 'page-3' },
      { documents: documents.slice(201, 401), nextPageToken: 'page-4' },
      { documents: documents.slice(401) },
    ];
    const fetchMock = vi.fn();
    for (const page of pages) fetchMock.mockResolvedValueOnce({ ok: true, json: async () => page });
    vi.stubGlobal('fetch', fetchMock);
    await loadService();
    const { fetchAllAdminUsers } = await import('../src/services/adminUserRepository.js');
    const users = await fetchAllAdminUsers();
    expect(users).toHaveLength(450);
    expect(new Set(users.map((user) => user.id)).size).toBe(450);
    expect(users[449]).toMatchObject({ id: 'user-449', dealerCode: '000449' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][0]).toContain('pageToken=page%202%2B%2F');
    expect(fetchMock.mock.calls[2][0]).toContain('pageToken=page-3');
    expect(fetchMock.mock.calls[3][0]).toContain('pageToken=page-4');
    const mask = new URL(fetchMock.mock.calls[0][0]).searchParams.getAll('mask.fieldPaths');
    expect(mask).toContain('dealerCode');
    expect(mask).not.toContain('ratesData');
    expect(mask).not.toContain('profileData');
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toContain('pageSize=200');
      expect(new URL(url).searchParams.getAll('mask.fieldPaths')).toEqual(mask);
    }
  });

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
