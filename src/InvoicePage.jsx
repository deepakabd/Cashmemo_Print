import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const BULK_IMPORT_TEMPLATE_HEADERS = [
  'Consumer Name',
  'Consumer No.',
  'Mobile No.',
  'Address',
  'Order Date',
  'Product',
  'Quantity',
  'Rate',
  'GSTIN',
  'Center No',
];

const BULK_IMPORT_TEMPLATE_SAMPLE = [
  {
    'Consumer Name': 'RAVI KUMAR',
    'Consumer No.': 'HP001245',
    'Mobile No.': '9876543210',
    Address: 'WARD 5, MAIN ROAD',
    'Order Date': new Date().toISOString().slice(0, 10),
    Product: 'LPG Cylinder',
    Quantity: 1,
    Rate: 1100,
    GSTIN: '',
    'Center No': 'CTR-01',
  },
];

const formatInvoiceDisplayDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB');
};

const formatInvoiceDisplayDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB');
};

const getDraftInvoiceDate = (draft = {}, fallback = '') => {
  const rawDate = String(draft?.billToDate || fallback || '').trim();
  if (!rawDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return rawDate;
  return date.toISOString().slice(0, 10);
};

const computeSavedInvoiceAmount = (draft = {}) => {
  const savedPayableTotal = Number(draft?.summary?.payableTotal);
  if (Number.isFinite(savedPayableTotal) && savedPayableTotal > 0) {
    return savedPayableTotal;
  }
  if (!Array.isArray(draft.invoiceRows)) return 0;
  return draft.invoiceRows.reduce((sum, row) => {
    const qty = Number(row.quantity) || 0;
    const rate = Number(row.customRate || row.rate || 0) || 0;
    const discount = Number(row.discount || 0) || 0;
    return sum + Math.max(0, qty * rate - discount);
  }, 0);
};

const buildSavedInvoiceHeader = ({ draft = {}, status = 'Unpaid', savedAt = '' } = {}) => ({
  name: String(draft?.billToName || '').trim(),
  mobile: String(draft?.billToMobileNo || '').trim(),
  address: String(draft?.billToAddress || '').trim(),
  date: getDraftInvoiceDate(draft, savedAt ? new Date(savedAt).toISOString().slice(0, 10) : ''),
  amount: Number(computeSavedInvoiceAmount(draft).toFixed(2)),
  amountType: status === 'Paid' ? 'Paid' : 'Due',
});

const normalizeSavedInvoiceRecord = (item = {}, fallbackIndex = 0) => {
  const draft = item?.draft || {};
  const status = item?.status || 'Unpaid';
  const savedAt = item?.savedAt || new Date().toISOString();
  const baseHeader = buildSavedInvoiceHeader({ draft, status, savedAt });
  const existingHeader = item?.header || {};

  return {
    ...item,
    id: item?.id || `invoice-${Date.now()}-${fallbackIndex}`,
    title: item?.title || `${draft.billToName || 'Unnamed Customer'}${draft.billToConsumerNo ? ` (${draft.billToConsumerNo})` : ''}`,
    savedAt,
    status,
    draft,
    header: {
      name: String(baseHeader.name || existingHeader.name || '').trim(),
      mobile: String(baseHeader.mobile || existingHeader.mobile || '').trim(),
      address: String(baseHeader.address || existingHeader.address || '').trim(),
      date: String(baseHeader.date || existingHeader.date || '').trim(),
      amount: Number(Number(baseHeader.amount || existingHeader.amount || 0).toFixed(2)),
      amountType: status === 'Paid' ? 'Paid' : 'Due',
    },
  };
};

function InvoicePage({ loggedInUser }) {
  const dealerStorageKey = String(loggedInUser?.dealerCode || loggedInUser?.profileData?.distributorCode || 'guest').trim() || 'guest';
  const invoiceDraftStorageKey = `cashmemoInvoiceDraft_${dealerStorageKey}`;
  const savedInvoicesStorageKey = `cashmemoSavedInvoices_${dealerStorageKey}`;
  const initialInvoiceRates = (() => {
    try {
      const userRates = Array.isArray(loggedInUser?.ratesData) ? loggedInUser.ratesData : null;
      const parsedRates = userRates || (() => {
        const savedRates = localStorage.getItem('ratesData');
        return savedRates ? JSON.parse(savedRates) : [];
      })();
      if (!Array.isArray(parsedRates)) return [];
      return parsedRates
        .map((rate) => ({
          Code: rate?.Code ?? '',
          HSNCode: String(rate?.HSNCode ?? '27111900').trim() || '27111900',
          Item: String(rate?.Item ?? '').trim(),
          BasicPrice: parseFloat(rate?.BasicPrice) || 0,
          SGST: parseFloat(rate?.SGST) || 0,
          CGST: parseFloat(rate?.CGST) || 0,
          RSP: parseFloat(rate?.RSP) || 0,
        }))
        .filter((rate) => rate.Item);
    } catch {
      return [];
    }
  })();

  const invoiceProfileData = loggedInUser?.profileData || {};
  const dealer = {
    name: invoiceProfileData.distributorName
      ? (invoiceProfileData.distributorCode
        ? `${invoiceProfileData.distributorName} (${invoiceProfileData.distributorCode})`
        : invoiceProfileData.distributorName)
      : '-',
    address: invoiceProfileData.address || '-',
    contact: invoiceProfileData.contact || '-',
    gstn: invoiceProfileData.gst || '-',
  };
  const defaultBankDetails = {
    bankName: '',
    branch: '',
    accountNo: '',
    ifsc: '',
  };
  const [invoiceRates] = useState(initialInvoiceRates);
  const [bankDetails, setBankDetails] = useState(defaultBankDetails);
  const [invoiceRows, setInvoiceRows] = useState([
    { id: `row-${Date.now()}`, item: '', quantity: 1, customRate: '', discount: '' },
  ]);
  const [billToName, setBillToName] = useState('');
  const [billToConsumerNo, setBillToConsumerNo] = useState('');
  const [billToMobileNo, setBillToMobileNo] = useState('');
  const [billToCenterNo, setBillToCenterNo] = useState('');
  const [billToDate, setBillToDate] = useState(new Date().toISOString().slice(0, 10));
  const [billToAddress, setBillToAddress] = useState('');
  const [billToGstin, setBillToGstin] = useState('');
  const [savedInvoices, setSavedInvoices] = useState(() => {
    try {
      const raw = localStorage.getItem(savedInvoicesStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map((item, index) => normalizeSavedInvoiceRecord(item, index)) : [];
    } catch {
      return [];
    }
  });
  const [bulkCustomers, setBulkCustomers] = useState(() => {
    try {
      const raw = localStorage.getItem(`cashmemoBulkCustomers_${dealerStorageKey}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [bulkImportErrors, setBulkImportErrors] = useState([]);
  const [quickSearchTerm, setQuickSearchTerm] = useState('');
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [savedInvoiceFilters, setSavedInvoiceFilters] = useState({
    name: '',
    mobile: '',
    address: '',
    date: '',
    amount: '',
    amountStatus: '',
  });
  const [expandedCustomerKey, setExpandedCustomerKey] = useState('');
  const bulkFileInputRef = useRef(null);
  const invoicePrintRef = useRef(null);
  const toUpperValue = (value) => (value || '').toUpperCase();

  const buildInvoiceRow = () => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    item: '',
    quantity: 1,
    customRate: '',
    discount: '',
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = billToDate ? new Date(`${billToDate}T00:00:00`) : null;
  const isPastInvoiceDate = !!selectedDate && !isNaN(selectedDate.getTime()) && selectedDate < today;

  const itemRateMap = useMemo(
    () => new Map(invoiceRates.map((rate) => [rate.Item, rate])),
    [invoiceRates]
  );
//test Cashmemo HPCL invoice 
  const lineItems = invoiceRows.map((row) => {
    const rate = itemRateMap.get(row.item) || null;
    const qty = Math.max(0, parseFloat(row.quantity) || 0);
    const sgstPct = rate?.SGST || 0;
    const cgstPct = rate?.CGST || 0;
    const fetchedRate = parseFloat(rate?.RSP) || 0;
    const customRateNum = parseFloat(row.customRate);
    const unitRate = isPastInvoiceDate && row.customRate !== '' && !isNaN(customRateNum)
      ? customRateNum
      : fetchedRate;
    const grossTotal = unitRate * qty;
    const discountInput = parseFloat(row.discount);
    const discount = Number.isFinite(discountInput) ? Math.min(Math.max(discountInput, 0), grossTotal) : 0;
    const discountedTotal = Math.max(0, grossTotal - discount);
    const gstFactor = 1 + (sgstPct / 100) + (cgstPct / 100);
    const taxable = gstFactor > 0 ? (discountedTotal / gstFactor) : discountedTotal;
    const sgst = taxable * sgstPct / 100;
    const cgst = taxable * cgstPct / 100;
    const gst = sgst + cgst;
    const total = discountedTotal;

    return {
      id: row.id,
      item: row.item,
      quantity: qty,
      rateData: rate,
      taxable,
      sgstPct,
      cgstPct,
      gstPercent: sgstPct + cgstPct,
      sgst,
      cgst,
      gst,
      unitRate,
      discount,
      total,
    };
  });

  const taxableAmount = lineItems.reduce((sum, row) => sum + row.taxable, 0);
  const sgstAmount = lineItems.reduce((sum, row) => sum + row.sgst, 0);
  const cgstAmount = lineItems.reduce((sum, row) => sum + row.cgst, 0);
  const gstAmount = sgstAmount + cgstAmount;
  const lineTotal = lineItems.reduce((sum, row) => sum + row.total, 0);
  const roundOff = Math.round(lineTotal) - lineTotal;
  const payableTotal = lineTotal + roundOff;
  const numberToWords = (num) => {
    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen',
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const belowThousand = (n) => {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
      return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${belowThousand(n % 100)}` : ''}`;
    };

    if (num === 0) return 'Zero';
    const parts = [];
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const hundred = num % 1000;

    if (crore) parts.push(`${belowThousand(crore)} Crore`);
    if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
    if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
    if (hundred) parts.push(belowThousand(hundred));
    return parts.join(' ').trim();
  };

  const rupees = Math.floor(Math.abs(payableTotal));
  const paise = Math.round((Math.abs(payableTotal) - rupees) * 100);
  const payableTotalInWords = `Rupees ${numberToWords(rupees)}${paise ? ` and ${numberToWords(paise)} Paise` : ''} Only`;

  const handleAddProduct = () => {
    setInvoiceRows((prev) => [...prev, buildInvoiceRow()]);
  };

  const buildEmptyProductRow = () => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    item: '',
    quantity: 1,
    customRate: '',
    discount: '',
  });

  const handleRemoveProduct = (rowId) => {
    setInvoiceRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const handleRowItemChange = (rowId, item) => {
    setInvoiceRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, item, customRate: '' } : row))
    );
  };

  const handleRowQuantityChange = (rowId, quantity) => {
    setInvoiceRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, quantity } : row))
    );
  };

  const handleRowRateChange = (rowId, customRate) => {
    setInvoiceRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, customRate } : row))
    );
  };

  const handleRowDiscountChange = (rowId, discount) => {
    setInvoiceRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, discount } : row))
    );
  };

  const handleClearInvoice = () => {
    setBillToDate('');
    setInvoiceRows([buildEmptyProductRow()]);
  };

  const handleResetInvoice = () => {
    setBillToName('');
    setBillToConsumerNo('');
    setBillToMobileNo('');
    setBillToCenterNo('');
    setBillToAddress('');
    setBillToGstin('');
    setBillToDate('');
    setInvoiceRows([buildEmptyProductRow()]);
  };

  const buildInvoiceDraft = () => ({
    billToName,
    billToConsumerNo,
    billToMobileNo,
    billToCenterNo,
    billToDate,
    billToAddress,
    billToGstin,
    invoiceRows: invoiceRows.map((row) => {
      const lineItem = lineItems.find((item) => item.id === row.id);
      return {
        ...row,
        rate: lineItem?.unitRate ?? (Number(row.customRate || 0) || 0),
      };
    }),
    summary: {
      taxableAmount: Number(taxableAmount.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      lineTotal: Number(lineTotal.toFixed(2)),
      roundOff: Number(roundOff.toFixed(2)),
      payableTotal: Number(payableTotal.toFixed(2)),
    },
  });

  const applyInvoiceDraft = (draft = {}) => {
    setBillToName(String(draft?.billToName || ''));
    setBillToConsumerNo(String(draft?.billToConsumerNo || ''));
    setBillToMobileNo(String(draft?.billToMobileNo || ''));
    setBillToCenterNo(String(draft?.billToCenterNo || ''));
    setBillToDate(String(draft?.billToDate || ''));
    setBillToAddress(String(draft?.billToAddress || ''));
    setBillToGstin(String(draft?.billToGstin || ''));
    setInvoiceRows(Array.isArray(draft?.invoiceRows) && draft.invoiceRows.length > 0
      ? draft.invoiceRows.map((row, index) => ({
          id: row?.id || `row-${Date.now()}-${index}`,
          item: row?.item || '',
          quantity: row?.quantity || 1,
          customRate: row?.customRate || '',
          discount: row?.discount || '',
          rate: row?.rate || 0,
        }))
      : [buildEmptyProductRow()]);
  };

  const normalizeBulkRow = (row) => {
    if (!row || typeof row !== 'object') return {};
    const normalized = {};
    Object.keys(row).forEach((key) => {
      normalized[String(key).trim()] = row[key];
    });
    return normalized;
  };

  const persistBulkCustomers = (customers) => {
    try {
      localStorage.setItem(`cashmemoBulkCustomers_${dealerStorageKey}`, JSON.stringify(customers));
    } catch {
      void 0;
    }
    setBulkCustomers(customers);
  };

  const getNormalizedInvoiceRecords = () => (
    savedInvoices.map((item, index) => {
      const draft = item.draft || {};
      const total = item.header?.amount ?? computeSavedInvoiceAmount(draft);
      return {
        id: item.id,
        sequence: index + 1,
        title: item.title || `Invoice ${index + 1}`,
        status: item.status || 'Unpaid',
        savedAt: item.savedAt,
        customerName: item.header?.name || draft.billToName || '',
        customerId: draft.billToConsumerNo || '',
        mobileNo: item.header?.mobile || draft.billToMobileNo || '',
        address: item.header?.address || draft.billToAddress || '',
        invoiceDate: item.header?.date || getDraftInvoiceDate(draft, item.savedAt),
        amountType: item.header?.amountType || (item.status === 'Paid' ? 'Paid' : 'Due'),
        total,
      };
    })
  );

  const validateBulkImportHeaders = (rows) => {
    const firstRow = Array.isArray(rows) && rows.length > 0 ? normalizeBulkRow(rows[0]) : {};
    const availableHeaders = Object.keys(firstRow);
    const normalizedAvailable = new Set(availableHeaders.map((header) => header.toLowerCase()));
    const requiredHeaders = ['consumer name', 'mobile no.', 'address'];
    const missingHeaders = requiredHeaders.filter((header) => !normalizedAvailable.has(header));
    return {
      availableHeaders,
      missingHeaders,
      isValid: missingHeaders.length === 0,
    };
  };

  const computeDraftTotal = (draft = {}) => computeSavedInvoiceAmount(draft);

  const resolveInvoiceAmount = (invoiceRecord = {}) => {
    const headerAmount = Number(invoiceRecord?.header?.amount);
    if (Number.isFinite(headerAmount) && headerAmount > 0) {
      return headerAmount;
    }

    const draftAmount = computeDraftTotal(invoiceRecord?.draft || {});
    if (Number.isFinite(draftAmount) && draftAmount > 0) {
      return draftAmount;
    }

    const draftRows = Array.isArray(invoiceRecord?.draft?.invoiceRows) ? invoiceRecord.draft.invoiceRows : [];
    return draftRows.reduce((sum, row) => {
      const qty = Number(row?.quantity) || 0;
      const fallbackRate = Number(row?.customRate || row?.rate || itemRateMap.get(row?.item || '')?.RSP || 0) || 0;
      const discount = Number(row?.discount || 0) || 0;
      return sum + Math.max(0, qty * fallbackRate - discount);
    }, 0);
  };

  const buildInvoiceDraftFromCustomer = (customer = {}) => {
    const consumerName = String(customer.consumerName || customer['Consumer Name'] || customer['consumer name'] || customer['Name'] || '').trim();
    const consumerNo = String(customer.consumerNo || customer['Consumer No.'] || customer['consumer no'] || customer.id || customer.ID || '').trim();
    const mobileNo = String(customer.mobileNo || customer['Mobile No.'] || customer['mobile no'] || customer.Phone || customer.phone || '').trim();
    const address = String(customer.address || customer.Address || customer['delivery address'] || customer['Delivery Address'] || '').trim();
    const gstin = String(customer.GSTIN || customer.gstin || customer['GSTIN'] || '').trim();
    const orderDate = String(customer.orderDate || customer['Order Date'] || customer.orderDate || '').trim();
    const product = String(customer.product || customer.Product || customer.item || customer.Item || 'LPG Cylinder').trim();
    const quantity = Number(customer.quantity || customer.qty || customer.Qty || 1) || 1;
    const customRate = String(customer.rate || customer.Rate || customer.price || customer.Price || customer['Total Amount'] || customer.Amount || '').trim();

    return {
      billToName: consumerName,
      billToConsumerNo: consumerNo,
      billToMobileNo: mobileNo,
      billToCenterNo: String(customer.centerNo || customer['Center No'] || ''),
      billToDate: orderDate ? String(new Date(orderDate).toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10),
      billToAddress: address,
      billToGstin: gstin,
      invoiceRows: [
        {
          id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          item: product,
          quantity,
          customRate,
          discount: '',
        },
      ],
    };
  };

  const handleSaveInvoiceDraft = () => {
    const draft = buildInvoiceDraft();
    localStorage.setItem(invoiceDraftStorageKey, JSON.stringify(draft));
  };

  const findCustomerSuggestion = (name) => {
    const lowerName = String(name || '').trim().toLowerCase();
    return bulkCustomers.find((customer) => String(customer.consumerName || customer['Consumer Name'] || '').trim().toLowerCase() === lowerName)
      || savedInvoices.map((item) => item.draft).find((draft) => String(draft.billToName || '').trim().toLowerCase() === lowerName);
  };

  const handleApplyNameSuggestion = (name) => {
    const suggestion = findCustomerSuggestion(name);
    if (suggestion) {
      setBillToName(String(suggestion.consumerName || suggestion['Consumer Name'] || suggestion.billToName || name));
      setBillToConsumerNo(String(suggestion.consumerNo || suggestion['Consumer No.'] || suggestion.billToConsumerNo || ''));
      setBillToMobileNo(String(suggestion.mobileNo || suggestion['Mobile No.'] || suggestion.billToMobileNo || ''));
      setBillToAddress(String(suggestion.address || suggestion.Address || suggestion.billToAddress || ''));
      setBillToGstin(String(suggestion.GSTIN || suggestion.gstin || suggestion.billToGstin || ''));
      setBillToCenterNo(String(suggestion.centerNo || suggestion['Center No'] || suggestion.billToCenterNo || ''));
    } else {
      setBillToName(name);
    }
    setShowNameSuggestions(false);
  };

  const parseBulkFileRows = (rows) => {
    const parsedRows = Array.isArray(rows) ? rows : [];
    if (parsedRows.length === 0) {
      setBulkImportErrors(['Import file contains no valid rows.']);
      persistBulkCustomers([]);
      return [];
    }

    const headerValidation = validateBulkImportHeaders(parsedRows);
    if (!headerValidation.isValid) {
      const headerList = headerValidation.availableHeaders.length > 0
        ? headerValidation.availableHeaders.join(', ')
        : 'No headers found';
      setBulkImportErrors([
        `Template validation failed. Missing required columns: ${headerValidation.missingHeaders.join(', ')}.`,
        `Available columns: ${headerList}.`,
        'Download the sample template and then re-import your customer list.',
      ]);
      persistBulkCustomers([]);
      return [];
    }

    const customers = [];
    const errors = [];
    parsedRows.forEach((rawRow, index) => {
      const row = normalizeBulkRow(rawRow);
      const consumerName = String(row['Consumer Name'] || row['consumer name'] || row['Name'] || row['name'] || '').trim();
      const consumerNo = String(row['Consumer No.'] || row['consumer no'] || row['ID'] || row['id'] || '').trim();
      const mobileNo = String(row['Mobile No.'] || row['mobile no'] || row['Phone'] || row['phone'] || '').trim();
      const address = String(row['Address'] || row['address'] || row['Delivery Address'] || row['delivery address'] || '').trim();
      const orderDate = String(row['Order Date'] || row['order date'] || row['Date'] || row['date'] || '').trim();
      const product = String(row['Product'] || row['product'] || row['Item'] || row['item'] || '').trim();
      const quantity = row['Quantity'] || row['quantity'] || row['Qty'] || row['qty'] || 1;
      const rate = String(row['Rate'] || row['rate'] || row['Unit Rate'] || row['unit rate'] || row['Price'] || row['price'] || row['Total Amount'] || row['Amount'] || '').trim();
      const gstin = String(row['GSTIN'] || row['gstin'] || row['Gstn'] || '').trim();
      const centerNo = String(row['Center No'] || row['center no'] || '').trim();
      const quantityValue = Number(quantity) || 1;

      if (!consumerName || !mobileNo || !address) {
        errors.push(`Row ${index + 2}: missing required consumer name, mobile or address.`);
        return;
      }
      if (!/^\d{10,15}$/.test(mobileNo.replace(/\D/g, ''))) {
        errors.push(`Row ${index + 2}: mobile number should have 10 to 15 digits.`);
        return;
      }
      if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
        errors.push(`Row ${index + 2}: quantity must be greater than 0.`);
        return;
      }

      customers.push({
        id: `bulk-${Date.now()}-${index}`,
        consumerName,
        consumerNo,
        mobileNo,
        address,
        orderDate,
        product: product || 'LPG Cylinder',
        quantity: quantityValue,
        rate,
        gstin,
        centerNo,
        status: 'Imported',
      });
    });

    if (customers.length === 0 && errors.length > 0) {
      persistBulkCustomers([]);
      setBulkImportErrors(errors);
      return [];
    }

    persistBulkCustomers(customers);
    setBulkImportErrors(errors);
    return customers;
  };

  const handleBulkFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileName = String(file.name || '').toLowerCase();
    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          parseBulkFileRows(results.data);
        },
        error: () => {
          setBulkImportErrors(['Unable to parse CSV file.']);
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const data = new Uint8Array(loadEvent.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          parseBulkFileRows(json);
        } catch {
          setBulkImportErrors(['Unable to parse Excel file.']);
        }
      };
      reader.onerror = () => setBulkImportErrors(['Unable to read import file.']);
      reader.readAsArrayBuffer(file);
    }
    event.target.value = '';
  };

  const handleDownloadCustomerTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet(BULK_IMPORT_TEMPLATE_SAMPLE, {
      header: BULK_IMPORT_TEMPLATE_HEADERS,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
    XLSX.writeFile(workbook, 'bulk-customer-import-template.xlsx');
  };

  const handleCreateBulkInvoices = () => {
    if (bulkCustomers.length === 0) {
      alert('Please import a customer list before generating bulk invoices.');
      return;
    }
    const newInvoices = bulkCustomers.map((customer, index) => ({
      id: `invoice-${Date.now()}-${index}`,
      title: `${customer.consumerName}${customer.consumerNo ? ` (${customer.consumerNo})` : ''}`,
      savedAt: new Date().toISOString(),
      status: 'Unpaid',
      draft: buildInvoiceDraftFromCustomer(customer),
    })).map((item, index) => normalizeSavedInvoiceRecord(item, index));
    const nextSavedInvoices = [...newInvoices, ...savedInvoices].slice(0, 200);
    setSavedInvoices(nextSavedInvoices);
    localStorage.setItem(savedInvoicesStorageKey, JSON.stringify(nextSavedInvoices));
  };

  const handleToggleInvoiceStatus = (invoiceId) => {
    const nextSavedInvoices = savedInvoices.map((item) => {
      if (item.id !== invoiceId) return item;
      return normalizeSavedInvoiceRecord({
        ...item,
        status: item.status === 'Paid' ? 'Unpaid' : 'Paid',
      });
    });
    setSavedInvoices(nextSavedInvoices);
    localStorage.setItem(savedInvoicesStorageKey, JSON.stringify(nextSavedInvoices));
  };

  const downloadCsvFile = (content, fileName) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportInvoiceSummaryCsv = () => {
    const rows = getNormalizedInvoiceRecords().map((item) => ({
      InvoiceID: item.id,
      Title: item.title,
      Status: item.status,
      SavedAt: item.savedAt,
      ConsumerName: item.customerName,
      ConsumerNo: item.customerId,
      MobileNo: item.mobileNo,
      Address: item.address,
      InvoiceDate: item.invoiceDate,
      AmountType: item.amountType,
      TotalAmount: item.total.toFixed(2),
    }));
    const csv = Papa.unparse(rows);
    downloadCsvFile(csv, `invoice-summary-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportInvoiceSummaryExcel = () => {
    const reportRows = getNormalizedInvoiceRecords().map((item) => ({
      'Invoice ID': item.id,
      'Invoice Title': item.title,
      'Payment Status': item.status,
      'Saved At': item.savedAt ? new Date(item.savedAt).toLocaleString('en-GB') : '',
      'Customer Name': item.customerName,
      'Customer ID': item.customerId,
      Phone: item.mobileNo,
      Address: item.address,
      'Invoice Date': item.invoiceDate ? formatInvoiceDisplayDate(item.invoiceDate) : '',
      'Amount Type': item.amountType,
      'Total Amount': Number(item.total.toFixed(2)),
    }));

    const summaryRows = [
      { Metric: 'Total Invoices', Value: savedInvoices.length },
      { Metric: 'Paid Invoices', Value: paidInvoices },
      { Metric: 'Unpaid Invoices', Value: unpaidInvoices },
      { Metric: 'Outstanding Amount', Value: Number(outstandingAmount.toFixed(2)) },
      { Metric: 'Collection Rate %', Value: Number(collectionRate.toFixed(1)) },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportRows), 'Invoice Report');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
    XLSX.writeFile(workbook, `invoice-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrintSummaryReport = () => {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert('Unable to open report window. Please allow pop-ups.');
      return;
    }
    const paidCount = savedInvoices.filter((item) => item.status === 'Paid').length;
    const unpaidCount = savedInvoices.filter((item) => item.status !== 'Paid').length;
    const outstanding = savedInvoices.reduce((sum, item) => {
      if (item.status !== 'Paid') return sum + computeDraftTotal(item.draft);
      return sum;
    }, 0);
    const content = `
      <html>
        <head>
          <title>Invoice Summary Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 22px; margin-bottom: 8px; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <h1>Invoice Summary Report</h1>
          <div>Total invoices: ${savedInvoices.length}</div>
          <div>Paid invoices: ${paidCount}</div>
          <div>Unpaid invoices: ${unpaidCount}</div>
          <div>Outstanding amount: ₹${outstanding.toFixed(2)}</div>
          <table>
            <thead>
              <tr><th>Invoice</th><th>Status</th><th>Customer</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${savedInvoices.map((item) => `
                <tr>
                  <td>${item.title}</td>
                  <td>${item.status}</td>
                  <td>${item.header?.name || item.draft?.billToName || ''}</td>
                  <td>₹${computeDraftTotal(item.draft).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    reportWindow.document.write(content);
    reportWindow.document.close();
    setTimeout(() => reportWindow.print(), 300);
  };

  const handlePrintLedger = (group) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Unable to open print window. Please allow pop-ups.');
      return;
    }
    const content = `
      <html>
        <head>
          <title>Consumer Ledger - ${group.customerName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h1 { font-size: 22px; margin-bottom: 20px; color: #1d4f91; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; background: #f8fbff; padding: 15px; border: 1px solid #d7e3f4; border-radius: 8px; font-size: 14px; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; font-size: 14px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f4f7fb; color: #35506f; }
            .status-paid { color: #2e7d32; font-weight: bold; }
            .status-due { color: #c62828; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Consumer Ledger - ${group.customerName}</h1>
          <div class="info-grid">
            <div><strong>Name:</strong><br/>${group.customerName || '-'}</div>
            <div><strong>Mobile:</strong><br/>${group.mobile || '-'}</div>
            <div><strong>Address:</strong><br/>${group.address || '-'}</div>
            <div><strong>Latest Date:</strong><br/>${formatInvoiceDisplayDate(group.latestDate)}</div>
            <div><strong>Grand Total Amount:</strong><br/>₹${group.totalAmount.toFixed(2)}</div>
            <div><strong>Grand Total Status:</strong><br/><span class="${group.dueAmount > 0 ? 'status-due' : 'status-paid'}">${group.dueAmount > 0 ? `Due ₹${group.dueAmount.toFixed(2)}` : `Paid ₹${group.paidAmount.toFixed(2)}`}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Saved At</th>
              </tr>
            </thead>
            <tbody>
              ${group.entries.map((item) => `
                <tr>
                  <td>${formatInvoiceDisplayDate(item.resolvedDate)}</td>
                  <td>${item.title}</td>
                  <td>₹${item.resolvedAmount.toFixed(2)}</td>
                  <td class="${item.resolvedAmountStatus === 'Paid' ? 'status-paid' : 'status-due'}">${item.resolvedAmountStatus}</td>
                  <td>${formatInvoiceDisplayDateTime(item.savedAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const filteredSavedInvoices = useMemo(() => {
    const query = String(quickSearchTerm || '').trim().toLowerCase();
    const filters = {
      name: String(savedInvoiceFilters.name || '').trim().toLowerCase(),
      mobile: String(savedInvoiceFilters.mobile || '').trim().toLowerCase(),
      address: String(savedInvoiceFilters.address || '').trim().toLowerCase(),
      date: String(savedInvoiceFilters.date || '').trim().toLowerCase(),
      amount: String(savedInvoiceFilters.amount || '').trim().toLowerCase(),
      amountStatus: String(savedInvoiceFilters.amountStatus || '').trim().toLowerCase(),
    };

    return savedInvoices.filter((item) => {
      const draft = item.draft || {};
      const amount = String(resolveInvoiceAmount(item).toFixed(2)).toLowerCase();
      const amountStatus = String(item.header?.amountType || (item.status === 'Paid' ? 'Paid' : 'Due')).toLowerCase();
      const matchesQuickSearch = !query || [
        item.id,
        item.title,
        item.header?.name,
        draft.billToName,
        draft.billToConsumerNo,
        item.header?.mobile,
        draft.billToMobileNo,
        item.header?.address,
        draft.billToAddress,
        item.header?.date,
      ]
        .some((value) => String(value || '').toLowerCase().includes(query));
      if (!matchesQuickSearch) return false;

      return (
        String(item.header?.name || draft.billToName || '').toLowerCase().includes(filters.name)
        && String(item.header?.mobile || draft.billToMobileNo || '').toLowerCase().includes(filters.mobile)
        && String(item.header?.address || draft.billToAddress || '').toLowerCase().includes(filters.address)
        && String(item.header?.date || getDraftInvoiceDate(draft, item.savedAt) || '').toLowerCase().includes(filters.date)
        && amount.includes(filters.amount)
        && amountStatus.includes(filters.amountStatus)
      );
    });
  }, [quickSearchTerm, resolveInvoiceAmount, savedInvoiceFilters, savedInvoices]);

  const filteredBulkCustomers = useMemo(() => {
    const query = String(quickSearchTerm || '').trim().toLowerCase();
    if (!query) return bulkCustomers;
    return bulkCustomers.filter((customer) => {
      return [customer.consumerName, customer.consumerNo, customer.mobileNo, customer.address]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [quickSearchTerm, bulkCustomers]);

  const groupedSavedInvoices = useMemo(() => {
    const groups = filteredSavedInvoices.reduce((acc, item) => {
      const customerName = String(item.header?.name || item.draft?.billToName || 'Unnamed Customer').trim();
      const consumerNo = String(item.draft?.billToConsumerNo || '').trim();
      const mobile = String(item.header?.mobile || item.draft?.billToMobileNo || '').trim();
      const address = String(item.header?.address || item.draft?.billToAddress || '').trim();
      const customerKey = String(consumerNo || mobile || customerName || item.id).trim().toLowerCase();
      const amount = resolveInvoiceAmount(item);
      const amountStatus = item.header?.amountType || (item.status === 'Paid' ? 'Paid' : 'Due');
      const invoiceDate = item.header?.date || getDraftInvoiceDate(item.draft, item.savedAt);

      if (!acc[customerKey]) {
        acc[customerKey] = {
          key: customerKey,
          customerName,
          mobile,
          address,
          latestDate: invoiceDate,
          totalAmount: 0,
          dueAmount: 0,
          paidAmount: 0,
          entries: [],
        };
      }

      acc[customerKey].entries.push({
        ...item,
        resolvedAmount: amount,
        resolvedAmountStatus: amountStatus,
        resolvedDate: invoiceDate,
      });
      acc[customerKey].totalAmount += amount;
      if (amountStatus === 'Paid') {
        acc[customerKey].paidAmount += amount;
      } else {
        acc[customerKey].dueAmount += amount;
      }
      if (String(invoiceDate || '') > String(acc[customerKey].latestDate || '')) {
        acc[customerKey].latestDate = invoiceDate;
      }

      return acc;
    }, {});

    return Object.values(groups)
      .map((group) => ({
        ...group,
        entries: group.entries.sort((a, b) => String(b.resolvedDate || b.savedAt || '').localeCompare(String(a.resolvedDate || a.savedAt || ''))),
      }))
      .sort((a, b) => String(a.customerName || '').localeCompare(String(b.customerName || '')));
  }, [filteredSavedInvoices, resolveInvoiceAmount]);

  const customerNameSuggestions = useMemo(() => {
    const names = new Set();
    bulkCustomers.forEach((customer) => {
      const name = String(customer.consumerName || customer['Consumer Name'] || '').trim();
      if (name) names.add(name);
    });
    savedInvoices.forEach((item) => {
      const name = String(item.draft?.billToName || '').trim();
      if (name) names.add(name);
    });
    return Array.from(names);
  }, [bulkCustomers, savedInvoices]);

  const autoCompleteSuggestions = useMemo(() => {
    const query = String(billToName || '').trim().toLowerCase();
    if (!query || query.length < 2) return [];
    return customerNameSuggestions
      .filter((name) => name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [billToName, customerNameSuggestions]);

  const paidInvoices = savedInvoices.filter((item) => item.status === 'Paid').length;
  const unpaidInvoices = savedInvoices.filter((item) => item.status !== 'Paid').length;
  const outstandingAmount = savedInvoices.reduce((sum, item) => (
    item.status !== 'Paid' ? sum + computeDraftTotal(item.draft) : sum
  ), 0);
  const paidAmount = savedInvoices.reduce((sum, item) => (
    item.status === 'Paid' ? sum + computeDraftTotal(item.draft) : sum
  ), 0);
  const totalInvoiceAmount = paidAmount + outstandingAmount;
  const collectionRate = totalInvoiceAmount > 0 ? (paidAmount / totalInvoiceAmount) * 100 : 0;
  const averageInvoiceValue = savedInvoices.length > 0 ? totalInvoiceAmount / savedInvoices.length : 0;

  const handleSaveInvoiceRecord = () => {
    const draft = buildInvoiceDraft();
    const invoiceRecord = normalizeSavedInvoiceRecord({
      id: `invoice-${Date.now()}`,
      title: `${draft.billToName || 'Unnamed Customer'}${draft.billToConsumerNo ? ` (${draft.billToConsumerNo})` : ''}`,
      savedAt: new Date().toISOString(),
      status: 'Unpaid',
      draft,
    });
    const nextSavedInvoices = [invoiceRecord, ...savedInvoices].slice(0, 200);
    setSavedInvoices(nextSavedInvoices);
    localStorage.setItem(savedInvoicesStorageKey, JSON.stringify(nextSavedInvoices));
    localStorage.setItem(invoiceDraftStorageKey, JSON.stringify(draft));
  };

  const handleDuplicateSavedInvoice = (invoiceRecord) => {
    applyInvoiceDraft(invoiceRecord?.draft || {});
    localStorage.setItem(invoiceDraftStorageKey, JSON.stringify(invoiceRecord?.draft || {}));
  };

  const handleDeleteSavedInvoice = (invoiceId) => {
    const nextSavedInvoices = savedInvoices.filter((item) => item.id !== invoiceId);
    setSavedInvoices(nextSavedInvoices);
    localStorage.setItem(savedInvoicesStorageKey, JSON.stringify(nextSavedInvoices));
  };

  const handlePrintInvoice = () => {
    if (!invoicePrintRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Unable to open print window. Please allow pop-ups.');
      return;
    }
    const liveSelectTexts = Array.from(invoicePrintRef.current.querySelectorAll('select')).map((selectEl) => {
      return selectEl.options?.[selectEl.selectedIndex]?.text || selectEl.value || '';
    });
    const printClone = invoicePrintRef.current.cloneNode(true);
    printClone.querySelectorAll('select').forEach((selectEl, index) => {
      const selectedText = liveSelectTexts[index] || '';
      const valueNode = document.createElement('span');
      valueNode.className = 'print-select-value';
      valueNode.textContent = selectedText;
      selectEl.replaceWith(valueNode);
    });
    printClone.querySelectorAll('input, textarea').forEach((fieldEl) => {
      const fieldValue = (fieldEl.value || '').trim();
      const isOptionalBillToField =
        fieldEl.classList.contains('billto-consumerno') ||
        fieldEl.classList.contains('billto-centerno') ||
        fieldEl.classList.contains('billto-gstin');
      const isBillToDateField = fieldEl.classList.contains('billto-date');

      if (isOptionalBillToField && !fieldValue) {
        const fieldWrapper = fieldEl.closest('.billto-field');
        if (fieldWrapper) {
          fieldWrapper.remove();
        } else {
          fieldEl.remove();
        }
        return;
      }

      const valueNode = document.createElement('span');
      if (isBillToDateField) {
        const dt = fieldValue ? new Date(`${fieldValue}T00:00:00`) : null;
        const formattedDate = dt && !isNaN(dt.getTime())
          ? `${String(dt.getDate()).padStart(2, '0')}-${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][dt.getMonth()]}-${dt.getFullYear()}`
          : '';
        valueNode.className = `${fieldEl.className} print-field-value print-date-value`;
        valueNode.textContent = formattedDate ? `Date: - ${formattedDate}` : 'Date: -';
      } else {
        valueNode.className = fieldEl.tagName === 'TEXTAREA'
          ? `${fieldEl.className} print-field-value print-field-textarea`
          : `${fieldEl.className} print-field-value`;
        valueNode.textContent = fieldValue;
      }
      fieldEl.replaceWith(valueNode);
    });
    const printConsumerNo = printClone.querySelector('.billto-consumerno.print-field-value');
    const printDateValue = printClone.querySelector('.billto-date.print-date-value');
    if (printConsumerNo && printDateValue) {
      const dateStrong = document.createElement('strong');
      dateStrong.className = 'print-date-inline';
      dateStrong.textContent = printDateValue.textContent;
      printConsumerNo.classList.add('print-consumerno-with-date');
      printConsumerNo.appendChild(dateStrong);
      const dateRow = printDateValue.closest('.billto-date-row');
      if (dateRow) {
        dateRow.remove();
      }
    }
    // A print popup starts as about:blank. Set a base URL explicitly so assets
    // and the Vite-generated stylesheet keep resolving after deployment too.
    // Do not copy the app's complete stylesheet into the popup. The live app
    // also contains print rules for other pages; copying them to about:blank
    // can hide every element in this invoice popup.
    const styles = '';
    const printBaseUrl = new URL('./', document.baseURI).href;
    const printOnlyStyles = `
      <style>
        @page {
          margin: 6mm;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
        }
        body {
          display: block !important;
          place-items: initial !important;
          align-items: initial !important;
          justify-content: initial !important;
          overflow: auto !important;
          color: #000 !important;
          background: #fff !important;
          font-family: Arial, Helvetica, sans-serif !important;
        }
        *, *::before, *::after { visibility: visible !important; }
        .book-view {
          display: block !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .invoice-container {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 12px !important;
          box-sizing: border-box !important;
          color: #000 !important;
          background: #fff !important;
          border: 1px solid #5f6b7c !important;
          font-size: 12px !important;
        }
        .invoice-header { padding: 6px 6px 8px !important; border-bottom: 2px solid #9aa6b8 !important; background: #eaf4ff !important; }
        .invoice-brand { display: grid !important; grid-template-columns: 180px 1fr !important; align-items: center !important; gap: 8px !important; }
        .invoice-brand-logo { display: flex !important; align-items: center !important; justify-content: center !important; }
        .invoice-brand-details { min-width: 0 !important; }
        .invoice-grid { display: grid !important; grid-template-columns: 1fr !important; gap: 10px !important; margin-top: 10px !important; padding-bottom: 10px !important; }
        .section-box { position: relative !important; padding: 8px !important; border: 1px solid #aeb8c7 !important; border-radius: 4px !important; background: #f9fbff !important; }
        .section-label { display: inline-block !important; margin: -18px 0 6px !important; padding: 2px 6px !important; border: 1px solid #aeb8c7 !important; border-radius: 4px !important; color: #1f4fb2 !important; background: #eaf4ff !important; font-size: 11px !important; }
        .billto-form { display: grid !important; grid-template-columns: 1.5fr .9fr !important; gap: 6px !important; }
        .billto-field label { display: block !important; margin: 2px 0 !important; color: #1f2937 !important; font-size: 11px !important; font-weight: 700 !important; }
        .billto-inline-row { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
        .billto-address, .billto-gstin, .billto-date-row { grid-column: 1 / -1 !important; }
        .billto-date-row { display: flex !important; justify-content: flex-end !important; }
        .invoice-table, .summary-table { width: 100% !important; border-collapse: collapse !important; }
        .invoice-table { margin-top: 10px !important; font-size: 9px !important; }
        .invoice-table th, .invoice-table td, .summary-table td { border: 1px solid #9ea9ba !important; padding: 4px 5px !important; text-align: left !important; color: #000 !important; }
        .invoice-table th { background: #f1f5f9 !important; font-weight: 700 !important; }
        .invoice-summary { display: grid !important; grid-template-columns: 2fr 1fr !important; gap: 10px !important; margin-top: 10px !important; }
        .summary-box, .invoice-footer > div { padding: 8px !important; border: 1px solid #aeb8c7 !important; border-radius: 4px !important; background: #f9fbff !important; }
        .summary-header { padding: 6px 8px !important; margin-bottom: 6px !important; border: 1px solid #aeb8c7 !important; color: #1f4fb2 !important; background: #eaf4ff !important; font-weight: 700 !important; }
        .invoice-total-words-bar { margin-top: 10px !important; padding: 8px 10px !important; border: 1px solid #dfe3eb !important; background: #eef4ff !important; }
        .invoice-footer { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 10px !important; margin-top: 10px !important; font-size: 11px !important; }
        .invoice-bottom { margin-top: 10px !important; color: #1f4fb2 !important; text-align: center !important; font-weight: 600 !important; }
        }
        .invoice-tax-label {
          font-size: 12px !important;
          margin-bottom: 4px !important;
        }
        .invoice-header {
          padding: 6px 6px 8px 6px !important;
          gap: 8px !important;
        }
        .invoice-brand {
          grid-template-columns: 180px 1fr !important;
          gap: 8px !important;
        }
        .invoice-logo-image {
          width: 180px !important;
          height: 60px !important;
        }
        .invoice-title {
          font-size: 14px !important;
          line-height: 1.2 !important;
          letter-spacing: 0 !important;
        }
        .invoice-sub {
          font-size: 10px !important;
          line-height: 1.25 !important;
        }
        .invoice-table {
          width: 100% !important;
          table-layout: fixed !important;
        }
        .invoice-table th,
        .invoice-table td {
          padding: 4px 5px !important;
          word-break: break-word !important;
          white-space: normal !important;
        }
        .invoice-table thead th {
          font-size: 10px !important;
          line-height: 1.15 !important;
        }
        .invoice-table tbody td {
          font-size: 9px !important;
        }
        .invoice-table th:nth-child(2),
        .invoice-table td:nth-child(2) {
          width: 34% !important;
          min-width: 0 !important;
        }
        .invoice-table th:nth-child(1),
        .invoice-table td:nth-child(1) {
          width: 4% !important;
        }
        .invoice-table th:nth-child(3),
        .invoice-table td:nth-child(3) {
          width: 6% !important;
        }
        .invoice-table th:nth-child(4),
        .invoice-table td:nth-child(4) {
          width: 9% !important;
        }
        .invoice-table th:nth-child(5),
        .invoice-table td:nth-child(5),
        .invoice-table th:nth-child(6),
        .invoice-table td:nth-child(6),
        .invoice-table th:nth-child(7),
        .invoice-table td:nth-child(7),
        .invoice-table th:nth-child(8),
        .invoice-table td:nth-child(8),
        .invoice-table th:nth-child(9),
        .invoice-table td:nth-child(9),
        .invoice-table th:nth-child(10),
        .invoice-table td:nth-child(10) {
          width: 7% !important;
        }
        .invoice-actions,
        .invoice-row-remove {
          display: none !important;
        }
        .invoice-table th:last-child,
        .invoice-table td:last-child {
          display: none !important;
        }
        .print-select-value {
          display: inline-block;
          width: 100%;
          box-sizing: border-box;
          padding: 6px 8px;
          font-size: 11px;
          line-height: 1.3;
          word-break: break-word;
        }
        .print-field-value {
          display: inline-block;
          width: 100%;
          box-sizing: border-box;
          padding: 6px 8px;
          font-size: 11px;
          line-height: 1.3;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .print-field-textarea {
          min-height: 54px;
        }
        .print-consumerno-with-date {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .print-date-inline {
          font-weight: 700;
          white-space: nowrap;
        }
      </style>
    `;
    const html = `
      <html>
        <head>
          <title>Invoice</title>
          <base href="${printBaseUrl}">
          ${styles}
          ${printOnlyStyles}
        </head>
        <body>
          <div class="book-view">
            ${printClone.outerHTML}
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    let printed = false;
    const triggerPrint = async () => {
      if (printed) return;
      printed = true;
      const images = Array.from(printWindow.document.images || []);
      await Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }));
      await printWindow.document.fonts?.ready;
      printWindow.scrollTo(0, 0);
      printWindow.focus();
      printWindow.print();
    };
    printWindow.addEventListener('load', triggerPrint, { once: true });
    // Some browsers mark a document written with document.write as complete
    // before the listener is attached.
    if (printWindow.document.readyState === 'complete') {
      void triggerPrint();
    }
    window.setTimeout(() => void triggerPrint(), 2500);
  };

  useEffect(() => {
    const handleShortcuts = (event) => {
      if (!event.ctrlKey) return;
      const key = event.key?.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        handleSaveInvoiceDraft();
      }
      if (key === 'p') {
        event.preventDefault();
        handlePrintInvoice();
      }
      if (event.shiftKey && key === 'a') {
        event.preventDefault();
        handleAddProduct();
      }
      if (key === 'r') {
        event.preventDefault();
        handleResetInvoice();
      }
      if (key === 'enter') {
        event.preventDefault();
        handleSaveInvoiceRecord();
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [handleSaveInvoiceDraft, handlePrintInvoice, handleAddProduct, handleResetInvoice, handleSaveInvoiceRecord]);

  useEffect(() => {
    if (loggedInUser?.bankDetailsData) {
      setBankDetails((prev) => ({ ...prev, ...loggedInUser.bankDetailsData }));
    } else {
      setBankDetails(defaultBankDetails);
    }
  }, [loggedInUser?.bankDetailsData]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(invoiceDraftStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        applyInvoiceDraft(parsed);
      }
    } catch {
      void 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceDraftStorageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(savedInvoicesStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setSavedInvoices(Array.isArray(parsed) ? parsed.map((item, index) => normalizeSavedInvoiceRecord(item, index)) : []);
    } catch {
      setSavedInvoices([]);
    }
  }, [savedInvoicesStorageKey]);

  useEffect(() => {
    if (!groupedSavedInvoices.some((group) => group.key === expandedCustomerKey)) {
      setExpandedCustomerKey('');
    }
  }, [expandedCustomerKey, groupedSavedInvoices]);

  return (
    <div className="placeholder-container">
      <div className="support-status-panel" style={{ marginBottom: '18px' }}>
        <div className="support-status-panel__header">
          <h3>Invoice Intelligence</h3>
          <span>{savedInvoices.length} saved invoices</span>
        </div>
        <div className="form-actions" style={{ flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-start' }}>
          <input
            type="text"
            value={quickSearchTerm}
            onChange={(e) => setQuickSearchTerm(e.target.value)}
            placeholder="Search customer name, phone, ID, or invoice..."
            style={{ minWidth: '220px', padding: '8px 10px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
          <button type="button" onClick={() => bulkFileInputRef.current?.click()}>Import Customers</button>
          <button type="button" onClick={handleCreateBulkInvoices} disabled={!bulkCustomers.length}>Create Bulk Invoices</button>
          <button type="button" onClick={handleDownloadCustomerTemplate}>Download Template</button>
          <button type="button" onClick={handleExportInvoiceSummaryExcel} disabled={!savedInvoices.length}>Export Excel</button>
          <button type="button" onClick={handleExportInvoiceSummaryCsv} disabled={!savedInvoices.length}>Export CSV</button>
          <button type="button" onClick={handlePrintSummaryReport} disabled={!savedInvoices.length}>Export PDF Report</button>
          <button type="button" onClick={handleSaveInvoiceDraft}>Save Draft (Ctrl+S)</button>
        </div>
        <input ref={bulkFileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleBulkFileSelect} style={{ display: 'none' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', margin: '14px 0' }}>
          <div style={{ background: '#f7f9fc', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: '#555' }}>Total Invoices</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{savedInvoices.length}</div>
          </div>
          <div style={{ background: '#f7f9fc', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: '#555' }}>Imported Customers</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{bulkCustomers.length}</div>
          </div>
          <div style={{ background: '#f7f9fc', padding: '12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: '#555' }}>Outstanding Amount</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>₹{savedInvoices.reduce((sum, item) => item.status !== 'Paid' ? sum + computeDraftTotal(item.draft) : sum, 0).toFixed(2)}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #d8e4f5', background: '#eef6ff', textAlign: 'left' }}>
            <div style={{ fontSize: '0.78rem', color: '#4f6b8a', textTransform: 'uppercase', fontWeight: 700 }}>Payment Status Dashboard</div>
            <div style={{ marginTop: '8px', fontSize: '1.6rem', fontWeight: 800, color: '#1d4f91' }}>{paidInvoices} paid / {unpaidInvoices} unpaid</div>
            <div style={{ marginTop: '6px', color: '#516a85', fontSize: '0.92rem' }}>
              Outstanding receivables stay visible while you track invoice closures.
            </div>
          </div>
          <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #eadfb2', background: '#fff8dd', textAlign: 'left' }}>
            <div style={{ fontSize: '0.78rem', color: '#8a6a12', textTransform: 'uppercase', fontWeight: 700 }}>Bulk Import Validation</div>
            <div style={{ marginTop: '8px', fontWeight: 700, color: '#5f4b10' }}>
              Required columns: Consumer Name, Mobile No., Address
            </div>
            <div style={{ marginTop: '6px', color: '#6f5f2a', fontSize: '0.92rem' }}>
              Download the template first to import customer lists cleanly.
            </div>
          </div>
          <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #d8ead9', background: '#edf9ee', textAlign: 'left' }}>
            <div style={{ fontSize: '0.78rem', color: '#25663a', textTransform: 'uppercase', fontWeight: 700 }}>Keyboard Shortcuts</div>
            <div style={{ marginTop: '8px', color: '#214d2f', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Ctrl+S save draft, Ctrl+P print invoice, Ctrl+Shift+A add row, Ctrl+R reset, Ctrl+Enter save invoice record.
            </div>
          </div>
        </div>
        {bulkImportErrors.length > 0 && (
          <div style={{ marginBottom: '10px', color: '#b71c1c', background: '#ffe6e6', padding: '10px', borderRadius: '6px' }}>
            <strong>Import issues:</strong>
            <ul style={{ margin: '8px 0 0 16px' }}>
              {bulkImportErrors.map((error, index) => <li key={`bulk-error-${index}`}>{error}</li>)}
            </ul>
          </div>
        )}
        {bulkCustomers.length > 0 && (
          <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', background: '#fff9e3', border: '1px solid #f0e5b5' }}>
            <strong>{bulkCustomers.length} customers imported</strong>
            <div style={{ marginTop: '6px', fontSize: '0.92rem', color: '#555' }}>
              You can now create bulk invoices from imported customer data or search saved invoices above.
            </div>
          </div>
        )}
        {filteredBulkCustomers.length > 0 && (
          <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', background: '#f8fbff', border: '1px solid #dde8f7' }}>
            <div className="support-status-panel__header" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Quick Customer Search</h4>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>{filteredBulkCustomers.length} match</span>
            </div>
            <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
              {filteredBulkCustomers.slice(0, 6).map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => handleApplyNameSuggestion(customer.consumerName)}
                  style={{ textAlign: 'left', border: '1px solid #d7e3f4', background: '#fff', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer' }}
                >
                  <strong>{customer.consumerName}</strong>
                  <div style={{ marginTop: '4px', color: '#586b84', fontSize: '0.9rem' }}>
                    {customer.mobileNo} {customer.consumerNo ? `| ID: ${customer.consumerNo}` : ''} {customer.centerNo ? `| Center: ${customer.centerNo}` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom: '14px' }}>
          <div className="support-status-panel__header" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Saved Invoice Records</h4>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>{groupedSavedInvoices.length} consumers shown</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', margin: '10px 0' }}>
            <input className="invoice-input" value={savedInvoiceFilters.name} onChange={(e) => setSavedInvoiceFilters((prev) => ({ ...prev, name: e.target.value }))} placeholder="Search name" />
            <input className="invoice-input" value={savedInvoiceFilters.mobile} onChange={(e) => setSavedInvoiceFilters((prev) => ({ ...prev, mobile: e.target.value }))} placeholder="Search mobile" />
            <input className="invoice-input" value={savedInvoiceFilters.address} onChange={(e) => setSavedInvoiceFilters((prev) => ({ ...prev, address: e.target.value }))} placeholder="Search address" />
            <input className="invoice-input" value={savedInvoiceFilters.date} onChange={(e) => setSavedInvoiceFilters((prev) => ({ ...prev, date: e.target.value }))} placeholder="Search date" />
            <input className="invoice-input" value={savedInvoiceFilters.paidAmount} onChange={(e) => setSavedInvoiceFilters((prev) => ({ ...prev, paidAmount: e.target.value }))} placeholder="Search paid" />
            <input className="invoice-input" value={savedInvoiceFilters.dueAmount} onChange={(e) => setSavedInvoiceFilters((prev) => ({ ...prev, dueAmount: e.target.value }))} placeholder="Search due" />
            <input className="invoice-input" value={savedInvoiceFilters.amount} onChange={(e) => setSavedInvoiceFilters((prev) => ({ ...prev, amount: e.target.value }))} placeholder="Search total" />
            <input className="invoice-input" value={savedInvoiceFilters.amountStatus} onChange={(e) => setSavedInvoiceFilters((prev) => ({ ...prev, amountStatus: e.target.value }))} placeholder="Search status" />
          </div>
          {groupedSavedInvoices.length === 0 ? (
            <div className="support-status-panel__empty">No matching invoices found.</div>
          ) : (
            <div className="table-container" style={{ maxHeight: 'none', marginTop: '10px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>Address</th>
                    <th>Date</th>
                    <th>Paid Amount</th>
                    <th>Due Amount</th>
                    <th>Total Amount</th>
                    <th>Amount Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedSavedInvoices.map((group) => {
                    const isExpanded = expandedCustomerKey === group.key;
                    return (
                      <Fragment key={group.key}>
                        <tr key={group.key}>
                          <td>
                            <button
                              type="button"
                              onClick={() => setExpandedCustomerKey(isExpanded ? '' : group.key)}
                              style={{ border: 'none', background: 'transparent', padding: 0, color: '#0d6efd', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                            >
                              {group.customerName || '-'}
                            </button>
                          </td>
                          <td>{group.mobile || '-'}</td>
                          <td>{group.address || '-'}</td>
                          <td>{formatInvoiceDisplayDate(group.latestDate)}</td>
                          <td style={{ color: '#2e7d32' }}>₹{group.paidAmount.toFixed(2)}</td>
                          <td style={{ color: '#c62828' }}>₹{group.dueAmount.toFixed(2)}</td>
                          <td style={{ fontWeight: 700 }}>₹{group.totalAmount.toFixed(2)}</td>
                          <td style={{ color: group.dueAmount > 0 ? '#c62828' : '#2e7d32', fontWeight: 700 }}>
                            {group.dueAmount > 0 ? `Due ₹${group.dueAmount.toFixed(2)}` : `Paid ₹${group.paidAmount.toFixed(2)}`}
                          </td>
                          <td>{group.entries.length} record</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                  {false && filteredSavedInvoices.map((item) => (
                    <tr key={item.id}>
                      <td>{item.header?.name || item.draft?.billToName || '-'}</td>
                      <td>{item.header?.mobile || item.draft?.billToMobileNo || '-'}</td>
                      <td>{item.header?.address || item.draft?.billToAddress || '-'}</td>
                      <td>{formatInvoiceDisplayDate(item.header?.date || item.savedAt)}</td>
                      <td>₹{(item.header?.amount ?? computeDraftTotal(item.draft)).toFixed(2)}</td>
                      <td style={{ color: item.status === 'Paid' ? '#2e7d32' : '#c62828', fontWeight: 700 }}>
                        {item.header?.amountType || (item.status === 'Paid' ? 'Paid' : 'Due')}
                      </td>
                      <td>
                        <div className="form-actions" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
                          <button type="button" onClick={() => handleDuplicateSavedInvoice(item)}>Open</button>
                          <button type="button" onClick={() => handleToggleInvoiceStatus(item.id)}>{item.status === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}</button>
                          <button type="button" onClick={() => handleDeleteSavedInvoice(item.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(() => {
            const expandedGroup = groupedSavedInvoices.find(g => g.key === expandedCustomerKey);
            if (!expandedGroup) return null;
            return (
              <div className="admin-chat-popup-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="dialog" aria-modal="true">
                <div className="admin-chat-popup" style={{ width: '90%', maxWidth: '1000px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                  <div className="admin-chat-popup-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Consumer Ledger - {expandedGroup.customerName}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="button" className="btn-print-invoice" style={{ padding: '6px 12px', fontSize: '0.85rem', margin: 0 }} onClick={() => handlePrintLedger(expandedGroup)}>Export to PDF</button>
                      <button type="button" className="admin-chat-popup-close" onClick={() => setExpandedCustomerKey('')}>Close</button>
                    </div>
                  </div>
                  <div className="admin-chat-popup-body" style={{ padding: '20px', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px', marginBottom: '20px', background: '#f8fbff', padding: '15px', borderRadius: '8px', border: '1px solid #d7e3f4', fontSize: '0.95rem' }}>
                      <div><strong style={{ color: '#555' }}>Name</strong> <br/><span style={{ fontWeight: 600 }}>{expandedGroup.customerName || '-'}</span></div>
                      <div><strong style={{ color: '#555' }}>Mobile</strong> <br/><span style={{ fontWeight: 600 }}>{expandedGroup.mobile || '-'}</span></div>
                      <div><strong style={{ color: '#555' }}>Address</strong> <br/><span style={{ fontWeight: 600 }}>{expandedGroup.address || '-'}</span></div>
                      <div><strong style={{ color: '#555' }}>Date</strong> <br/><span style={{ fontWeight: 600 }}>{formatInvoiceDisplayDate(expandedGroup.latestDate)}</span></div>
                      <div><strong style={{ color: '#555' }}>Grand Total Amount</strong> <br/><span style={{ fontWeight: 700, color: '#1d4f91' }}>₹{expandedGroup.totalAmount.toFixed(2)}</span></div>
                      <div>
                        <strong style={{ color: '#555' }}>Grand Total Status</strong> <br/>
                        <span style={{ color: expandedGroup.dueAmount > 0 ? '#c62828' : '#2e7d32', fontWeight: 700 }}>
                          {expandedGroup.dueAmount > 0 ? `Due ₹${expandedGroup.dueAmount.toFixed(2)}` : `Paid ₹${expandedGroup.paidAmount.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Invoice</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Saved At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedGroup.entries.map((item) => (
                          <tr key={item.id}>
                            <td>{formatInvoiceDisplayDate(item.resolvedDate)}</td>
                            <td>{item.title}</td>
                            <td>₹{item.resolvedAmount.toFixed(2)}</td>
                            <td style={{ color: item.resolvedAmountStatus === 'Paid' ? '#2e7d32' : '#c62828', fontWeight: 700 }}>
                              {item.resolvedAmountStatus}
                            </td>
                            <td>{formatInvoiceDisplayDateTime(item.savedAt)}</td>
                            <td>
                              <div className="form-actions" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
                                <button type="button" onClick={() => { handleDuplicateSavedInvoice(item); setExpandedCustomerKey(''); }}>Open</button>
                                <button type="button" onClick={() => handleToggleInvoiceStatus(item.id)}>{item.status === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}</button>
                                <button type="button" onClick={() => handleDeleteSavedInvoice(item.id)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginTop: '10px', marginBottom: '10px', textAlign: 'left', padding: '10px 12px', borderRadius: '8px', background: '#eef5ff', border: '1px solid #d7e3f4', fontSize: '0.82rem', fontWeight: 700, color: '#35506f' }}>
            <span>Name</span>
            <span>Mobile</span>
            <span>Address</span>
            <span>Date</span>
            <span>Paid Amount</span>
            <span>Due Amount</span>
            <span>Total Amount</span>
            <span>Amount Status</span>
          </div>
          {groupedSavedInvoices.length === 0 ? (
            <div className="support-status-panel__empty">No matching invoices found.</div>
          ) : (
            <div className="user-profile-history-list">
              {groupedSavedInvoices.map((group) => {
                const isExpanded = group.key === expandedCustomerKey;
                return (
                  <div key={group.key} className="user-profile-history-item" style={{ padding: '12px', border: '1px solid #e0e0e0', borderRadius: '8px', marginBottom: '10px', textAlign: 'left' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedCustomerKey(isExpanded ? '' : group.key)}
                      style={{ width: '100%', border: '1px solid #d7e3f4', background: isExpanded ? '#f7fbff' : '#fff', borderRadius: '8px', padding: '12px', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', alignItems: 'start' }}>
                        <div>
                          <strong>{group.customerName}</strong>
                          {group.customerId ? <div style={{ marginTop: '4px', fontSize: '0.82rem', color: '#5c6f86' }}>ID: {group.customerId}</div> : null}
                        </div>
                        <span>{group.mobile || '-'}</span>
                        <span>{group.address || '-'}</span>
                        <span>{formatInvoiceDisplayDate(group.latestInvoiceDate)}</span>
                        <span>₹{group.totalAmount.toFixed(2)}</span>
                        <span style={{ fontWeight: 700, color: group.dueAmount > 0 ? '#c62828' : '#2e7d32' }}>
                          {group.dueAmount > 0 ? `Due ₹${group.dueAmount.toFixed(2)}` : `Paid ₹${group.paidAmount.toFixed(2)}`}
                        </span>
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', color: '#586b84', fontSize: '0.85rem' }}>
                        <span>{group.entries.length} entr{group.entries.length === 1 ? 'y' : 'ies'}</span>
                        <span>Last saved: {formatInvoiceDisplayDateTime(group.latestSavedAt)}</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>
      <div className="invoice-container" ref={invoicePrintRef}>
        <div className="invoice-tax-label">Tax Invoice</div>
        <div className="invoice-header">
          <div className="invoice-brand">
            <div className="invoice-brand-logo">
              <img src="/logo.jpg" alt="Distributor Logo" className="invoice-logo-image" />
            </div>
            <div className="invoice-brand-details">
              <div className="invoice-title">{dealer.name}</div>
              <div className="invoice-sub">{dealer.address}</div>
              <div className="invoice-sub">Contact: {dealer.contact}</div>
              <div className="invoice-sub">GSTIN: {dealer.gstn}</div>
            </div>
          </div>
        </div>
        <div className="invoice-grid">
          <div className="section-box billto-section">
            <span className="section-label">Bill To</span>
            <div className="billto-form">
              <div className="billto-field billto-name" style={{ position: 'relative' }}>
                <label>Consumer Name</label>
                <input
                  className="invoice-input"
                  placeholder="Consumer Name"
                  value={billToName}
                  onChange={(e) => {
                    setBillToName(toUpperValue(e.target.value));
                    setShowNameSuggestions(true);
                  }}
                  onFocus={() => setShowNameSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                />
                {showNameSuggestions && autoCompleteSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ccc', borderRadius: '0 0 6px 6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {autoCompleteSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleApplyNameSuggestion(suggestion); }}
                        style={{ width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: '#fff', cursor: 'pointer' }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="billto-field billto-consumerno">
                <label>Consumer No (if available)</label>
                <input className="invoice-input billto-consumerno" placeholder="Consumer No (if available)" value={billToConsumerNo} onChange={(e) => setBillToConsumerNo(toUpperValue(e.target.value))} />
              </div>
              <div className="billto-inline-row">
                <div className="billto-field">
                  <label>Mobile No</label>
                  <input className="invoice-input billto-mobile" placeholder="Mobile No" value={billToMobileNo} onChange={(e) => setBillToMobileNo(toUpperValue(e.target.value))} />
                </div>
                <div className="billto-field">
                  <label>Center No</label>
                  <input className="invoice-input billto-centerno" placeholder="Center No" value={billToCenterNo} onChange={(e) => setBillToCenterNo(toUpperValue(e.target.value))} />
                </div>
              </div>
              <div className="billto-field billto-address">
                <label>Address</label>
                <textarea className="invoice-textarea" placeholder="Address" value={billToAddress} onChange={(e) => setBillToAddress(toUpperValue(e.target.value))} />
              </div>
              <div className="billto-field billto-gstin">
                <label>GSTIN (if available)</label>
                <input className="invoice-input billto-gstin" placeholder="GSTIN (if available)" value={billToGstin} onChange={(e) => setBillToGstin(toUpperValue(e.target.value))} />
              </div>
              <div className="billto-date-row">
                <div className="billto-field">
                  <label>Date</label>
                  <input className="invoice-input billto-date" type="date" value={billToDate} onChange={(e) => setBillToDate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Sr</th>
              <th>Goods & Service Description</th>
              <th>HSN</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Discount</th>
              <th>Taxable</th>
              <th>GST %</th>
              <th>GST Amt</th>
              <th>Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {invoiceRates.length > 0 ? (
              lineItems.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    <select className="invoice-input" value={row.item} onChange={(e) => handleRowItemChange(row.id, e.target.value)}>
                      <option value="">Select Product</option>
                      {invoiceRates.map((rate) => (
                        <option key={`${rate.Code}-${rate.Item}`} value={rate.Item}>{rate.Item}</option>
                      ))}
                    </select>
                  </td>
                  <td>{row.rateData?.HSNCode ?? row.rateData?.Code ?? '-'}</td>
                  <td>
                    <input
                      className="invoice-input"
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => handleRowQuantityChange(row.id, e.target.value)}
                    />
                  </td>
                  <td>
                    {isPastInvoiceDate ? (
                      <input
                        className="invoice-input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.customRate === '' ? (row.rateData?.RSP ?? '') : row.customRate}
                        onChange={(e) => handleRowRateChange(row.id, e.target.value)}
                      />
                    ) : (
                      row.unitRate.toFixed(2)
                    )}
                  </td>
                  <td>
                    <input
                      className="invoice-input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.discount || ''}
                      onChange={(e) => handleRowDiscountChange(row.id, e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td>{row.taxable.toFixed(2)}</td>
                  <td>{row.gstPercent.toFixed(2)}%</td>
                  <td>{row.gst.toFixed(2)}</td>
                  <td>{row.total.toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="invoice-row-remove"
                      onClick={() => handleRemoveProduct(row.id)}
                      disabled={invoiceRows.length <= 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center' }}>
                  No rate data found. Please update rates from the Rate Update section.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="invoice-actions">
          <button type="button" className="btn-add-product" onClick={handleAddProduct}>Add Product</button>
          <button type="button" className="btn-print-invoice" onClick={handleSaveInvoiceRecord}>Save Invoice Record</button>
          <button type="button" className="btn-print-invoice" onClick={handlePrintInvoice}>Print Invoice</button>
          <button type="button" className="btn-clear-invoice" onClick={handleClearInvoice}>Clear</button>
          <button type="button" className="btn-reset-invoice" onClick={handleResetInvoice}>Reset</button>
        </div>
        <div className="invoice-summary">
          <div className="summary-box">
            <div className="summary-header">SUMMARY</div>
            <table className="summary-table">
              <tbody>
                <tr><td>Sub-Total</td><td>{taxableAmount.toFixed(2)}</td></tr>
                <tr><td>GST</td><td>{gstAmount.toFixed(2)}</td></tr>
                <tr><td>Total</td><td>{lineTotal.toFixed(2)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="summary-box">
            <div className="summary-header">AMOUNT</div>
            <table className="summary-table">
              <tbody>
                <tr><td>CGST Amt</td><td>{cgstAmount.toFixed(2)}</td></tr>
                <tr><td>SGST Amt</td><td>{sgstAmount.toFixed(2)}</td></tr>
                <tr><td>Round Off</td><td>{roundOff.toFixed(2)}</td></tr>
                <tr><td>Total Amount</td><td><strong>{payableTotal.toFixed(2)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="invoice-total-words-bar">
          <strong>Invoice Total in Words: {payableTotalInWords}</strong>
        </div>
        <div className="invoice-footer">
          <div className="invoice-bank">
            <div><strong>Our Bank Details</strong></div>
            <div>Bank Name: {bankDetails.bankName}</div>
            <div>Branch: {bankDetails.branch}</div>
            <div>Account No: {bankDetails.accountNo}</div>
            <div>IFSC Code: {bankDetails.ifsc}</div>
          </div>
          <div className="invoice-declaration">
            <div><strong>Declaration</strong></div>
            <div>1. Terms & conditions are subject to our trade policy</div>
            <div>2. Our risk & responsibility ceases after the delivery of goods.</div>
            <div>E & O.E.</div>
          </div>
        </div>
        <div className="invoice-bottom">“This is computer generated invoice no signature required.”</div>
      </div>
    </div>
  );
}

export default InvoicePage;
