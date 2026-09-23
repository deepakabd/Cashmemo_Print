import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../api/sales-report.js';
import { handleSalesReportRequest, splitSalesReportData } from '../server/salesReportService.js';

const r2 = vi.hoisted(() => ({
  save: vi.fn(),
  load: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../server/r2SalesReportStore.js', () => ({
  saveR2SalesMonth: r2.save,
  loadR2SalesMonth: r2.load,
  deleteR2SalesMonth: r2.remove,
}));

vi.mock('../server/loginService.js', () => {
  class MockLoginError extends Error {
    constructor(code, message, status = 400) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }

  const mockUsers = new Map();
  const mockChunks = new Map();
  const mockAuth = { verifyIdToken: vi.fn() };
  const userDocRef = (id) => ({
    id,
    get: vi.fn().mockImplementation(async () => {
      const docData = mockUsers.get(id);
      return { exists: !!docData, data: () => docData };
    }),
    set: vi.fn().mockImplementation(async (data, opts) => {
      const current = mockUsers.get(id) || {};
      mockUsers.set(id, opts?.merge ? { ...current, ...data } : data);
      return true;
    }),
    collection: vi.fn(() => ({
      doc: vi.fn((chunkId) => ({
        get: vi.fn().mockImplementation(async () => {
          const data = mockChunks.get(`${id}/${chunkId}`);
          return { exists: !!data, data: () => data };
        }),
        set: vi.fn().mockImplementation(async (data) => {
          mockChunks.set(`${id}/${chunkId}`, data);
        }),
        delete: vi.fn().mockImplementation(async () => {
          mockChunks.delete(`${id}/${chunkId}`);
        }),
      })),
    })),
  });
  const mockFirestore = {
    collection: vi.fn((colName) => ({
      doc: vi.fn((id) => userDocRef(id)),
      where: vi.fn((field, op, val) => ({
        limit: vi.fn(() => ({
          get: vi.fn().mockImplementation(async () => {
            const matches = [];
            for (const [docId, docData] of mockUsers.entries()) {
              if (docData[field] === val) {
                matches.push({
                  id: docId,
                  ref: mockFirestore.collection(colName).doc(docId),
                  data: () => docData,
                });
              }
            }
            return {
              empty: matches.length === 0,
              docs: matches,
            };
          }),
        })),
      })),
    })),
  };

  return {
    LoginError: MockLoginError,
    getAdmin: vi.fn().mockResolvedValue({
      auth: mockAuth,
      firestore: mockFirestore,
    }),
    __mockUsers: mockUsers,
    __mockChunks: mockChunks,
    __mockAuth: mockAuth,
  };
});

describe('SalesReport Server API & Service', () => {
  let mockUsers;
  let mockAuth;
  let mockChunks;

  beforeEach(async () => {
    const loginService = await import('../server/loginService.js');
    mockUsers = loginService.__mockUsers;
    mockAuth = loginService.__mockAuth;
    mockChunks = loginService.__mockChunks;
    mockUsers.clear();
    mockChunks.clear();
    mockAuth.verifyIdToken.mockReset();
    mockAuth.verifyIdToken.mockResolvedValue({
      uid: 'user_1', dealerCode: 'D100', accountActive: true, planActive: true,
    });
    r2.save.mockReset().mockResolvedValue(undefined);
    r2.load.mockReset();
    r2.remove.mockReset().mockResolvedValue(undefined);
  });

  it('rejects requests without userId or dealerCode', async () => {
    await expect(handleSalesReportRequest('Bearer token', {})).rejects.toMatchObject({
      code: 'missing-identity',
      status: 400,
    });
  });

  it('saves sales report data successfully by userId', async () => {
    mockUsers.set('user_1', { dealerCode: 'D100', dealerName: 'Dealer 100' });

    const result = await handleSalesReportRequest('Bearer token', {
      mode: 'save',
      userId: 'user_1',
      salesReportData: {
        compressedData: 'COMPRESSED_ABC',
        batches: [],
        settings: { uploadEnabled: true },
      },
    });

    expect(result.success).toBe(true);
    expect(result.docId).toBe('user_1');

    const savedDoc = mockUsers.get('user_1');
    expect(savedDoc.salesReportData).toBeDefined();
    expect(savedDoc.salesReportData.compressedData).toBe('COMPRESSED_ABC');
    expect(savedDoc.dealerName).toBe('Dealer 100'); // Preserved by merge
  });

  it('saves sales report data by dealerCode lookup if userId not found directly', async () => {
    mockUsers.set('auto_id_999', { dealerCode: 'D200', dealerName: 'Dealer 200' });
    mockAuth.verifyIdToken.mockResolvedValueOnce({
      uid: 'auth_200', dealerCode: 'D200', accountActive: true, planActive: true,
    });

    const result = await handleSalesReportRequest('Bearer token', {
      mode: 'save',
      dealerCode: 'D200',
      salesReportData: {
        compressedData: 'COMPRESSED_XYZ',
      },
    });

    expect(result.success).toBe(true);
    expect(result.docId).toBe('auto_id_999');

    const savedDoc = mockUsers.get('auto_id_999');
    expect(savedDoc.salesReportData.compressedData).toBe('COMPRESSED_XYZ');
  });

  it('loads saved sales report data successfully', async () => {
    mockUsers.set('user_2', {
      dealerCode: 'D300',
      salesReportData: {
        compressedData: 'SAVED_DATA_123',
        settings: { uploadEnabled: true },
      },
    });

    mockAuth.verifyIdToken.mockResolvedValueOnce({ uid: 'user_2', dealerCode: 'D300' });
    const result = await handleSalesReportRequest('Bearer token', {
      mode: 'load',
      userId: 'user_2',
    });

    expect(result.success).toBe(true);
    expect(result.salesReportData.compressedData).toBe('SAVED_DATA_123');
  });

  it('stores and restores reports larger than the Firestore document limit in chunks', async () => {
    mockUsers.set('user_1', { dealerCode: 'D100' });
    const compressedData = 'A'.repeat(1_625_000);

    await handleSalesReportRequest('Bearer token', {
      mode: 'save', userId: 'user_1', salesReportData: { compressedData, batches: [] },
    });

    const metadata = mockUsers.get('user_1').salesReportData;
    expect(metadata.compressedData).toBeUndefined();
    expect(metadata.storageVersion).toBe(2);
    expect(metadata.chunkCount).toBe(3);
    expect(mockChunks.size).toBe(3);

    const loaded = await handleSalesReportRequest('Bearer token', {
      mode: 'load', userId: 'user_1',
    });
    expect(loaded.salesReportData.compressedData).toBe(compressedData);
  });

  it('stores monthly reports in R2 and saves only their manifest in Firestore', async () => {
    mockUsers.set('user_1', { dealerCode: 'D100' });
    await handleSalesReportRequest('Bearer token', {
      mode: 'saveMonth', userId: 'user_1', monthKey: '2026-09', compressedData: 'MONTH_DATA',
    });
    await handleSalesReportRequest('Bearer token', {
      mode: 'saveManifest', userId: 'user_1',
      salesReportData: { monthKeys: ['2026-09'], batches: [] },
    });

    expect(r2.save).toHaveBeenCalledWith('user_1', '2026-09', 'MONTH_DATA');
    expect(mockUsers.get('user_1').salesReportData).toMatchObject({
      storageVersion: 3, monthKeys: ['2026-09'],
    });
    expect(mockUsers.get('user_1').salesReportData.compressedData).toBeUndefined();
  });

  it('loads a monthly report from R2', async () => {
    mockUsers.set('user_1', { dealerCode: 'D100', salesReportData: { storageVersion: 3, monthKeys: ['2026-09'] } });
    r2.load.mockResolvedValueOnce('MONTH_DATA');
    const result = await handleSalesReportRequest('Bearer token', {
      mode: 'loadMonth', userId: 'user_1', monthKey: '2026-09',
    });
    expect(result.compressedData).toBe('MONTH_DATA');
  });

  it('splits data below the Firestore limit with safe per-document headroom', () => {
    expect(splitSalesReportData('A'.repeat(1_625_000)).map((chunk) => chunk.length))
      .toEqual([700_000, 700_000, 225_000]);
  });

  it('returns null salesReportData when user document has no sales data yet', async () => {
    mockUsers.set('user_empty', { dealerCode: 'D400' });
    mockAuth.verifyIdToken.mockResolvedValueOnce({ uid: 'user_empty', dealerCode: 'D400' });

    const result = await handleSalesReportRequest('Bearer token', {
      mode: 'load',
      userId: 'user_empty',
    });

    expect(result.success).toBe(true);
    expect(result.salesReportData).toBeNull();
  });

  it('api handler rejects non-POST requests with 405', async () => {
    const res = {
      setHeader: vi.fn(),
      statusCode: null,
      headers: {},
      end: vi.fn(),
    };
    await handler({ method: 'GET' }, res);

    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST');
    expect(res.statusCode).toBe(405);
  });

  it('api handler processes valid POST request with JSON response', async () => {
    mockUsers.set('user_api', { dealerCode: 'D500' });
    mockAuth.verifyIdToken.mockResolvedValueOnce({
      uid: 'user_api', dealerCode: 'D500', accountActive: true, planActive: true,
    });

    let sentStatus = null;
    let sentBody = null;

    const res = {
      setHeader: vi.fn(),
      status: vi.fn((code) => { sentStatus = code; return res; }),
      json: vi.fn((data) => { sentBody = data; return res; }),
      end: vi.fn((data) => { sentBody = JSON.parse(data); return res; }),
    };

    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: {
        mode: 'save',
        userId: 'user_api',
        salesReportData: {
          compressedData: 'FROM_API',
        },
      },
    };

    await handler(req, res);

    expect(sentStatus || res.statusCode).toBe(200);
    expect(mockUsers.get('user_api').salesReportData.compressedData).toBe('FROM_API');
  });

  it('rejects access to another dealer account', async () => {
    mockUsers.set('user_other', { dealerCode: 'D999' });

    await expect(handleSalesReportRequest('Bearer token', {
      mode: 'load', userId: 'user_other',
    })).rejects.toMatchObject({ code: 'forbidden', status: 403 });
  });
});
