import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  compressTransactions,
  decompressTransactions,
  loadSalesReportFromFirebase,
  saveSalesReportData,
  COMPACT_TX_FIELDS,
} from '../src/services/salesReportStore';
import * as salesReportDb from '../src/services/salesReportDb';
import * as firestore from 'firebase/firestore';

vi.mock('../src/firebase', () => ({
  db: {},
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
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it('saveSalesReportData writes compressed data to Firestore users/{userId}', async () => {
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
    // Verified that monthlyUploads rows in cloud payload are stripped to avoid 1MB document quota
    expect(savedPayload.monthlyUploads['2026-09'].rows).toHaveLength(0);
  });

  it('loadSalesReportFromFirebase on a new machine restores all transactions from cloud and saves to local IndexedDB', async () => {
    const user = { id: 'dealer_123', dealerCode: 'D123' };

    // Machine 2 has empty IndexedDB and empty localStorage
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

    // Mock Firestore user doc snapshot containing cloud payload
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
              rows: [], // Cloud strips rows, but they must be restored from compressedData!
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

    // Confirms it cached the full hydrated data into the new device's local IndexedDB
    expect(salesReportDb.saveSalesReportToIndexedDB).toHaveBeenCalledWith(
      expect.stringContaining('D123'),
      expect.objectContaining({
        transactions: expect.arrayContaining([expect.objectContaining({ orderNo: '1001' })]),
      })
    );
  });
});
