import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import './InvoiceWorkspace.css';
import { invoiceRequest } from './services/invoiceRepository';
import { invoicePaid, invoiceDue, indiaDate, buildInvoiceLedger, consumerStatement } from './utils/invoiceAccounting';

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

function InvoiceWorkspace({ loggedInUser }) {
  const [activeView, setActiveView] = useState('Dashboard');
  const [consumerDraft, setConsumerDraft] = useState({ consumerName: '', consumerNo: '', mobileNo: '', address: '', gstin: '', centerNo: '' });
  const [consumerError, setConsumerError] = useState('');
  const [consumerEditId, setConsumerEditId] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState('');
  const [dashboardRange, setDashboardRange] = useState('All Time');
  const [cloudStatus, setCloudStatus] = useState('syncing');
  const [billingError, setBillingError] = useState('');
  const [billingBusy, setBillingBusy] = useState(false);
  const billingLock = useRef(false);
  const draftIdRef = useRef(crypto.randomUUID());
  const savedDraftSignatureRef = useRef('');
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState('');
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [historyInvoiceId, setHistoryInvoiceId] = useState('');
  const [adjustments, setAdjustments] = useState(() => {
    try { const parsed = JSON.parse(localStorage.getItem(`cashmemoBillingAdjustments_${loggedInUser?.dealerCode || loggedInUser?.profileData?.distributorCode || 'guest'}`) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  });
  const [adjustmentDraft, setAdjustmentDraft] = useState({ consumerId: '', type: 'OpeningDebit', amount: '', date: indiaDate(), reason: '' });
  const adjustmentIdRef = useRef(crypto.randomUUID());
  const [statementConsumer, setStatementConsumer] = useState('');
  const [paymentDraft, setPaymentDraft] = useState({ amount: '', date: indiaDate(), mode: 'Cash', reference: '' });
  const paymentIdRef = useRef(crypto.randomUUID());
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
  const [billToDate, setBillToDate] = useState(indiaDate());
  const [billDueDate, setBillDueDate] = useState('');
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
  useEffect(() => {
    try { localStorage.setItem(`cashmemoBillingAdjustments_${dealerStorageKey}`, JSON.stringify(adjustments)); } catch { /* Optional cache. */ }
  }, [adjustments, dealerStorageKey]);
  const cacheRecords = (records) => {
    setSavedInvoices(records);
    try { localStorage.setItem(savedInvoicesStorageKey, JSON.stringify(records)); } catch { /* Cloud save remains authoritative. */ }
  };
  const cloudMutation = async (operation) => {
    if (billingLock.current || cloudStatus !== 'live') return null;
    billingLock.current = true; setBillingBusy(true); setBillingError('');
    try { return await invoiceRequest(loggedInUser?.id, operation); }
    catch (error) { setBillingError(error.message); if (error instanceof TypeError || error.status >= 500) setCloudStatus('offline'); return null; }
    finally { billingLock.current = false; setBillingBusy(false); }
  };
  const syncGeneration = useRef(0);
  const syncCloud = async () => {
    const generation = ++syncGeneration.current;
    setCloudStatus('syncing'); setBillingError('');
    try {
      // One request at a time. Existing document IDs make interrupted migration retry-safe.
      for (const record of savedInvoices) {
        if (!record.invoiceNumber) await invoiceRequest(loggedInUser?.id, { mode: 'migrateInvoice', id: record.id, record });
        if (generation !== syncGeneration.current) return;
      }
      for (const consumer of bulkCustomers) {
        await invoiceRequest(loggedInUser?.id, { mode: 'consumer', consumer, migrate: true });
        if (generation !== syncGeneration.current) return;
      }
      const result = await invoiceRequest(loggedInUser?.id, { mode: 'load' });
      if (generation !== syncGeneration.current) return;
      cacheRecords(result.invoices.map(normalizeSavedInvoiceRecord)); setBulkCustomers(result.consumers);
      setAdjustments(result.adjustments || []);
      try { localStorage.setItem(`cashmemoBulkCustomers_${dealerStorageKey}`, JSON.stringify(result.consumers)); } catch { /* Optional cache. */ }
      setCloudStatus('live');
    } catch (error) { if (generation === syncGeneration.current) { setBillingError(error.message); setCloudStatus('offline'); } }
  };
  useEffect(() => {
    void syncCloud();
    return () => { syncGeneration.current += 1; };
    // Only account changes start automatic cloud loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUser?.id]);
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
    setBillToDate(indiaDate()); setBillDueDate('');
    setInvoiceRows([buildEmptyProductRow()]);
  };

  const handleResetInvoice = () => {
    draftIdRef.current = crypto.randomUUID();
    savedDraftSignatureRef.current = ''; setCurrentInvoiceNumber('');
    setEditingInvoiceId('');
    setBillToName('');
    setBillToConsumerNo('');
    setBillToMobileNo('');
    setBillToCenterNo('');
    setBillToAddress('');
    setBillToGstin('');
    setBillToDate(indiaDate()); setBillDueDate('');
    setInvoiceRows([buildEmptyProductRow()]);
  };

  const buildInvoiceDraft = () => ({
    billToName,
    billToConsumerNo,
    billToMobileNo,
    billToCenterNo,
    billToDate,
    billDueDate,
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
    setBillToDate(String(draft?.billToDate || indiaDate())); setBillDueDate(String(draft?.billDueDate || ''));
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
    setActiveView('Billing');
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
    const record = savedInvoices.find((item) => item.id === invoiceId);
    if (!record || invoiceDue(record) <= 0) return;
    paymentIdRef.current = crypto.randomUUID();
    setPaymentDraft({ amount: String(invoiceDue(record)), date: indiaDate(), mode: 'Cash', reference: '' });
    setPaymentInvoice(record);
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
      const amountStatus = item.status === 'Paid' ? 'Paid' : 'Due';
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
      acc[customerKey].paidAmount += invoicePaid(item);
      acc[customerKey].dueAmount += invoiceDue(item);
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

  const isInvoicePaid = (item) => invoiceDue(item) === 0;
  const todayKey = indiaDate();
  const rangeStart = dashboardRange === 'Today' ? todayKey : dashboardRange === 'This Month' ? `${todayKey.slice(0, 7)}-01`
    : dashboardRange === 'Financial Year' ? `${Number(todayKey.slice(5, 7)) >= 4 ? todayKey.slice(0, 4) : Number(todayKey.slice(0, 4)) - 1}-04-01` : '';
  const dashboardInvoices = savedInvoices.filter((record) => record.status !== 'Cancelled' && (!rangeStart || ((record.header?.date || record.draft?.billToDate || String(record.savedAt).slice(0, 10)) >= rangeStart && (record.header?.date || record.draft?.billToDate || String(record.savedAt).slice(0, 10)) <= todayKey)));
  const paidInvoices = dashboardInvoices.filter(isInvoicePaid).length;
  const unpaidInvoices = dashboardInvoices.length - paidInvoices;
  const outstandingAmount = dashboardInvoices.reduce((sum, item) => (
    sum + invoiceDue(item)
  ), 0);
  const paidAmount = dashboardInvoices.reduce((sum, item) => (
    sum + invoicePaid(item)
  ), 0);
  const totalInvoiceAmount = paidAmount + outstandingAmount;
  const collectionRate = totalInvoiceAmount > 0 ? (paidAmount / totalInvoiceAmount) * 100 : 0;
  const averageInvoiceValue = dashboardInvoices.length > 0 ? totalInvoiceAmount / dashboardInvoices.length : 0;
  const consumerCount = new Set([
    ...bulkCustomers.map((customer) => String(customer.consumerNo || customer.mobileNo || customer.consumerName || '').trim().toLowerCase()),
    ...savedInvoices.map((record) => String(record.draft?.billToConsumerNo || record.header?.mobile || record.draft?.billToMobileNo || record.header?.name || record.draft?.billToName || '').trim().toLowerCase()),
  ].filter(Boolean)).size;
  const formatMoney = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
  const recentInvoices = [...dashboardInvoices].sort((a, b) => (Date.parse(b.savedAt) || 0) - (Date.parse(a.savedAt) || 0)).slice(0, 6);
  const topOutstanding = [...groupedSavedInvoices].filter((group) => group.dueAmount > 0).sort((a, b) => b.dueAmount - a.dueAmount).slice(0, 5);
  const overdueInvoices = savedInvoices.filter((record) => record.draft?.billDueDate && record.draft.billDueDate < todayKey && invoiceDue(record) > 0);

  const handleSaveInvoiceRecord = async () => {
    const draft = buildInvoiceDraft();
    const signature = JSON.stringify(draft);
    if (savedDraftSignatureRef.current && savedDraftSignatureRef.current !== signature) {
      draftIdRef.current = crypto.randomUUID(); savedDraftSignatureRef.current = '';
    }
    const invoiceRecord = normalizeSavedInvoiceRecord({
      id: draftIdRef.current,
      title: `${draft.billToName || 'Unnamed Customer'}${draft.billToConsumerNo ? ` (${draft.billToConsumerNo})` : ''}`,
      savedAt: new Date().toISOString(),
      status: 'Unpaid',
      draft,
    });
    if (!draft.billToName?.trim()) { setBillingError('Consumer name is required before saving an invoice.'); return; }
    const record = await cloudMutation({ mode: editingInvoiceId ? 'edit' : 'create', id: editingInvoiceId || invoiceRecord.id, record: invoiceRecord });
    if (!record) return;
    savedDraftSignatureRef.current = signature; setCurrentInvoiceNumber(record.invoiceNumber);
    cacheRecords([normalizeSavedInvoiceRecord(record), ...savedInvoices.filter((item) => item.id !== record.id)]);
    try { localStorage.setItem(invoiceDraftStorageKey, JSON.stringify(draft)); } catch { /* Optional draft cache. */ }
    setActiveView('Generated Invoice');
  };

  const handleDuplicateSavedInvoice = (invoiceRecord) => {
    draftIdRef.current = crypto.randomUUID();
    savedDraftSignatureRef.current = ''; setCurrentInvoiceNumber(invoiceRecord.invoiceNumber || '');
    setEditingInvoiceId(invoiceRecord.id);
    setActiveView('Billing');
    applyInvoiceDraft(invoiceRecord?.draft || {});
    localStorage.setItem(invoiceDraftStorageKey, JSON.stringify(invoiceRecord?.draft || {}));
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
          size: A4;
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
    // Some browsers mark a document written with document.write as complete,
    // before the listener is attached.
    //test
    if (printWindow.document.readyState === 'complete') {
      void triggerPrint();
    }
    window.setTimeout(() => void triggerPrint(), 2500);
  };

  useEffect(() => {
    const handleShortcuts = (event) => {
      if (activeView !== 'Billing' || !event.ctrlKey) return;
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
  }, [activeView, handleSaveInvoiceDraft, handlePrintInvoice, handleAddProduct, handleResetInvoice, handleSaveInvoiceRecord]);

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

  const query = workspaceSearch.trim().toLowerCase();
  const matchesSearch = (value) => JSON.stringify(value).toLowerCase().includes(query);
  const matchesDates = (date) => (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
  const visibleInvoices = savedInvoices.filter((record) => matchesSearch([record.invoiceNumber, record.title, record.draft?.billToName, record.draft?.billToConsumerNo, record.draft?.billToMobileNo])
    && (statusFilter === 'All' || record.status === statusFilter) && matchesDates(record.header?.date || getDraftInvoiceDate(record.draft, record.savedAt)));
  const allLedgerRows = buildInvoiceLedger(savedInvoices, adjustments);
  const ledgerGroups = Object.values(allLedgerRows.reduce((groups, row) => {
    const key = row.consumerKey;
    groups[key] ||= { key, customerName: row.consumer, mobile: '', totalAmount: 0, paidAmount: 0, dueAmount: 0, entries: groupedSavedInvoices.find((group) => group.key === String(key).toLowerCase())?.entries || [] };
    groups[key].totalAmount += row.debit; groups[key].paidAmount += row.credit; groups[key].dueAmount = row.balance;
    return groups;
  }, {}));
  const ledgerRows = allLedgerRows.filter((row) => matchesSearch(row) && matchesDates(row.date));
  const statementConsumers = [...new Map(allLedgerRows.map((row) => [row.consumerKey, row.consumer])).entries()];
  const statement = consumerStatement(allLedgerRows, statementConsumer, dateFrom, dateTo);
  const historyInvoice = savedInvoices.find((record) => record.id === historyInvoiceId);
  const recordCorrection = async (record, paymentId) => {
    const reason = window.prompt(paymentId ? 'Reason for reversing this payment:' : 'Reason for cancelling this invoice:');
    if (!reason?.trim()) return;
    const updated = await cloudMutation({ mode: paymentId ? 'reversePayment' : 'cancel', id: record.id, paymentId, reason });
    if (updated) cacheRecords(savedInvoices.map((item) => item.id === updated.id ? normalizeSavedInvoiceRecord(updated) : item));
  };
  const exportStatement = () => {
    const quote = (value) => `"${String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const rows = [['Consumer', statementConsumers.find(([key]) => key === statementConsumer)?.[1] || ''], ['Opening Balance', statement.opening], ['Date', 'Invoice', 'Details', 'Debit', 'Credit', 'Balance'], ...statement.transactions.map((row) => [row.date, row.invoiceNumber, row.detail, row.debit, row.credit, row.balance]), ['Closing Balance', statement.closing]];
    downloadCsvFile(rows.map((row) => row.map(quote).join(',')).join('\n'), 'consumer-statement.csv');
  };
  const selectedInvoice = savedInvoices.find((record) => record.id === editingInvoiceId);
  const lockedInvoice = Boolean(editingInvoiceId && (selectedInvoice?.status === 'Cancelled' || invoicePaid(selectedInvoice || {}) > 0));
  const startConsumerInvoice = (customer) => {
    draftIdRef.current = crypto.randomUUID(); savedDraftSignatureRef.current = ''; setCurrentInvoiceNumber(''); setEditingInvoiceId('');
    setBillToName(customer.consumerName || ''); setBillToConsumerNo(customer.consumerNo || ''); setBillToMobileNo(customer.mobileNo || ''); setBillToAddress(customer.address || ''); setBillToGstin(customer.gstin || ''); setBillToCenterNo(customer.centerNo || ''); setActiveView('Billing');
  };
  const shareInvoice = async (record) => {
    const text = `${record.invoiceNumber || record.title}\nConsumer: ${record.draft?.billToName || record.header?.name || ''}\nInvoice total: ${formatMoney(resolveInvoiceAmount(record))}\nPaid: ${formatMoney(invoicePaid(record))}\nBalance due: ${formatMoney(invoiceDue(record))}`;
    if (navigator.share) { try { await navigator.share({ title: record.invoiceNumber || 'Invoice', text }); } catch (error) { if (error.name !== 'AbortError') setBillingError('Invoice could not be shared. Please try again.'); } }
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };
  useEffect(() => {
    const warnBeforeLeaving = (event) => {
      if (activeView === 'Billing' && billToName.trim() && JSON.stringify(buildInvoiceDraft()) !== savedDraftSignatureRef.current) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
    // Draft fields determine whether a browser exit would lose current edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, billToName, billToConsumerNo, billToMobileNo, billToAddress, billToDate, billDueDate, billToGstin, billToCenterNo, invoiceRows]);

  return (
    <div className="invoice-workspace">
      <aside className="invoice-workspace__sidebar">
        <div className="invoice-workspace__brand"><img src="/branding.png" alt="LPG CashMemo" /><span>Invoice Workspace</span></div>
        <span className="invoice-workspace__nav-label">WORKSPACE</span>
        <nav aria-label="Invoice navigation">
          {['Dashboard', 'Add Consumer', 'List of Consumer', 'Product', 'Billing', 'Generated Invoice', 'Ledger', 'Credit / Debit', 'Adjustments', 'Consumer Statement', 'Setting'].map((view, index) => (
            <button key={view} type="button" className={activeView === view ? 'is-active' : ''}
              aria-current={activeView === view ? 'page' : undefined} onClick={() => setActiveView(view)}>
              <span aria-hidden="true">{['◫', '＋', '♙', '◇', '▤', '▧', '≡', '⇄', '±', '▣', '⚙'][index]}</span>{view}
            </button>
          ))}
        </nav>
        <div className="invoice-workspace__sidebar-footer">LPG CashMemo<br /><small>Consumer & billing management</small></div>
      </aside>
      <main className="invoice-workspace__main">
        <header className="invoice-workspace__topbar">
          <span>Consumer & Billing</span>
          <div className="invoice-workspace__account"><span className="invoice-workspace__avatar">{String(loggedInUser?.dealerName || 'D').slice(0, 1)}</span><div><strong>{loggedInUser?.dealerName || 'Dealer'}</strong><small>{loggedInUser?.dealerCode || 'Invoice workspace'}</small></div></div>
        </header>
        <div className="invoice-workspace__heading"><div><span className="invoice-workspace__eyebrow">INVOICE WORKSPACE</span><h2>{activeView === 'Billing' ? 'Create Invoice' : activeView}</h2></div>
          {activeView === 'Dashboard' && <button type="button" className="invoice-workspace__primary" onClick={() => { handleResetInvoice(); setActiveView('Billing'); }}>＋ New Invoice</button>}
        </div>
        <div className="invoice-workspace__content">
        <div className={`invoice-cloud-status invoice-cloud-status--${cloudStatus}`} role="status"><strong>{cloudStatus === 'live' ? 'Cloud billing connected' : cloudStatus === 'syncing' ? 'Syncing cloud billing…' : 'Offline — displaying cached data'}</strong><span>{cloudStatus !== 'live' ? 'Saving and payments are disabled until sync succeeds.' : 'Invoices and consumers are saved to your dealer account.'}</span><button type="button" disabled={cloudStatus === 'syncing' || billingBusy} onClick={() => void syncCloud()}>Sync Data</button></div>
        {billingError && <div className="invoice-billing-error" role="alert">{billingError}</div>}
        {activeView === 'Adjustments' && <section className="invoice-workspace__card"><h3>Opening Balance / Credit–Debit Adjustment</h3><p>Debit increases the consumer balance; credit reduces it. Entries remain in transaction history.</p><form onSubmit={async (event) => { event.preventDefault(); const entry = await cloudMutation({ mode: 'adjustment', entry: { ...adjustmentDraft, id: adjustmentIdRef.current, amount: Number(adjustmentDraft.amount) } }); if (entry) { setAdjustments((previous) => [...previous.filter((item) => item.id !== entry.id), entry]); adjustmentIdRef.current = crypto.randomUUID(); setAdjustmentDraft((draft) => ({ ...draft, amount: '', reason: '' })); } }}><div className="invoice-workspace__form-grid"><label>Adjustment consumer<select required value={adjustmentDraft.consumerId} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, consumerId: event.target.value }))}><option value="">Choose consumer</option>{bulkCustomers.map((consumer) => <option key={consumer.id} value={consumer.id}>{consumer.consumerName} · {consumer.consumerNo || consumer.mobileNo}</option>)}</select></label><label>Entry type<select value={adjustmentDraft.type} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, type: event.target.value }))}>{['OpeningDebit', 'OpeningCredit', 'Debit', 'Credit'].map((type) => <option key={type}>{type}</option>)}</select></label><label>Adjustment amount<input required type="number" min="0.01" step="0.01" value={adjustmentDraft.amount} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, amount: event.target.value }))} /></label><label>Adjustment date<input required type="date" max={indiaDate()} value={adjustmentDraft.date} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, date: event.target.value }))} /></label><label>Adjustment reason<input required maxLength={500} value={adjustmentDraft.reason} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, reason: event.target.value }))} /></label></div><button className="invoice-workspace__primary" type="submit" disabled={billingBusy || cloudStatus !== 'live'}>Save Adjustment</button></form><h4>Saved Adjustments</h4>{adjustments.map((entry) => <p key={entry.id}>{entry.date} · {entry.consumer} · {entry.type} · {formatMoney(entry.amount)} · {entry.reason}</p>)}</section>}
        {activeView === 'Consumer Statement' && <section className="invoice-workspace__card"><h3>Consumer Statement</h3><div className="invoice-workspace__form-grid"><label>Statement consumer<select value={statementConsumer} onChange={(event) => setStatementConsumer(event.target.value)}><option value="">Choose consumer</option>{statementConsumers.map(([key, name]) => <option key={key} value={key}>{name} · {key}</option>)}</select></label><label>Statement from<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label>Statement to<input type="date" min={dateFrom} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></div><p>Opening: {formatMoney(statement.opening)} · Debit: {formatMoney(statement.debit)} · Credit: {formatMoney(statement.credit)} · Closing: {formatMoney(statement.closing)}</p><button type="button" disabled={!statementConsumer} onClick={exportStatement}>Download Statement CSV</button><div className="invoice-workspace__table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Invoice</th><th>Details</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{statement.transactions.map((row) => <tr key={`${row.invoiceNumber}-${row.id}`}><td>{row.date}</td><td>{row.invoiceNumber}</td><td>{row.detail}</td><td>{formatMoney(row.debit)}</td><td>{formatMoney(row.credit)}</td><td>{formatMoney(row.balance)}</td></tr>)}</tbody></table></div></section>}
        {historyInvoice && <section className="invoice-workspace__card"><h3>Payment History — {historyInvoice.invoiceNumber}</h3><button type="button" onClick={() => setHistoryInvoiceId('')}>Close Payment History</button>{historyInvoice.payments?.map((payment) => <div key={payment.id}><p>{payment.date} · {formatMoney(payment.amount)} · {payment.mode} · {payment.reference}</p>{payment.reversal ? <p>Reversed: {payment.reversal.reason} · {payment.reversal.date}</p> : <button type="button" disabled={billingBusy || cloudStatus !== 'live'} onClick={() => void recordCorrection(historyInvoice, payment.id)}>Reverse Payment</button>}</div>)}</section>}
        {['List of Consumer', 'Generated Invoice', 'Ledger', 'Credit / Debit'].includes(activeView) && <div className="invoice-workspace__filters"><label>Search<input placeholder="Name, consumer number, mobile or invoice" value={workspaceSearch} onChange={(event) => setWorkspaceSearch(event.target.value)} /></label>{activeView !== 'List of Consumer' && <><label>From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label>To<input type="date" min={dateFrom} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></>}{activeView === 'Generated Invoice' && <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{['All', 'Unpaid', 'Partial', 'Paid', 'Cancelled'].map((status) => <option key={status}>{status}</option>)}</select></label>}<button type="button" onClick={() => { setWorkspaceSearch(''); setDateFrom(''); setDateTo(''); setStatusFilter('All'); }}>Clear Filters</button></div>}
        {paymentInvoice && <section className="invoice-workspace__card invoice-payment-form" aria-label="Record payment"><h3>Record Payment — {paymentInvoice.invoiceNumber || paymentInvoice.title}</h3><p>Balance due: {formatMoney(invoiceDue(paymentInvoice))}</p><form onSubmit={async (event) => { event.preventDefault(); const record = await cloudMutation({ mode: 'payment', id: paymentInvoice.id, payment: { ...paymentDraft, id: paymentIdRef.current, amount: Number(paymentDraft.amount) } }); if (record) { cacheRecords(savedInvoices.map((item) => item.id === record.id ? normalizeSavedInvoiceRecord(record) : item)); setPaymentInvoice(null); } }}><div className="invoice-workspace__form-grid"><label>Payment amount<input required type="number" step="0.01" min="0.01" max={invoiceDue(paymentInvoice)} value={paymentDraft.amount} onChange={(event) => setPaymentDraft((draft) => ({ ...draft, amount: event.target.value }))} /></label><label>Payment date<input required type="date" min={paymentInvoice.header?.date} max={indiaDate()} value={paymentDraft.date} onChange={(event) => setPaymentDraft((draft) => ({ ...draft, date: event.target.value }))} /></label><label>Payment mode<select value={paymentDraft.mode} onChange={(event) => setPaymentDraft((draft) => ({ ...draft, mode: event.target.value }))}>{['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque'].map((mode) => <option key={mode}>{mode}</option>)}</select></label><label>Payment reference<input maxLength={200} value={paymentDraft.reference} onChange={(event) => setPaymentDraft((draft) => ({ ...draft, reference: event.target.value }))} /></label></div><button type="submit" className="invoice-workspace__primary" disabled={billingBusy || cloudStatus !== 'live'}>{billingBusy ? 'Saving…' : 'Save Payment'}</button><button type="button" disabled={billingBusy} onClick={() => setPaymentInvoice(null)}>Cancel</button></form></section>}
        {activeView === 'Dashboard' && <div className="invoice-dashboard">
          <section className="invoice-dashboard__welcome">
            <div><span className="invoice-workspace__eyebrow">BUSINESS OVERVIEW</span><h3>Your billing, at a glance.</h3><p>Track your consumers, invoices and outstanding balances in one place.</p></div>
            <div className="invoice-dashboard__welcome-actions"><label>Period<select value={dashboardRange} onChange={(event) => setDashboardRange(event.target.value)}>{['All Time', 'Today', 'This Month', 'Financial Year'].map((range) => <option key={range}>{range}</option>)}</select></label><button type="button" onClick={() => { setConsumerEditId(''); setActiveView('Add Consumer'); }}>＋ Add Consumer</button></div>
          </section>
          {overdueInvoices.length > 0 && <div className="invoice-billing-error">{overdueInvoices.length} overdue invoices · Balance {formatMoney(overdueInvoices.reduce((sum, record) => sum + invoiceDue(record), 0))}</div>}
          <div className="invoice-dashboard__metrics">
            {[
              { label: 'Total Consumers', value: consumerCount, detail: 'Added and invoiced consumers', icon: '♙', view: 'List of Consumer', tone: 'purple' },
              { label: 'Generated Invoices', value: dashboardInvoices.length, detail: `${paidInvoices} paid · ${unpaidInvoices} unpaid`, icon: '▤', view: 'Generated Invoice', tone: 'blue' },
              { label: 'Recorded Paid', value: formatMoney(paidAmount), detail: 'Invoices recorded as paid', icon: '↙', view: 'Credit / Debit', tone: 'green' },
              { label: 'Outstanding Balance', value: formatMoney(outstandingAmount), detail: 'Invoices awaiting payment', icon: '↗', view: 'Ledger', tone: 'amber' },
            ].map((metric) => <button type="button" key={metric.label} className={`invoice-dashboard__metric invoice-dashboard__metric--${metric.tone}`} onClick={() => setActiveView(metric.view)}><span className="invoice-dashboard__metric-top"><span>{metric.label}</span><span className="invoice-dashboard__metric-icon" aria-hidden="true">{metric.icon}</span></span><strong>{metric.value}</strong><small>{metric.detail}</small></button>)}
          </div>
          {topOutstanding.length > 0 && <section className="invoice-workspace__card"><h3>Top Outstanding Consumers</h3><p>Current balances across all saved invoices.</p><div className="invoice-workspace__table-scroll"><table className="data-table"><thead><tr><th>Consumer</th><th>Mobile</th><th>Outstanding</th><th>Actions</th></tr></thead><tbody>{topOutstanding.map((group) => <tr key={group.key}><td>{group.customerName}</td><td>{group.mobile || '—'}</td><td>{formatMoney(group.dueAmount)}</td><td><button type="button" onClick={() => { setWorkspaceSearch(group.customerName); setActiveView('Ledger'); }}>View Ledger</button></td></tr>)}</tbody></table></div></section>}
          <div className="invoice-dashboard__grid">
            <section className="invoice-workspace__card invoice-dashboard__recent">
              <div className="invoice-dashboard__section-heading"><div><h3>Recent Invoices</h3><p>Your latest saved billing records</p></div><button type="button" className="invoice-dashboard__text-button" onClick={() => setActiveView('Generated Invoice')}>View all →</button></div>
              {recentInvoices.length ? <div className="invoice-workspace__table-scroll"><table className="data-table"><thead><tr><th>Consumer / Invoice</th><th>Date</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{recentInvoices.map((record) => <tr key={record.id}><td><strong>{record.header?.name || record.draft?.billToName || 'Unnamed Consumer'}</strong><small className="invoice-dashboard__invoice-id">{record.title || record.id}</small></td><td>{formatInvoiceDisplayDate(record.header?.date || getDraftInvoiceDate(record.draft, record.savedAt))}</td><td>{formatMoney(resolveInvoiceAmount(record))}</td><td><span className={`invoice-dashboard__badge ${isInvoicePaid(record) ? 'is-paid' : 'is-due'}`}>{isInvoicePaid(record) ? 'Paid' : 'Unpaid'}</span></td><td><button type="button" onClick={() => handleDuplicateSavedInvoice(record)}>Open</button><button type="button" onClick={() => void shareInvoice(record)}>Share</button></td></tr>)}</tbody></table></div> : <div className="invoice-dashboard__empty"><span aria-hidden="true">▤</span><h4>No invoices yet</h4><p>Create your first invoice to start tracking your billing.</p><button className="invoice-workspace__primary" type="button" onClick={() => setActiveView('Billing')}>Create Invoice</button></div>}
            </section>
            <section className="invoice-workspace__card invoice-dashboard__collection"><h3>Payment Overview</h3><p>Based on saved invoice payment status</p><strong className="invoice-dashboard__collection-rate">{collectionRate.toFixed(0)}<small>%</small></strong><span className="invoice-dashboard__collection-label">of invoiced amount recorded as paid</span><progress aria-label="Paid invoice amount percentage" max="100" value={collectionRate} /><dl><div><dt>Total Invoiced</dt><dd>{formatMoney(totalInvoiceAmount)}</dd></div><div><dt>Recorded Paid</dt><dd>{formatMoney(paidAmount)}</dd></div><div><dt>Balance Due</dt><dd>{formatMoney(outstandingAmount)}</dd></div><div><dt>Average Invoice</dt><dd>{formatMoney(averageInvoiceValue)}</dd></div></dl><button className="invoice-dashboard__text-button" type="button" onClick={() => setActiveView('Ledger')}>Open consumer ledger →</button></section>
          </div>
          <section className="invoice-workspace__card invoice-dashboard__quick"><div><h3>Keep your billing moving</h3><p>Go straight to the tools you use every day.</p></div><div><button type="button" onClick={() => setActiveView('List of Consumer')}>Consumer List →</button><button type="button" onClick={() => setActiveView('Product')}>Product Catalogue →</button><button type="button" onClick={() => setActiveView('Credit / Debit')}>Credit / Debit →</button></div></section>
        </div>}
        {activeView === 'List of Consumer' && <section className="invoice-workspace__card">
          <h3>Consumer List</h3><p>Added consumers and consumers from saved invoices.</p>
          <div className="invoice-workspace__table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Consumer Number</th><th>Mobile</th><th>Address</th><th>Actions</th></tr></thead><tbody>
            {(() => {
              const consumers = new Map();
              for (const record of savedInvoices) {
                const customer = { consumerName: record.header?.name || record.draft?.billToName || '', consumerNo: record.draft?.billToConsumerNo || '', mobileNo: record.header?.mobile || record.draft?.billToMobileNo || '', address: record.header?.address || record.draft?.billToAddress || '' };
                const key = String(customer.consumerNo || customer.mobileNo || customer.consumerName).trim().toLowerCase();
                if (key && !consumers.has(key)) consumers.set(key, customer);
              }
              for (const customer of bulkCustomers) {
                const key = String(customer.consumerNo || customer.mobileNo || customer.consumerName || customer.id).trim().toLowerCase();
                consumers.set(key, customer);
              }
              const visibleConsumers = [...consumers.entries()].filter(([, customer]) => matchesSearch(customer));
              return visibleConsumers.length ? visibleConsumers.map(([key, customer]) => <tr key={key}><td>{customer.consumerName || '—'}</td><td>{customer.consumerNo || '—'}</td><td>{customer.mobileNo || '—'}</td><td>{customer.address || '—'}</td><td><div className="invoice-workspace__row-actions"><button type="button" onClick={() => startConsumerInvoice(customer)}>Create Invoice</button>{customer.id && <button type="button" disabled={billingBusy || cloudStatus !== 'live'} onClick={() => { setConsumerEditId(customer.id); setConsumerDraft(Object.fromEntries(['consumerName', 'consumerNo', 'mobileNo', 'address', 'gstin', 'centerNo'].map((field) => [field, customer[field] || '']))); setActiveView('Add Consumer'); }}>Edit Consumer</button>}<button type="button" onClick={() => { setWorkspaceSearch(customer.consumerNo || customer.consumerName); setActiveView('Generated Invoice'); }}>Invoice History</button></div></td></tr>) : <tr><td colSpan={5}>No matching consumers. Use Add Consumer to add one.</td></tr>;
            })()}
          </tbody></table></div>
        </section>}
        {activeView === 'Generated Invoice' && <section className="invoice-workspace__card">
          <h3>Generated Invoices</h3><p>{savedInvoices.length} saved invoices</p>
          <div className="invoice-workspace__table-scroll"><table className="data-table"><thead><tr><th>Invoice</th><th>Consumer</th><th>Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {visibleInvoices.map((record) => <tr key={record.id}><td><strong>{record.invoiceNumber || record.id}</strong><small className="invoice-dashboard__invoice-id">{record.title}</small></td><td>{record.header?.name || record.draft?.billToName || '—'}</td><td>{formatInvoiceDisplayDate(record.header?.date || getDraftInvoiceDate(record.draft, record.savedAt))}</td><td>{formatMoney(resolveInvoiceAmount(record))}<small className="invoice-dashboard__invoice-id">Paid {formatMoney(invoicePaid(record))} · Due {formatMoney(invoiceDue(record))}</small></td><td>{record.status}</td><td><div className="invoice-workspace__row-actions"><button type="button" onClick={() => handleDuplicateSavedInvoice(record)}>Open</button><button type="button" onClick={() => void shareInvoice(record)}>Share</button><button type="button" disabled={billingBusy || cloudStatus !== 'live' || invoiceDue(record) <= 0} onClick={() => handleToggleInvoiceStatus(record.id)}>Record Payment</button><button type="button" onClick={() => setHistoryInvoiceId(record.id)}>Payment History</button><button type="button" disabled={billingBusy || cloudStatus !== 'live' || invoicePaid(record) > 0 || record.status === 'Cancelled'} onClick={() => void recordCorrection(record)}>Cancel Invoice</button></div></td></tr>)}
            {!visibleInvoices.length && <tr><td colSpan={6}>No matching invoices. Save an invoice from Billing or clear filters.</td></tr>}
          </tbody></table></div>
        </section>}
        {(activeView === 'Ledger' || activeView === 'Credit / Debit') && <section className="invoice-workspace__card">
          <h3>{activeView === 'Ledger' ? 'Consumer Ledger' : 'Credit / Debit Summary'}</h3>
          <p>{activeView === 'Ledger' ? 'Consumer balances from saved invoice records.' : 'Debit is the invoiced amount. Credit is the amount recorded as paid on saved invoices.'}</p>
          <div className="invoice-workspace__table-scroll"><table className="data-table"><thead><tr><th>Consumer</th><th>Mobile</th><th>{activeView === 'Ledger' ? 'Total Invoiced' : 'Debit'}</th><th>{activeView === 'Ledger' ? 'Paid' : 'Credit'}</th><th>Balance Due</th><th>Actions</th></tr></thead><tbody>
            {ledgerGroups.map((group) => <tr key={group.key}><td>{group.customerName}</td><td>{group.mobile || '—'}</td><td>₹{group.totalAmount.toFixed(2)}</td><td>₹{group.paidAmount.toFixed(2)}</td><td>₹{group.dueAmount.toFixed(2)}</td><td><button type="button" onClick={() => handlePrintLedger(group)}>Print Ledger</button><button type="button" onClick={() => { setStatementConsumer(group.key); setActiveView('Consumer Statement'); }}>View Statement</button></td></tr>)}
            {!ledgerGroups.length && <tr><td colSpan={6}>No ledger entries yet. Save an invoice or opening balance.</td></tr>}
          </tbody></table></div>
          <h4>Transaction History</h4><p>Running balance is calculated per consumer, including transactions before the selected date range.</p><div className="invoice-workspace__table-scroll"><table className="data-table" aria-label="Ledger transactions"><thead><tr><th>Date</th><th>Consumer</th><th>Invoice Number</th><th>Details</th><th>Debit</th><th>Credit</th><th>Running Balance</th></tr></thead><tbody>{ledgerRows.map((row) => <tr key={`${row.invoiceNumber}-${row.id}`}><td>{formatInvoiceDisplayDate(row.date)}</td><td>{row.consumer}</td><td>{row.invoiceNumber}</td><td>{row.detail}</td><td>{formatMoney(row.debit)}</td><td>{formatMoney(row.credit)}</td><td>{formatMoney(row.balance)}</td></tr>)}{!ledgerRows.length && <tr><td colSpan={7}>No matching transactions.</td></tr>}</tbody></table></div>
        </section>}
        {activeView === 'Add Consumer' && <section className="invoice-workspace__card">
          <h3>{consumerEditId ? 'Edit Consumer' : 'Add Consumer'}</h3><p>Save consumer details and use them in your invoice.</p>
          <form onSubmit={async (event) => {
            event.preventDefault();
            if (bulkCustomers.some((customer) => customer.id !== consumerEditId && consumerDraft.consumerNo.trim() && customer.consumerNo === consumerDraft.consumerNo.trim())) { setConsumerError('This consumer number already exists.'); return; }
            const customer = Object.fromEntries(Object.entries(consumerDraft).map(([key, value]) => [key, value.trim()]));
            if (!customer.consumerName || !/^\d{10}$/.test(customer.mobileNo)) { setConsumerError('Enter consumer name and a valid 10-digit mobile number.'); return; }
            const saved = await cloudMutation({ mode: 'consumer', consumer: customer, editId: consumerEditId || undefined });
            if (!saved) return;
            const nextCustomers = [...bulkCustomers.filter((item) => item.id !== saved.id), saved];
            setBulkCustomers(nextCustomers);
            try { localStorage.setItem(`cashmemoBulkCustomers_${dealerStorageKey}`, JSON.stringify(nextCustomers)); } catch { /* Optional cache. */ }
            draftIdRef.current = crypto.randomUUID();
            savedDraftSignatureRef.current = ''; setCurrentInvoiceNumber('');
            setEditingInvoiceId(''); setConsumerEditId('');
            setBillToName(customer.consumerName); setBillToConsumerNo(customer.consumerNo); setBillToMobileNo(customer.mobileNo); setBillToAddress(customer.address); setBillToGstin(customer.gstin); setBillToCenterNo(customer.centerNo);
            setConsumerDraft({ consumerName: '', consumerNo: '', mobileNo: '', address: '', gstin: '', centerNo: '' }); setConsumerError(''); setActiveView('Billing');
          }}>
            <div className="invoice-workspace__form-grid">{Object.entries({ consumerName: 'Consumer Name', consumerNo: 'Consumer Number', mobileNo: 'Mobile Number', address: 'Address', gstin: 'GSTIN', centerNo: 'Center Number' }).map(([key, label]) => <label key={key}>{label}<input className="form-input" value={consumerDraft[key]} readOnly={key === 'consumerNo' && Boolean(consumerEditId)} required={key === 'consumerName' || key === 'consumerNo' || key === 'mobileNo'} onChange={(event) => setConsumerDraft((previous) => ({ ...previous, [key]: event.target.value }))} /></label>)}</div>
            {consumerError && <p role="alert">{consumerError}</p>}<button className="invoice-workspace__primary" type="submit" disabled={billingBusy || cloudStatus !== 'live'}>{billingBusy ? 'Saving…' : 'Save Consumer & Bill'}</button>
          </form>
        </section>}
        {activeView === 'Product' && <section className="invoice-workspace__card"><h3>Product Catalogue</h3><p>Products and approved rates available for billing.</p><div className="invoice-workspace__table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Code</th><th>HSN</th><th>Basic Price</th><th>SGST</th><th>CGST</th><th>RSP</th></tr></thead><tbody>{invoiceRates.map((rate, index) => <tr key={`${rate.Code}-${index}`}><td>{rate.Item}</td><td>{rate.Code || '—'}</td><td>{rate.HSNCode}</td><td>₹{rate.BasicPrice.toFixed(2)}</td><td>{rate.SGST}%</td><td>{rate.CGST}%</td><td>₹{rate.RSP.toFixed(2)}</td></tr>)}</tbody></table></div>{!invoiceRates.length && <p>No approved products available. Add rates through Rate Update.</p>}</section>}
        {activeView === 'Setting' && <section className="invoice-workspace__card"><h3>Invoice Settings</h3><p>Your dealer profile and bank details are used on every invoice.</p><div className="invoice-workspace__form-grid"><div><h4>Business Details</h4><p>{dealer.name}</p><p>{dealer.address}</p><p>Contact: {dealer.contact}</p><p>GSTIN: {dealer.gstn}</p></div><div><h4>Bank Details</h4><p>Bank: {bankDetails.bankName || '—'}</p><p>Branch: {bankDetails.branch || '—'}</p><p>Account: {bankDetails.accountNo || '—'}</p><p>IFSC: {bankDetails.ifsc || '—'}</p></div></div><p>Update these details through Profile Update and Bank Details.</p></section>}
      <div className="invoice-workspace__billing" hidden={activeView !== 'Billing'}>
      <div className="invoice-workspace__billing-heading"><span>Invoice Preview & Editor</span><button type="button" onClick={handlePrintInvoice}>Print / Download PDF</button></div>
      <div className="invoice-container" ref={invoicePrintRef}>
        <div className="invoice-tax-label">Tax Invoice</div>
        {selectedInvoice?.status === 'Cancelled' && <div className="invoice-billing-error">CANCELLED — {selectedInvoice.cancellation?.reason}</div>}
        {currentInvoiceNumber && <div className="invoice-workspace__invoice-number">Invoice No: <strong>{currentInvoiceNumber}</strong></div>}
        <div className="invoice-workspace__invoice-number"><label>Due Date <input aria-label="Invoice due date" type="date" min={billToDate} value={billDueDate} disabled={lockedInvoice} onChange={(event) => setBillDueDate(event.target.value)} /></label></div>
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
        <fieldset className="invoice-workspace__invoice-fields" disabled={lockedInvoice}>
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
                  <input className="invoice-input billto-date" type="date" value={billToDate} readOnly={Boolean(editingInvoiceId)} onChange={(e) => setBillToDate(e.target.value)} />
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
        </fieldset>
        <div className="invoice-actions">
          <button type="button" className="btn-add-product" onClick={handleAddProduct}>Add Product</button>
          <button type="button" className="btn-print-invoice" onClick={() => void handleSaveInvoiceRecord()} disabled={billingBusy || cloudStatus !== 'live' || lockedInvoice}>{billingBusy ? 'Saving…' : 'Save Invoice Record'}</button>
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
      </div>
      </main>
    </div>
  );
}

export default function InvoicePage(props) {
  return <InvoiceWorkspace key={props.loggedInUser?.id || props.loggedInUser?.dealerCode || 'guest'} {...props} />;
}
