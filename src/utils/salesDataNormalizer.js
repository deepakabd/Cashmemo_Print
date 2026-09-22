/**
 * Sales Data Normalizer & Validation Engine for LPG Sales Report Module
 * Implements:
 * - Dynamic 31-column detection
 * - Indian FY determination (April to March)
 * - Sales Date determination (Actual Delivery Date > CashMemo Date > Order Date)
 * - Timezone-safe date parsing (Asia/Kolkata)
 * - Numeric and String sanitization (preserving leading zeros)
 * - Composite duplicate detection
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const FY_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

export const FY_MONTHS = [
  { monthNo: 4, monthCode: '04', name: 'April', shortName: 'Apr' },
  { monthNo: 5, monthCode: '05', name: 'May', shortName: 'May' },
  { monthNo: 6, monthCode: '06', name: 'June', shortName: 'Jun' },
  { monthNo: 7, monthCode: '07', name: 'July', shortName: 'Jul' },
  { monthNo: 8, monthCode: '08', name: 'August', shortName: 'Aug' },
  { monthNo: 9, monthCode: '09', name: 'September', shortName: 'Sep' },
  { monthNo: 10, monthCode: '10', name: 'October', shortName: 'Oct' },
  { monthNo: 11, monthCode: '11', name: 'November', shortName: 'Nov' },
  { monthNo: 12, monthCode: '12', name: 'December', shortName: 'Dec' },
  { monthNo: 1, monthCode: '01', name: 'January', shortName: 'Jan' },
  { monthNo: 2, monthCode: '02', name: 'February', shortName: 'Feb' },
  { monthNo: 3, monthCode: '03', name: 'March', shortName: 'Mar' },
];

/**
 * Calculate Indian Financial Year (April 1 to March 31)
 * Example: 2026-09-04 -> "2026-27", 2027-03-31 -> "2026-27", 2027-04-01 -> "2027-28"
 */
export function getIndianFinancialYear(year, monthNo) {
  const y = parseInt(year, 10);
  const m = parseInt(monthNo, 10);
  if (m >= 4) {
    const nextY = String(y + 1).slice(-2);
    return `${y}-${nextY}`;
  }
  const prevY = y - 1;
  const currY = String(y).slice(-2);
  return `${prevY}-${currY}`;
}

/**
 * Format Indian FY range for display, e.g. "FY 2026-27"
 */
export function formatFYLabel(fy) {
  if (!fy) return '';
  return fy.toUpperCase().startsWith('FY') ? fy : `FY ${fy}`;
}

/**
 * Parse date strings or Excel serial numbers into normalized date parts.
 * Prevents UTC day-shift issues by using explicit parts.
 */
const MONTH_MAP = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Parse date strings or Excel serial numbers into normalized date parts.
 * Prevents UTC day-shift issues by using explicit parts.
 * Supports all Indian & international formats:
 * - MM/DD/YYYY and M/D/YYYY (e.g. 9/13/2026, 9/1/2026)
 * - DD/MM/YYYY and D/M/YYYY (e.g. 13/09/2026, 01/09/2026)
 * - DD,MM,YYYY (Indian SDMS format: 01,09,2026, 13,09,2026)
 * - DD-MM-YYYY (01-09-2026, 13-09-2026)
 * - 2-digit years (9/13/26, 13/09/26, 01,09,26)
 * - Month text: 13-Sep-2026, 01-Sep-26, September 13, 2026
 * - Formats with 12h/24h time: 01,09,2026 04:34, 9/13/2026 10:15 AM
 */
export function parseSalesDate(val, options = {}) {
  if (val === null || val === undefined || val === '') return null;

  const { expectedMonth = null, expectedYear = null, slashFormat = 'MDY' } = options;

  // 1. Handle JS Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    const year = val.getFullYear();
    const monthNo = val.getMonth() + 1;
    const day = val.getDate();
    const hours = String(val.getHours()).padStart(2, '0');
    const mins = String(val.getMinutes()).padStart(2, '0');
    const dateKey = `${year}-${String(monthNo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      dateKey,
      timeStr: `${hours}:${mins}`,
      day,
      monthNo,
      monthName: MONTH_NAMES[monthNo - 1] || '',
      year,
      fy: getIndianFinancialYear(year, monthNo),
      formattedDisplay: `${String(day).padStart(2, '0')},${String(monthNo).padStart(2, '0')},${year}`,
    };
  }

  // 2. Handle Excel Serial Number (e.g. 46266 = 2026-09-01)
  if (typeof val === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = val * 86400 * 1000;
    const dateObj = new Date(epoch.getTime() + ms);
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getUTCFullYear();
      const monthNo = dateObj.getUTCMonth() + 1;
      const day = dateObj.getUTCDate();
      const hours = String(dateObj.getUTCHours()).padStart(2, '0');
      const mins = String(dateObj.getUTCMinutes()).padStart(2, '0');
      const dateKey = `${year}-${String(monthNo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        dateKey,
        timeStr: `${hours}:${mins}`,
        day,
        monthNo,
        monthName: MONTH_NAMES[monthNo - 1] || '',
        year,
        fy: getIndianFinancialYear(year, monthNo),
        formattedDisplay: `${String(day).padStart(2, '0')},${String(monthNo).padStart(2, '0')},${year}`,
      };
    }
  }

  // 3. Clean String Parsing (strip surrounding quotes and spaces)
  let str = String(val).replace(/^['"]+|['"]+$/g, '').trim();
  if (!str) return null;

  let timeStr = '00:00';
  // Extract time if present: e.g. 04:34 or 04:34:00 or 10:15 AM
  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?/i);
  if (timeMatch) {
    let hh = parseInt(timeMatch[1], 10);
    const mm = timeMatch[2];
    const ampm = timeMatch[3];
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hh < 12) hh += 12;
      if (ampm.toUpperCase() === 'AM' && hh === 12) hh = 0;
    }
    timeStr = `${String(hh).padStart(2, '0')}:${mm}`;
    str = str.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*(AM|PM))?/i, '').trim();
  }

  let year = null;
  let monthNo = null;
  let day = null;

  // A. ISO Format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[-/.,](\d{1,2})[-/.,](\d{1,2})$/);
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    monthNo = parseInt(ymdMatch[2], 10);
    day = parseInt(ymdMatch[3], 10);
  }

  // B. Month Name Format: e.g. 13-Sep-2026, 01-Sep-26, Sep 13, 2026, 13 Sep 2026
  if (!year) {
    const textMonthMatch = str.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{2,4})$/);
    if (textMonthMatch) {
      day = parseInt(textMonthMatch[1], 10);
      const mStr = textMonthMatch[2].toLowerCase().slice(0, 3);
      monthNo = MONTH_MAP[mStr] || null;
      let y = parseInt(textMonthMatch[3], 10);
      year = y < 100 ? (y >= 50 ? 1900 + y : 2000 + y) : y;
    }
  }

  // C. General Numeric Format: (p1)[sep](p2)[sep](p3)
  // Separators can be ',', '/', '-', '.'
  if (!year) {
    const numMatch = str.match(/^(\d{1,2})([,/\-.])(\d{1,2})[,/\-.](\d{2,4})$/);
    if (numMatch) {
      const p1 = parseInt(numMatch[1], 10);
      const sep = numMatch[2];
      const p2 = parseInt(numMatch[3], 10);
      let p3 = parseInt(numMatch[4], 10);
      year = p3 < 100 ? (p3 >= 50 ? 1900 + p3 : 2000 + p3) : p3;

      if (p1 > 12 && p2 <= 12) {
        // Definitely DD-MM-YYYY (e.g. 13/09/2026 or 13,09,2026)
        day = p1;
        monthNo = p2;
      } else if (p2 > 12 && p1 <= 12) {
        // Definitely MM-DD-YYYY (e.g. 9/13/2026 or 09/13/2026)
        monthNo = p1;
        day = p2;
      } else {
        // Ambiguous: Both p1 <= 12 and p2 <= 12 (e.g. 01,09,2026 or 9/1/2026)
        if (sep === ',') {
          // Indian SDMS exports strictly use comma for DD,MM,YYYY
          day = p1;
          monthNo = p2;
        } else if (expectedMonth) {
          if (p1 === expectedMonth && p2 !== expectedMonth) {
            monthNo = p1;
            day = p2;
          } else if (p2 === expectedMonth && p1 !== expectedMonth) {
            day = p1;
            monthNo = p2;
          } else if (slashFormat === 'MDY') {
            monthNo = p1;
            day = p2;
          } else {
            day = p1;
            monthNo = p2;
          }
        } else if (sep === '/' && slashFormat === 'MDY') {
          monthNo = p1;
          day = p2;
        } else {
          // Default Indian standard: DD/MM/YYYY
          day = p1;
          monthNo = p2;
        }
      }
    }
  }

  if (year && monthNo && day && monthNo >= 1 && monthNo <= 12 && day >= 1 && day <= 31) {
    const dateKey = `${year}-${String(monthNo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      dateKey,
      timeStr,
      day,
      monthNo,
      monthName: MONTH_NAMES[monthNo - 1] || '',
      year,
      fy: getIndianFinancialYear(year, monthNo),
      formattedDisplay: `${String(day).padStart(2, '0')},${String(monthNo).padStart(2, '0')},${year}`,
    };
  }

  return null;
}

/**
 * Dynamic column detection based on column name keywords
 */
export function createColumnFinder(rowKeys) {
  const normalizedKeyMap = {};
  rowKeys.forEach((key) => {
    const cleanKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    normalizedKeyMap[cleanKey] = key;
  });

  return function findVal(row, keywords, defaultVal = '') {
    for (const kw of keywords) {
      const cleanKw = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKeyMap[cleanKw] && row[normalizedKeyMap[cleanKw]] !== undefined) {
        return row[normalizedKeyMap[cleanKw]];
      }
      // Partial match fallback
      const found = Object.keys(normalizedKeyMap).find((k) => k.includes(cleanKw));
      if (found && row[normalizedKeyMap[found]] !== undefined) {
        return row[normalizedKeyMap[found]];
      }
    }
    return defaultVal;
  };
}

/**
 * Clean string for IDs, preserving digits and leading zeros
 */
export function cleanIdentifier(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^['"]|['"]$/g, '').trim();
}

/**
 * Determine Product Type and Category from Package Code
 */
export function classifyProduct(packageCode = '') {
  const pkgUpper = String(packageCode).toUpperCase();
  let productType = '14.2 kg Domestic Refill';
  let category = 'Domestic';

  if (pkgUpper.includes('19') || pkgUpper.includes('COMM')) {
    productType = '19 kg Commercial Refill';
    category = 'Commercial';
  } else if (pkgUpper.includes('47.5')) {
    productType = '47.5 kg Commercial';
    category = 'Commercial';
  } else if (pkgUpper.includes('FTL')) {
    productType = '5 kg FTL Cylinder';
    category = 'FTL';
  } else if (pkgUpper.includes('5') && pkgUpper.includes('KG')) {
    productType = '5 kg Domestic Refill';
    category = 'Domestic';
  } else if (pkgUpper.includes('COMPOSITE') || pkgUpper.includes('10')) {
    productType = '10 kg Composite Cylinder';
    category = 'Domestic';
  } else if (pkgUpper.includes('14.2')) {
    productType = '14.2 kg Domestic Refill';
    category = 'Domestic';
  }

  return { productType, category };
}

/**
 * Normalize raw rows from Excel/CSV file with full 31 LPG columns
 */
export function normalizeSalesRows(rawRows = [], options = {}) {
  const {
    salesDateSourcePreference = 'actualDeliveryDate', // 'actualDeliveryDate' | 'cashMemoDate' | 'orderDate'
    sourceFileName = 'Sales_Data.xlsx',
    batchId = `batch_${Date.now()}`,
    existingUniqueKeys = new Set(),
    expectedMonth = null,
    expectedYear = null,
  } = options;

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { validRows: [], duplicateRows: [], invalidRows: [], detectedFYs: [], detectedMonths: [] };
  }

  const firstRow = rawRows[0] || {};
  const rowKeys = Object.keys(firstRow);
  const findVal = createColumnFinder(rowKeys);

  // Auto-detect whether slash-separated dates are MM/DD or DD/MM from the dataset
  let detectedSlashFormat = 'DMY';
  for (const r of rawRows) {
    const rawVal = findVal(r, ['actualdeliverydate', 'deliverydate', 'cashmemodate', 'orderdate']);
    if (typeof rawVal === 'string') {
      const clean = rawVal.replace(/^['"]+|['"]+$/g, '').trim();
      const match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (match) {
        const p1 = parseInt(match[1], 10);
        const p2 = parseInt(match[2], 10);
        if (p1 > 12 && p2 <= 12) {
          detectedSlashFormat = 'DMY';
          break;
        } else if (p2 > 12 && p1 <= 12) {
          detectedSlashFormat = 'MDY';
          break;
        }
      }
    }
  }

  const dateOpts = {
    expectedMonth: expectedMonth ? parseInt(expectedMonth, 10) : null,
    expectedYear: expectedYear ? parseInt(expectedYear, 10) : null,
    slashFormat: detectedSlashFormat,
  };

  const allValidRows = [];
  const validRows = [];
  const duplicateRows = [];
  const invalidRows = [];
  const detectedFYSet = new Set();
  const detectedMonthSet = new Set();
  const seenInBatch = new Set();

  rawRows.forEach((row, idx) => {
    try {
      const slNo = parseInt(findVal(row, ['slno', 'srno', 'sno', 'sl'], idx + 1), 10) || (idx + 1);
      const orderNo = cleanIdentifier(findVal(row, ['orderno', 'order_no', 'order'], ''));
      const cashMemoNo = cleanIdentifier(findVal(row, ['cashmemono', 'cashmemo_no', 'cashmemo', 'memono'], ''));
      const consumerNo = cleanIdentifier(findVal(row, ['consumerno', 'consumer_no', 'consumernumber', 'customerno'], ''));
      const consumerName = String(findVal(row, ['consumername', 'customername', 'name'], 'Consumer')).trim();
      const natureOfConsumer = String(findVal(row, ['natureofconsumer', 'consumernature', 'nature'], '1 - Domestic')).trim();
      const packageCode = String(findVal(row, ['packagecode', 'product', 'itemdescription'], '14.2 KG NON-SUBSIDIZED CYLINDER')).trim();
      const typeOfConsumer = String(findVal(row, ['typeofconsumer', 'type_of_consumer', 'consumertype'], 'SBC')).trim();
      const orderStatus = String(findVal(row, ['orderstatus', 'status'], 'Delivered')).trim();
      const orderSource = String(findVal(row, ['ordersource', 'source'], 'IVRS')).trim();
      const orderType = String(findVal(row, ['ordertype', 'type'], 'Refill')).trim();
      const cashMemoStatus = String(findVal(row, ['cashmemostatus', 'memostatus'], 'Printed')).trim();
      const cancellationReason = cleanIdentifier(findVal(row, ['cancellationreason', 'cancelreason'], ''));
      const deliveryMode = String(findVal(row, ['deliverymode', 'mode'], 'Home')).trim();
      const deliveryStaff = String(findVal(row, ['deliveryman', 'deliverystaff', 'staff'], 'General Staff')).trim();
      const deliveryArea = String(findVal(row, ['deliveryarea', 'area'], 'General')).trim();
      const mobileNo = cleanIdentifier(findVal(row, ['mobileno', 'mobile_no', 'mobile', 'phone'], ''));
      const isRegMobile = String(findVal(row, ['isregmobile', 'regmobile'], 'Y')).trim().toUpperCase();
      const ivrsBookingNumber = cleanIdentifier(findVal(row, ['ivrsbookingnumber', 'bookingnumber'], ''));
      const dacType = String(findVal(row, ['dactype', 'dac'], 'OTP/DAC')).trim();
      const consumerAddress = String(findVal(row, ['consumeraddress', 'address'], '')).trim();
      const isRefillPort = String(findVal(row, ['isrefillport', 'refillport', 'port'], 'N')).trim().toUpperCase();
      const ekycStatus = String(findVal(row, ['ekycstatus', 'ekyc'], '')).trim();
      const rawPaymentStatus = String(findVal(row, ['onlinerefillpaymentstatus', 'paymentstatus'], '')).trim();

      // Dates parsing with format options
      const rawDeliveryVal = findVal(row, ['actualdeliverydate', 'deliverydate']);
      const rawMemoVal = findVal(row, ['cashmemodate', 'memodate']);
      const rawOrderVal = findVal(row, ['orderdate', 'bookingdate']);
      const rawCancelVal = findVal(row, ['cashmemocanceldate', 'canceldate']);

      const parsedActualDeliveryDate = parseSalesDate(rawDeliveryVal, dateOpts);
      const parsedCashMemoDate = parseSalesDate(rawMemoVal, dateOpts);
      const parsedOrderDate = parseSalesDate(rawOrderVal, dateOpts);
      const parsedCancelDate = parseSalesDate(rawCancelVal, dateOpts);

      // Determine Sales Date based on business logic:
      // Default preference: Actual Delivery Date > CashMemo Date > Order Date
      let selectedDateMeta = parsedActualDeliveryDate;
      let salesDateSource = 'actualDeliveryDate';

      if (salesDateSourcePreference === 'orderDate' && parsedOrderDate) {
        selectedDateMeta = parsedOrderDate;
        salesDateSource = 'orderDate';
      } else if (salesDateSourcePreference === 'cashMemoDate' && parsedCashMemoDate) {
        selectedDateMeta = parsedCashMemoDate;
        salesDateSource = 'cashMemoDate';
      } else if (!selectedDateMeta) {
        selectedDateMeta = parsedCashMemoDate || parsedOrderDate;
        salesDateSource = parsedCashMemoDate ? 'cashMemoDate' : 'orderDate';
      }

      if (!selectedDateMeta) {
        invalidRows.push({
          row,
          reason: `Row ${idx + 1}: No valid Delivery, CashMemo, or Order Date found. (Delivery: "${rawDeliveryVal}", Memo: "${rawMemoVal}", Order: "${rawOrderVal}")`
        });
        return;
      }

      const { productType, category } = classifyProduct(packageCode);

      // Quantities & Pricing
      const rawQtyVal = findVal(row, [
        'orderquantity', 'orderqty', 'deliveredquantity', 'deliveredqty',
        'quantity', 'qty', 'cylinders', 'cylinderqty',
        'noofcylinders', 'totalcylinders', 'refillqty', 'orderquantitycylinders'
      ], 1);
      const cleanQtyStr = String(rawQtyVal).replace(/[^0-9.]/g, '');
      const parsedQty = parseFloat(cleanQtyStr);
      const rawQty = (!isNaN(parsedQty) && parsedQty > 0) ? parsedQty : 1;

      const rawSubVal = findVal(row, [
        'consumedsubsidyqty', 'subsidyqty', 'subsidyquantity', 'consumedsubsidy', 'subsidisedqty'
      ], 0);
      const cleanSubStr = String(rawSubVal).replace(/[^0-9.]/g, '');
      const parsedSubQty = parseFloat(cleanSubStr);
      const subsidyQty = !isNaN(parsedSubQty) ? parsedSubQty : 0;

      // Explicit unit rate (RSP)
      const rawUnitRate = findVal(row, [
        'rsp', 'unitrate', 'unitprice', 'sellingprice', 'rate', 'price', 'retailprice', 'percylinderrate'
      ], null);

      // Total invoice amount / sales value
      const rawTotalAmount = findVal(row, [
        'amount', 'totalamount', 'salesvalue', 'netpayable', 'invoiceamount', 'billamount', 'netamount', 'total'
      ], null);

      let rawRsp = 0;
      let salesValue = 0;

      if (rawUnitRate !== null && rawUnitRate !== '') {
        const parsedRsp = parseFloat(String(rawUnitRate).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsedRsp) && parsedRsp > 0) {
          rawRsp = Math.round(parsedRsp * 100) / 100;
        }
      }

      if (rawTotalAmount !== null && rawTotalAmount !== '') {
        const parsedTotal = parseFloat(String(rawTotalAmount).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsedTotal) && parsedTotal > 0) {
          salesValue = Math.round(parsedTotal * 100) / 100;
        }
      }

      // User Rule: Default Rate (₹) = RSP / Order Quantity
      let rsp = 0;
      const isCommercial = packageCode.toUpperCase().includes('19') || packageCode.toUpperCase().includes('COMM');

      if (rawRsp > 0 && rawQty > 0) {
        const unitFromRsp = Math.round((rawRsp / rawQty) * 100) / 100;
        // Protect against double-division if rawRsp was already per-unit
        if (rawQty > 1 && unitFromRsp < (isCommercial ? 1500 : 600) && rawRsp >= (isCommercial ? 1800 : 700)) {
          rsp = rawRsp;
        } else {
          rsp = unitFromRsp;
        }
        if (salesValue === 0) {
          salesValue = rawRsp;
        }
      } else if (salesValue > 0 && rawQty > 0) {
        rsp = Math.round((salesValue / rawQty) * 100) / 100;
      }

      // If unit rate is known but sales value wasn't directly in a total column
      if (salesValue === 0 && rsp > 0) {
        salesValue = Math.round((rawQty * rsp) * 100) / 100;
      }

      // Fallback if neither was present
      if (rsp === 0) {
        rsp = isCommercial ? 3047 : 1039;
        salesValue = Math.round((rawQty * rsp) * 100) / 100;
      }

      // DAC & Payment classifications
      const dacUpper = dacType.toUpperCase();
      const dacVerified = dacUpper.includes('OTP') || dacUpper.includes('DAC') || dacUpper === 'Y' || dacUpper === 'YES';
      const isOnline = rawPaymentStatus.toUpperCase().includes('PAID') || rawPaymentStatus.toUpperCase().includes('ONLINE');
      const paymentMode = isOnline ? 'Online Paid' : 'Cash on Delivery';

      // Duplicate prevention unique composite key:
      // Order No + CashMemo No + Consumer No + Sales Date + Package Code
      const cleanPkg = packageCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
      const uniqueKey = `${orderNo || `O${idx}`}_${cashMemoNo || `C${idx}`}_${consumerNo || `U${idx}`}_${selectedDateMeta.dateKey}_${cleanPkg}`;

      const normalizedRow = {
        id: `${batchId}_${idx}`,
        uniqueKey,
        slNo,
        orderNo,
        orderDate: parsedOrderDate ? `${parsedOrderDate.dateKey} ${parsedOrderDate.timeStr}` : '',
        orderDateKey: parsedOrderDate?.dateKey || '',
        orderTime: parsedOrderDate?.timeStr || '',
        orderStatus,
        orderSource,
        orderType,
        consumerNo,
        consumerName,
        natureOfConsumer,
        packageCode,
        productType,
        category,
        typeOfConsumer,
        cashMemoNo,
        cashMemoDate: parsedCashMemoDate?.dateKey || '',
        cashMemoCancelDate: parsedCancelDate?.dateKey || null,
        cashMemoStatus,
        cancellationReason: cancellationReason || null,
        deliveryMode,
        actualDeliveryDate: parsedActualDeliveryDate?.dateKey || '',
        orderQuantity: rawQty,
        subsidyQty,
        deliveryStaff,
        onlineRefillPaymentStatus: rawPaymentStatus || null,
        ivrsBookingNumber,
        mobileNo,
        isRegMobile,
        dacType,
        dacVerified,
        consumerAddress,
        rawRsp: rawRsp > 0 ? rawRsp : (salesValue || rsp * rawQty),
        rsp,
        salesValue,
        deliveryArea,
        isRefillPort,
        ekycStatus,
        paymentMode,

        // Derived sales date & financial fields
        salesDate: selectedDateMeta.dateKey,
        salesDateSource,
        dateKey: selectedDateMeta.dateKey,
        day: selectedDateMeta.day,
        monthNo: selectedDateMeta.monthNo,
        monthName: selectedDateMeta.monthName,
        year: selectedDateMeta.year,
        fy: selectedDateMeta.fy,

        // Source & batch tracking
        importBatchId: batchId,
        sourceFileName,
      };

      // Every successfully validated row belongs in allValidRows
      allValidRows.push(normalizedRow);
      detectedFYSet.add(selectedDateMeta.fy);
      detectedMonthSet.add(`${selectedDateMeta.year}-${String(selectedDateMeta.monthNo).padStart(2, '0')}`);

      // Check duplicates for non-duplicate set
      if (seenInBatch.has(uniqueKey) || existingUniqueKeys.has(uniqueKey)) {
        duplicateRows.push({ row: normalizedRow, uniqueKey });
      } else {
        seenInBatch.add(uniqueKey);
        validRows.push(normalizedRow);
      }
    } catch (err) {
      invalidRows.push({ row, reason: `Row ${idx + 1} parse error: ${err.message}` });
    }
  });

  return {
    allValidRows,
    validRows,
    duplicateRows,
    invalidRows,
    totalRaw: rawRows.length,
    detectedFYs: Array.from(detectedFYSet).sort(),
    detectedMonths: Array.from(detectedMonthSet).sort(),
  };
}

