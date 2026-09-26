import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  compressTransactions,
  decompressTransactions,
  loadSalesReportFromFirebase,
  saveSalesReportData,
  importSalesBatch,
  confirmMonthData,
  unlockMonthData,
  resetMonthSalesData,
  COMPACT_TX_FIELDS,
  createLightweightCacheCopy,
  toggleMonthActions,
} from '../src/services/salesReportStore';
import * as salesReportDb from '../src/services/salesReportDb';
import * as firestore from 'firebase/firestore';

vi.mock('../src/firebase', () => ({
  db: {},
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('sales-report-token'),
    },
  },
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, col, id) => ({ path: `${col}/${id}` })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('../src/services/salesReportDb', () => ({
  saveSalesReportToIndexedDB: vi.fn().mockResolvedValue(true),
  loadSalesReportFromIndexedDB: vi.fn().mockResolvedValue(null),
  deleteSalesReportFromIndexedDB: vi.fn().mockResolvedValue(true),
}));

describe('SalesReport Multi-Device Cloud Sync', () => {
    const originalFetch = globalThis.fetch;
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      // Default to failed fetch so fallback tests can test Firestore client SDK directly without console error
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('API offline'));
    });

  it('blocks a month-wise import when any row belongs to another month', async () => {
    const currentStore = {
      isReset: true,
      settings: { lockedMonths: {} },
      monthlyUploads: {},
      batches: [],
      transactions: [],
    };
    const batch = {
      uploadType: 'monthWise',
      fy: '2026-27',
      month: '09',
      fileName: 'September.xlsx',
    };
    const mixedRows = [
      { id: 'sep', uniqueKey: 'sep', year: 2026, monthNo: 9 },
      { id: 'apr', uniqueKey: 'apr', year: 2026, monthNo: 4 },
    ];

    await expect(importSalesBatch(null, currentStore, batch, mixedRows))
      .rejects.toThrow('Month-wise upload must contain only 2026-09 sales data. Detected: 2026-04.');
    expect(salesReportDb.saveSalesReportToIndexedDB).not.toHaveBeenCalled();
  });

  it('never exposes a truncated transaction prefix as a complete localStorage cache', () => {
    const transactions = Array.from({ length: 500 }, (_, index) => ({
      orderNo: String(index), year: 2026, monthNo: index < 300 ? 9 : 4,
    }));
    const cache = createLightweightCacheCopy({
      updatedAt: '2026-09-26T10:00:00.000Z', storageVersion: 3,
      monthKeys: ['2026-04', '2026-09'], settings: {},
      batches: [{ batchId: 'real' }], monthlyUploads: {}, transactions,
    });

    expect(cache.cachePartial).toBe(true);
    expect(cache.transactions).toEqual([]);
    expect(cache.monthKeys).toEqual(['2026-04', '2026-09']);
  });

  it('persists the month confirmation/unlock Action enable-disable setting', async () => {
    const store = { isReset: true, settings: { monthActionsEnabled: true }, transactions: [], batches: [], monthlyUploads: {} };
    const disabled = await toggleMonthActions(null, store, false);
    expect(disabled.settings.monthActionsEnabled).toBe(false);
    expect(salesReportDb.saveSalesReportToIndexedDB).toHaveBeenCalled();
  });

  it('compressTransactions and decompressTransactions preserve 100% of transaction data and types', () => {
    const originalRows = [
      {
        id: 'r1',
        uniqueKey: '540414_1783006_608561_2026-09-01_142KG',
        slNo: 1,
        orderNo: '540414',
        orderDate: '2026-09-01 10:15',
        orderDateKey: '2026-09-01',
        orderTime: '10:15',
        orderStatus: 'Delivered',
        orderSource: 'IVRS',
        orderType: 'Refill',
        consumerNo: '608561',
        consumerName: 'JITIYA DEVI',
        natureOfConsumer: '16-Scheme Ujjwala',
        packageCode: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)',
        productType: '14.2 kg Domestic Refill',
        category: 'Domestic',
        typeOfConsumer: 'SBC',
        cashMemoNo: '1783006',
        cashMemoDate: '2026-09-01',
        cashMemoCancelDate: null,
        cashMemoStatus: 'Printed',
        cancellationReason: null,
        deliveryMode: 'Home',
        actualDeliveryDate: '2026-09-01',
        orderQuantity: 1,
        subsidyQty: 1,
        deliveryStaff: 'DM Dinesh',
        onlineRefillPaymentStatus: null,
        ivrsBookingNumber: '12345',
        mobileNo: '9631903875',
        isRegMobile: 'Y',
        dacType: 'OTP/DAC',
        dacVerified: true,
        consumerAddress: 'Kharka Ward 3',
        rawRsp: 1039,
        rsp: 1039,
        salesValue: 1039,
        deliveryArea: 'Kharka - WARD - 03',
        isRefillPort: 'N',
        ekycStatus: 'EKYC DONE',
        paymentMode: 'Cash on Delivery',
        salesDate: '2026-09-01',
        salesDateSource: 'actualDeliveryDate',
        dateKey: '2026-09-01',
        day: 1,
        monthNo: 9,
        monthName: 'September',
        year: 2026,
        fy: '2026-27',
        importBatchId: 'batch_sep_2026',
        sourceFileName: 'sales_sep.xlsx',
      },
    ];

    const compressed = compressTransactions(originalRows);
    expect(typeof compressed).toBe('string');
    expect(compressed.length).toBeGreaterThan(0);

    const decompressed = decompressTransactions(compressed);
    expect(decompressed).toHaveLength(1);
    const row = decompressed[0];

    COMPACT_TX_FIELDS.forEach((field) => {
      expect(row[field]).toEqual(originalRows[0][field]);
    });
  });

  it('saveSalesReportData writes compressed data via trusted /api/sales-report when available', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123' };
    const sampleRows = [
      {
        id: 'r1',
        uniqueKey: 'k1',
        orderNo: '1001',
        actualDeliveryDate: '2026-09-01',
        salesDate: '2026-09-01',
        year: 2026,
        monthNo: 9,
        orderQuantity: 2,
        salesValue: 2078,
        dacVerified: true,
      },
    ];

    const store = {
      settings: { uploadEnabled: true },
      batches: [{ batchId: 'b1', fileName: 'test.xlsx' }],
      monthlyUploads: {
        '2026-09': {
          fileName: 'test.xlsx',
          summary: { totalRows: 1, totalCylinders: 2, totalRevenue: 2078 },
          rows: sampleRows,
        },
      },
      transactions: sampleRows,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, docId: 'dealer_123' }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, docId: 'dealer_123' }),
    });

    const success = await saveSalesReportData(user, store);

    expect(success).toBe(true);
    expect(salesReportDb.saveSalesReportToIndexedDB).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toMatchObject({
      mode: 'saveMonthAndManifest', monthKey: '2026-09',
      salesReportData: { monthKeys: ['2026-09'] },
    });
    // Since API succeeded, direct client setDoc was not needed
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('uploads independent R2 months concurrently before saving the manifest', async () => {
    const pendingMonthUploads = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, request) => {
      const body = JSON.parse(request.body);
      if (body.mode === 'saveMonth') {
        return new Promise((resolve) => pendingMonthUploads.push({ monthKey: body.monthKey, resolve }));
      }
      return { ok: true, json: async () => ({ success: true }) };
    });

    const rows = [
      { id: 'apr', uniqueKey: 'apr', year: 2026, monthNo: 4 },
      { id: 'sep', uniqueKey: 'sep', year: 2026, monthNo: 9 },
    ];
    const savePromise = saveSalesReportData(
      { id: 'dealer_123', dealerCode: 'D123' },
      { isReset: true, settings: {}, batches: [{ batchId: 'b1' }], monthlyUploads: {}, transactions: rows },
    );

    await vi.waitFor(() => expect(pendingMonthUploads).toHaveLength(2));
    expect(pendingMonthUploads.map((upload) => upload.monthKey).sort()).toEqual(['2026-04', '2026-09']);
    pendingMonthUploads.forEach(({ resolve }) => resolve({ ok: true, json: async () => ({ success: true }) }));

    await expect(savePromise).resolves.toBe(true);
    const modes = globalThis.fetch.mock.calls.map((call) => JSON.parse(call[1].body).mode);
    expect(modes.filter((mode) => mode === 'saveMonth')).toHaveLength(2);
    expect(modes.at(-1)).toBe('saveManifest');
  });

  it('saveSalesReportData falls back to direct Firestore users/{userId} when API fails', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123' };
    const sampleRows = [
      {
        id: 'r1',
        uniqueKey: 'k1',
        orderNo: '1001',
        actualDeliveryDate: '2026-09-01',
        salesDate: '2026-09-01',
        year: 2026,
        monthNo: 9,
        orderQuantity: 2,
        salesValue: 2078,
        dacVerified: true,
      },
    ];

    const store = {
      settings: { uploadEnabled: true },
      batches: [{ batchId: 'b1', fileName: 'test.xlsx' }],
      monthlyUploads: {
        '2026-09': {
          fileName: 'test.xlsx',
          summary: { totalRows: 1, totalCylinders: 2, totalRevenue: 2078 },
          rows: sampleRows,
        },
      },
      transactions: sampleRows,
    };

    await saveSalesReportData(user, store);

    expect(salesReportDb.saveSalesReportToIndexedDB).toHaveBeenCalled();
    expect(firestore.setDoc).toHaveBeenCalled();

    const setDocCall = vi.mocked(firestore.setDoc).mock.calls[0];
    const savedPayload = setDocCall[1].salesReportData;

    expect(savedPayload).toBeDefined();
    expect(typeof savedPayload.compressedData).toBe('string');
    expect(savedPayload.compressedData.length).toBeGreaterThan(0);
    expect(savedPayload.monthlyUploads['2026-09'].rows).toHaveLength(0);
  });

  it('loadSalesReportFromFirebase loads compressed transactions via /api/sales-report when available', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123' };
    const sampleRows = [
      {
        id: 'r1',
        uniqueKey: 'k1',
        orderNo: '1001',
        actualDeliveryDate: '2026-09-01',
        salesDate: '2026-09-01',
        year: 2026,
        monthNo: 9,
        orderQuantity: 2,
        salesValue: 2078,
        dacVerified: true,
      },
    ];

    const compressed = compressTransactions(sampleRows);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        salesReportData: {
          settings: { uploadEnabled: true },
          batches: [{ batchId: 'b1', fileName: 'test.xlsx' }],
          monthlyUploads: {
            '2026-09': {
              fileName: 'test.xlsx',
              summary: { totalRows: 1, totalCylinders: 2, totalRevenue: 2078 },
              rows: [],
            },
          },
          compressedData: compressed,
        },
      }),
    });

    const result = await loadSalesReportFromFirebase(user);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].orderNo).toBe('1001');
    expect(result.monthlyUploads['2026-09'].rows).toHaveLength(1);
    expect(result.monthlyUploads['2026-09'].rows[0].orderNo).toBe('1001');
    expect(salesReportDb.saveSalesReportToIndexedDB).toHaveBeenCalled();
  });

  it('quick-sync reuses unchanged months from IndexedDB with only one network request', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123' };
    const rows = [{ id: 'apr', uniqueKey: 'apr', orderNo: 'APR', year: 2026, monthNo: 4 }];
    const upload = {
      fileName: 'April.xlsx', fileSize: 1234, uploadedAt: '2026-05-01T10:00:00.000Z',
      summary: { totalRows: 1, totalCylinders: 1 }, rows,
    };
    vi.mocked(salesReportDb.loadSalesReportFromIndexedDB).mockResolvedValueOnce({
      storageVersion: 3, updatedAt: '2026-05-01T10:00:00.000Z',
      batches: [{ batchId: 'real' }], monthlyUploads: { '2026-04': upload }, transactions: rows,
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ salesReportData: {
        storageVersion: 3, updatedAt: '2026-05-01T10:01:00.000Z', monthKeys: ['2026-04'],
        batches: [{ batchId: 'real' }], monthlyUploads: { '2026-04': { ...upload, rows: [] } },
      } }),
    });

    const result = await loadSalesReportFromFirebase(user);

    expect(result.transactions).toEqual(rows);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body).mode).toBe('load');
  });

  it('recovers a missing R2 month from IndexedDB and repairs the cloud manifest', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123' };
    const august = { id: 'aug', uniqueKey: 'aug', year: 2026, monthNo: 8, orderNo: 'AUG' };
    const september = { id: 'sep', uniqueKey: 'sep', year: 2026, monthNo: 9, orderNo: 'SEP' };
    vi.mocked(salesReportDb.loadSalesReportFromIndexedDB).mockResolvedValueOnce({
      storageVersion: 3,
      batches: [{ batchId: 'real', fileName: 'sales.xlsx' }],
      monthlyUploads: {},
      transactions: [august, september],
    });
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({
          salesReportData: { storageVersion: 3, monthKeys: ['2026-08', '2026-09'], batches: [{ batchId: 'real' }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({ compressedData: compressTransactions([august]) }),
      })
      .mockResolvedValueOnce({
        ok: false, status: 404, json: async () => ({ error: 'missing', code: 'r2-object-missing' }),
      })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });

    const result = await loadSalesReportFromFirebase(user);

    expect(result.transactions.map((row) => row.orderNo).sort()).toEqual(['AUG', 'SEP']);
    const requestModes = globalThis.fetch.mock.calls.map((call) => JSON.parse(call[1].body).mode);
    expect(requestModes).toEqual(['load', 'loadMonth', 'loadMonth', 'saveMonth', 'saveMonth', 'saveManifest']);
  });

  it('recovers local financial-year months omitted by a partial cloud manifest', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123' };
    const april = { id: 'apr', uniqueKey: 'apr', year: 2026, monthNo: 4, orderNo: 'APR' };
    const august = { id: 'aug', uniqueKey: 'aug', year: 2026, monthNo: 8, orderNo: 'AUG' };
    const september = { id: 'sep', uniqueKey: 'sep', year: 2026, monthNo: 9, orderNo: 'SEP' };
    vi.mocked(salesReportDb.loadSalesReportFromIndexedDB).mockResolvedValueOnce({
      storageVersion: 3,
      batches: [{ batchId: 'apr-batch' }, { batchId: 'aug-batch' }],
      monthlyUploads: { '2026-04': { rows: [april] }, '2026-08': { rows: [august] } },
      transactions: [april, august],
    });
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({
        salesReportData: { storageVersion: 3, monthKeys: ['2026-09'], batches: [{ batchId: 'sep-batch' }], monthlyUploads: { '2026-09': { rows: [] } } },
      }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ compressedData: compressTransactions([september]) }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });

    const result = await loadSalesReportFromFirebase(user);

    expect(result.transactions.map((row) => row.orderNo).sort()).toEqual(['APR', 'AUG', 'SEP']);
    expect(result.monthKeys).toEqual(['2026-04', '2026-08', '2026-09']);
    const manifestCall = globalThis.fetch.mock.calls.map((call) => JSON.parse(call[1].body))
      .find((body) => body.mode === 'saveManifest');
    expect(manifestCall.salesReportData.monthKeys).toEqual(['2026-04', '2026-08', '2026-09']);
  });

  it('loadSalesReportFromFirebase on a new machine restores all transactions from Firestore fallback', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123' };

    vi.mocked(salesReportDb.loadSalesReportFromIndexedDB).mockResolvedValueOnce(null);

    const sampleRows = [
      {
        id: 'r1',
        uniqueKey: 'k1',
        orderNo: '1001',
        actualDeliveryDate: '2026-09-01',
        salesDate: '2026-09-01',
        year: 2026,
        monthNo: 9,
        orderQuantity: 2,
        salesValue: 2078,
        dacVerified: true,
      },
    ];

    const compressed = compressTransactions(sampleRows);

    vi.mocked(firestore.getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        salesReportData: {
          settings: { uploadEnabled: true },
          batches: [{ batchId: 'b1', fileName: 'test.xlsx' }],
          monthlyUploads: {
            '2026-09': {
              fileName: 'test.xlsx',
              summary: { totalRows: 1, totalCylinders: 2, totalRevenue: 2078 },
              rows: [],
            },
          },
          compressedData: compressed,
        },
      }),
    });

    const result = await loadSalesReportFromFirebase(user);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].orderNo).toBe('1001');
    expect(result.monthlyUploads['2026-09'].rows).toHaveLength(1);
    expect(result.monthlyUploads['2026-09'].rows[0].orderNo).toBe('1001');

    expect(salesReportDb.saveSalesReportToIndexedDB).toHaveBeenCalledWith(
      expect.stringContaining('D123'),
      expect.objectContaining({
        transactions: expect.arrayContaining([expect.objectContaining({ orderNo: '1001' })]),
      })
    );
  });

  it('loadSalesReportFromFirebase preserves real local transactions when remote only has initial sample dump, and triggers auto-sync to cloud', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123' };

    // Local IndexedDB has user's real file (e.g. 500 rows)
    const realLocalRows = Array.from({ length: 50 }, (_, i) => ({
      id: `real_${i}`,
      uniqueKey: `key_${i}`,
      orderNo: `ORD_${i}`,
      year: 2026,
      monthNo: 9,
      orderQuantity: 1,
      salesValue: 1039,
      dacVerified: true,
      actualDeliveryDate: '2026-09-05',
      salesDate: '2026-09-05',
    }));

    vi.mocked(salesReportDb.loadSalesReportFromIndexedDB).mockResolvedValueOnce({
      batches: [{ batchId: 'batch_real_uploaded_1', fileName: 'Real_Sales_File.xlsx' }],
      monthlyUploads: {
        '2026-09': {
          fileName: 'Real_Sales_File.xlsx',
          summary: { totalRows: 50, totalCylinders: 50, totalRevenue: 51950 },
          rows: realLocalRows,
        },
      },
      transactions: realLocalRows,
    });

    // Remote in Firestore has the 40-row sample dump
    const sampleRows = Array.from({ length: 40 }, (_, i) => ({
      id: `sample_${i}`,
      orderNo: `SAMPLE_${i}`,
      year: 2026,
      monthNo: 9,
      orderQuantity: 1,
      salesValue: 1039,
    }));
    const sampleCompressed = compressTransactions(sampleRows);

    vi.mocked(firestore.getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        salesReportData: {
          batches: [{ batchId: 'batch_initial_sep_2026', fileName: 'Sales_Dump_September_2026.xlsx' }],
          monthlyUploads: {
            '2026-09': {
              fileName: 'Sales_Dump_September_2026.xlsx',
              summary: { totalRows: 40, totalCylinders: 40, totalRevenue: 41560 },
              rows: [],
            },
          },
          compressedData: sampleCompressed,
        },
      }),
    });

    const result = await loadSalesReportFromFirebase(user);

    // It MUST keep the 50 real transactions, NOT the 40 sample transactions!
    expect(result.transactions).toHaveLength(50);
    expect(result.transactions[0].orderNo).toBe('ORD_0');
    expect(result.batches[0].fileName).toBe('Real_Sales_File.xlsx');

    // And it must trigger saving the real local data to cloud (fallback or API)
    expect(firestore.setDoc).toHaveBeenCalled();
    const lastSetDocCall = vi.mocked(firestore.setDoc).mock.calls.at(-1);
    expect(lastSetDocCall[1].salesReportData.batches[0].fileName).toBe('Real_Sales_File.xlsx');
  });

  it('blocks re-upload for a confirmed month even for an admin until it is unlocked', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123', role: 'admin' };
    const oldRow = { id: 'old', uniqueKey: 'old', year: 2026, monthNo: 8, orderQuantity: 1, salesValue: 100 };
    const newRow = { id: 'new', uniqueKey: 'new', year: 2026, monthNo: 8, orderQuantity: 2, salesValue: 200 };
    const store = {
      settings: { lockedMonths: { '2026-08': { confirmed: true } } },
      batches: [], transactions: [oldRow],
      monthlyUploads: { '2026-08': { confirmed: true, rows: [oldRow], summary: { totalRows: 1 } } },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: true }),
    });
    const onProgress = vi.fn();

    await expect(importSalesBatch(user, store, {
      batchId: 'replacement', fileName: 'august.xlsx', overwriteMonth: true,
    }, [newRow], { onProgress })).rejects.toThrow('confirmed and locked');

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(store.monthlyUploads['2026-08'].confirmed).toBe(true);
  });

  it('enables re-upload after Settings unlock clears the month lock', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123', role: 'admin' };
    const oldRow = { id: 'old', uniqueKey: 'old', year: 2026, monthNo: 8, orderQuantity: 1, salesValue: 100 };
    const newRow = { id: 'new', uniqueKey: 'new', year: 2026, monthNo: 8, orderQuantity: 2, salesValue: 200 };
    const store = {
      storageVersion: 3,
      monthKeys: ['2026-08'],
      settings: { lockedMonths: { '2026-08': { confirmed: true } } },
      batches: [], transactions: [oldRow],
      monthlyUploads: { '2026-08': { confirmed: true, rows: [oldRow], summary: { totalRows: 1 } } },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: true }),
    });

    const unlocked = await unlockMonthData(user, store, '2026-08');
    expect(unlocked.settings.lockedMonths['2026-08']).toBeUndefined();
    expect(unlocked.monthlyUploads['2026-08'].confirmed).toBe(false);

    const result = await importSalesBatch(user, unlocked, {
      batchId: 'replacement', fileName: 'august.xlsx', overwriteMonth: true,
    }, [newRow]);
    expect(result.transactions).toEqual([expect.objectContaining({ id: 'new' })]);
    expect(result.monthlyUploads['2026-08'].confirmed).toBe(false);
  });

  it('never locks the current month and ignores stale current-month lock metadata on upload', async () => {
    const now = new Date();
    const year = now.getFullYear();
    const monthNo = now.getMonth() + 1;
    const ym = `${year}-${String(monthNo).padStart(2, '0')}`;
    const user = { id: 'dealer_123', dealerCode: 'D123', role: 'admin' };
    const oldRow = { id: 'old-current', uniqueKey: 'old-current', year, monthNo };
    const newRow = { id: 'new-current', uniqueKey: 'new-current', year, monthNo };
    const store = {
      settings: { lockedMonths: { [ym]: { confirmed: true } } },
      batches: [], transactions: [oldRow],
      monthlyUploads: { [ym]: { confirmed: true, rows: [oldRow] } },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: true }),
    });

    await expect(confirmMonthData(user, store, ym)).rejects.toThrow('always unlocked');
    const result = await importSalesBatch(user, store, {
      batchId: 'current-replacement', fileName: 'current.xlsx', overwriteMonth: true,
    }, [newRow]);
    expect(result.transactions).toEqual([expect.objectContaining({ id: 'new-current' })]);
    expect(result.monthlyUploads[ym].confirmed).toBe(false);
  });

  it('month reset unlocks immediately and uses metadata-only sync for an existing R2 manifest', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123' };
    const august = { id: 'aug', uniqueKey: 'aug', year: 2026, monthNo: 8 };
    const september = { id: 'sep', uniqueKey: 'sep', year: 2026, monthNo: 9 };
    const store = {
      storageVersion: 3,
      monthKeys: ['2026-08', '2026-09'],
      settings: { lockedMonths: { '2026-08': { confirmed: true } } },
      batches: [], transactions: [august, september],
      monthlyUploads: {
        '2026-08': { confirmed: true, rows: [august] },
        '2026-09': { confirmed: false, rows: [september] },
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ success: true }),
    });

    const result = await resetMonthSalesData(user, store, '2026-08');

    expect(result.settings.lockedMonths['2026-08']).toBeUndefined();
    expect(result.monthlyUploads['2026-08']).toBeUndefined();
    expect(result.transactions).toEqual([september]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body).mode).toBe('saveManifest');
  });
});
