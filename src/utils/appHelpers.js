export const excelSerialDateToJSDate = (serial) => {
  if (typeof serial !== 'number' || Number.isNaN(serial)) {
    return null;
  }
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const ms = serial * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + ms);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateToDDMMYYYY = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const readImageFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!(file instanceof File)) {
    reject(new Error('Invalid file.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => reject(new Error('Image read failed.'));
  reader.readAsDataURL(file);
});

const createValidatedDate = (year, month, day, hour = 0, minute = 0, second = 0) => {
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) || 0,
    Number(minute) || 0,
    Number(second) || 0,
  );
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date;
};

export const parseDateString = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const trimmedDateString = dateString.trim();
  if (trimmedDateString === '') {
    return null;
  }

  let parts = trimmedDateString.match(/^(\d{1,2})[-/,](\d{1,2})[-/,](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (parts) {
    const date = createValidatedDate(parts[3], parts[2], parts[1], parts[4], parts[5], parts[6]);
    if (date) return date;
  }

  parts = trimmedDateString.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (parts) {
    const date = createValidatedDate(parts[1], parts[2], parts[3], parts[4], parts[5], parts[6]);
    if (date) return date;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmedDateString) || /[a-zA-Z]/.test(trimmedDateString)) {
    const date = new Date(trimmedDateString);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const compactParts = trimmedDateString.match(/^(\d{1,2})(\d{1,2})(\d{4})$/);
  if (compactParts) {
    const date = createValidatedDate(compactParts[3], compactParts[2], compactParts[1]);
    if (date) {
      return date;
    }
  }

  if (/^\d+$/.test(trimmedDateString)) {
    const excelValue = Number(trimmedDateString);
    const date = excelSerialDateToJSDate(excelValue);
    if (date) {
      return date;
    }
  }

  return null;
};

export const getNormalizedRowDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value);
  }
  if (typeof value === 'number') {
    return excelSerialDateToJSDate(value);
  }
  if (typeof value === 'string') {
    return parseDateString(value);
  }
  return null;
};

export const getStartOfDay = (value) => {
  const date = getNormalizedRowDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getElapsedDays = (value, now = new Date()) => {
  const date = getStartOfDay(value);
  if (!date) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

export const isEkycNotDoneStatus = (status) => {
  const normalized = String(status || '').toLowerCase().trim();
  return normalized === 'pending' || normalized === 'ekyc not done' || normalized === 'not done';
};

export const normalizeMultiValueFilter = (value) => {
  if (Array.isArray(value)) {
    const nextValues = [...new Set(value
      .map((item) => String(item || '').trim())
      .filter((item) => item && item !== 'All'))];
    return nextValues.length > 0 ? nextValues : 'All';
  }
  const normalized = String(value || '').trim();
  return normalized && normalized !== 'All' ? [normalized] : 'All';
};

export const getMultiValueFilterValues = (value) => (
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
);

export const hasMultiValueFilterSelection = (value) => getMultiValueFilterValues(value).length > 0;

export const matchesMultiValueFilter = (filterValue, rowValue) => {
  const selectedValues = getMultiValueFilterValues(filterValue);
  if (selectedValues.length === 0) return true;
  return selectedValues.includes(String(rowValue || '').trim());
};

export const formatMultiValueFilterLabel = (prefix, value) => {
  const selectedValues = getMultiValueFilterValues(value);
  if (selectedValues.length === 0) return '';
  if (selectedValues.length === 1) return `${prefix}: ${selectedValues[0]}`;
  return `${prefix}: ${selectedValues[0]} +${selectedValues.length - 1}`;
};

export const isAadhaarNotSeededStatus = (status) => {
  const normalized = String(status || '').toLowerCase().trim();
  return normalized === 'aadhaar not seeded';
};

export const isOnlinePaidStatus = (status) => String(status || '').toLowerCase().trim() === 'paid';

export const isPendingSvRow = (row = {}) => {
  const normalizedOrderType = String(row?.['Order Type'] || '').toLowerCase().trim();
  return normalizedOrderType.includes('pending sv');
};

export const isConsumerStatusMatch = (value, target) => (
  String(value || '').toLowerCase().trim() === String(target || '').toLowerCase().trim()
);

export const hasMeaningfulCellValue = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized !== '' && normalized !== '-';
};

export const isRegisteredMobileRow = (row = {}) => (
  hasMeaningfulCellValue(row['Mobile No.']) && hasMeaningfulCellValue(row['Is Reg Mobile'])
);

export const sortedUniqueValues = (values) => [...new Set(values.filter(Boolean))]
  .sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }));

export const getCashMemoPerPage = (pageType) => {
  if (pageType === '2 Cashmemo/Page') return 2;
  if (pageType === '4 Cashmemo/Page') return 4;
  return 3;
};

export const CASHMEMO_PAGE_TYPES = ['2 Cashmemo/Page', '3 Cashmemo/Page', '4 Cashmemo/Page'];

export const CASHMEMO_LABEL_OPTIONS = [
  { key: 'consumerName', label: 'Consumer Name', group: 'Distributor Copy' },
  { key: 'consumerNoLpgId', label: 'Consumer No / LPG ID', group: 'Distributor Copy' },
  { key: 'address', label: 'Address', group: 'Distributor Copy' },
  { key: 'mobileNo', label: 'Mobile No.', group: 'Common Details' },
  { key: 'deliveryArea', label: 'Delivery Area', group: 'Distributor Copy' },
  { key: 'deliveryStaff', label: 'Delivery Staff', group: 'Distributor Copy' },
  { key: 'productHsnQty', label: 'Product / HSN / Qty', group: 'Distributor Copy' },
  { key: 'orderNoAndDate', label: 'Order No. & Order Date', group: 'Distributor Copy' },
  { key: 'cashMemoNoAndDate', label: 'Cash Memo No. & Date', group: 'Distributor Copy' },
  { key: 'basePrice', label: 'Base Price (Rs.)', group: 'Amount Details' },
  { key: 'dlvryCharges', label: 'Dlvry Charges (Rs.)', group: 'Amount Details' },
  { key: 'cashCarryRebate', label: 'C & C Rebate (Rs.)', group: 'Amount Details' },
  { key: 'cgst', label: 'CGST (2.50%)(Rs.)', group: 'Amount Details' },
  { key: 'sgst', label: 'SGST (2.50%)(Rs.)', group: 'Amount Details' },
  { key: 'totalAmount', label: 'Total Amount (Rs.)', group: 'Amount Details' },
  { key: 'eKyc', label: 'E-KYC', group: 'Common Details' },
  { key: 'payment', label: 'Payment', group: 'Common Details' },
  { key: 'taxConsumerName', label: 'Tax Consumer Name', group: 'Tax Invoice' },
  { key: 'taxConsumerNo', label: 'Tax Consumer No.', group: 'Tax Invoice' },
  { key: 'taxLpgId', label: 'Tax LPG ID', group: 'Tax Invoice' },
  { key: 'taxAddress', label: 'Tax Address', group: 'Tax Invoice' },
  { key: 'category', label: 'Category', group: 'Tax Invoice' },
  { key: 'productHsn', label: 'Product/ HSN', group: 'Tax Invoice' },
  { key: 'connectionQty', label: 'Connection/ Qty', group: 'Tax Invoice' },
  { key: 'bookingSource', label: 'Booking Source', group: 'Tax Invoice' },
  { key: 'orderNo', label: 'Order No.', group: 'Tax Invoice' },
  { key: 'orderDate', label: 'Order Date', group: 'Tax Invoice' },
  { key: 'cashMemoNo', label: 'CashMemo No.', group: 'Tax Invoice' },
  { key: 'cashMemoDate', label: 'CashMemo Date', group: 'Tax Invoice' },
  { key: 'deliveryCharges', label: 'Delivery Charges (Rs.)', group: 'Tax Invoice' },
  { key: 'taxableAmount', label: 'Taxable Amount (Rs.)', group: 'Tax Invoice' },
  { key: 'advanceOnline', label: 'Advance (Online) (Rs.)', group: 'Tax Invoice' },
  { key: 'netPayable', label: 'Net Payable (Rs.)', group: 'Tax Invoice' },
];

const DEFAULT_HIDDEN_LABELS_BY_PAGE_TYPE = {
  '4 Cashmemo/Page': new Set(['deliveryStaff', 'productHsnQty', 'dlvryCharges', 'cashCarryRebate', 'category', 'productHsn', 'connectionQty', 'deliveryCharges', 'taxableAmount']),
};

export const createDefaultCashMemoLabelSettings = () => {
  const settings = {};
  CASHMEMO_PAGE_TYPES.forEach((type) => {
    const hiddenLabels = DEFAULT_HIDDEN_LABELS_BY_PAGE_TYPE[type] || new Set();
    settings[type] = CASHMEMO_LABEL_OPTIONS.reduce((acc, item) => {
      acc[item.key] = !hiddenLabels.has(item.key);
      return acc;
    }, {});
  });
  return settings;
};

export const mergeCashMemoLabelSettings = (savedSettings = {}) => {
  const defaults = createDefaultCashMemoLabelSettings();
  CASHMEMO_PAGE_TYPES.forEach((type) => {
    defaults[type] = {
      ...defaults[type],
      ...(savedSettings?.[type] || {}),
    };
  });
  return defaults;
};

export const getCashMemoLabelSettingsStorageKey = (dealerCode = '') => (
  dealerCode ? `cashMemoLabelSettings_${String(dealerCode).trim()}` : 'cashMemoLabelSettings'
);

export const USER_SESSION_STORAGE_KEY = 'cashmemoUserSession';
export const APPROVAL_REPLIES_STORAGE_KEY = 'approvalReplies';
export const ADMIN_AUDIT_COLLECTION = 'adminAuditTrail';
export const FILTER_PRESET_STORAGE_KEY_PREFIX = 'cashmemoFilterPresets_';
export const RECENT_ACTIVITY_STORAGE_KEY_PREFIX = 'cashmemoRecentActivity_';
export const ONBOARDING_TOUR_STORAGE_KEY_PREFIX = 'cashmemoOnboardingTourSeen_';
export const WORKSPACE_MODE_STORAGE_KEY_PREFIX = 'cashmemoWorkspaceMode_';
export const ANNOUNCEMENTS_STORAGE_KEY = 'cashmemoAnnouncements';

export const getPlanUpgradeReplyStorageKey = ({ userId = '', dealerCode = '', dealerName = '' } = {}) => {
  const userKey = String(userId || dealerCode || dealerName || '').trim();
  return userKey ? `planUpgrade-${userKey}` : 'planUpgrade';
};

export const getOnboardingTourStorageKey = (dealerCode = '') => (
  `${ONBOARDING_TOUR_STORAGE_KEY_PREFIX}${String(dealerCode || 'guest').trim() || 'guest'}`
);

export const getWorkspaceModeStorageKey = (dealerCode = '') => (
  `${WORKSPACE_MODE_STORAGE_KEY_PREFIX}${String(dealerCode || 'guest').trim() || 'guest'}`
);

export const getAnnouncementScopeLabel = (scope = 'all') => {
  const normalized = String(scope || 'all').toLowerCase();
  if (normalized === 'all') return 'All Users';
  if (normalized === 'active') return 'Active Users';
  if (normalized === 'expiring') return 'Expiring Soon';
  if (normalized === 'expired') return 'Expired Users';
  return scope;
};

export const PACKAGE_OPTIONS = [
  'Premium Package - 30 Days',
  'Enterprise Package - 365 Days',
  'Enterprise Package with (à¤¹à¤¿à¤‚à¤¦à¥€) - 365 Days',
];

export const PACKAGE_PRICING = {
  'Premium Package - 30 Days': 'Rs. 1999',
  'Enterprise Package - 365 Days': 'Rs. 4999',
  'Enterprise Package with (à¤¹à¤¿à¤‚à¤¦à¥€) - 365 Days': 'Rs. 6999',
};

export const PAYMENT_UPI_ID = '8002074620@ybl';

const HINDI_ENTERPRISE_PACKAGE_NAMES = [
  'Enterprise Package with (à¤¹à¤¿à¤‚à¤¦à¥€) - 365 Days',
];

export const getPackageValidityDays = (packageName = '') => {
  const normalized = String(packageName || '').toLowerCase();
  if (
    normalized.includes('enterprise package with (à¤¹à¤¿à¤‚à¤¦à¥€)')
  ) return 365;
  if (normalized.includes('premium')) return 30;
  if (normalized.includes('enterprise')) return 365;
  return 0;
};

export const isHindiEnterprisePackage = (packageName = '') => HINDI_ENTERPRISE_PACKAGE_NAMES.includes(packageName);

export const computeValidityDates = (packageName = '', baseDate = new Date()) => {
  const days = getPackageValidityDays(packageName);
  const validFrom = new Date(baseDate);
  const validTill = new Date(baseDate);
  if (days > 0) {
    validTill.setDate(validTill.getDate() + days);
  }
  return {
    packageDays: days,
    validFrom: validFrom.toISOString(),
    validTill: validTill.toISOString(),
  };
};

export const isUserExpired = (user) => {
  const validTillRaw = user?.validTill;
  if (!validTillRaw) return false;
  const validTillDate = new Date(validTillRaw);
  if (Number.isNaN(validTillDate.getTime())) return false;
  return new Date().getTime() > validTillDate.getTime();
};

export const formatDisplayDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB');
};

export const formatDisplayDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB');
};

export const getRemainingDays = (validTill) => {
  if (!validTill) return null;
  const end = new Date(validTill);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const formatPackageNameForNavbar = (packageName = '') => {
  const name = String(packageName || '')
    .trim();
  if (!name) return 'N/A';
  return name.replace(/\s*-\s*\d+\s*Days?\s*$/i, '').trim();
};

export const formatPackageOptionLabel = (packageName = '') => {
  const days = getPackageValidityDays(packageName);
  const validityText = days > 0 ? `${days} ${days === 1 ? 'Day' : 'Days'}` : 'N/A';
  return `${formatPackageNameForNavbar(packageName)} - ${PACKAGE_PRICING[packageName] || '-'} - Validity: ${validityText}`;
};

export const DEFAULT_EXPORT_HEADERS = [
  'Consumer No.',
  'Consumer Name',
  'Delivery Area',
  'Mobile No.',
  'Order Date',
  'Cash Memo Date',
  'Order Type',
  'Order Status',
  'Online Refill Payment status',
  'EKYC Status',
];

export const sanitizeFilenamePart = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'all';

export const normalizeDealerCode = (value = '') => String(value || '').trim().toUpperCase();

export const findUsersByDealerCode = (users = [], dealerCode = '') => {
  const normalizedDealerCode = normalizeDealerCode(dealerCode);
  if (!normalizedDealerCode) return [];
  return (Array.isArray(users) ? users : []).filter((user) => (
    normalizeDealerCode(user?.dealerCode) === normalizedDealerCode
  ));
};

export const getApiDictionaryPreviewEntry = (entry = {}) => {
  const payload = entry?.payload || {};
  return {
    approvalId: entry?.id || entry?.approvalId || payload?.approvalId || '',
    englishWord: String(entry?.englishWord || payload?.englishWord || payload?.eng || '').trim(),
    hindiTranslation: String(entry?.hindiTranslation || payload?.hindiTranslation || payload?.hin || '').trim(),
    phraseKind: String(entry?.phraseKind || payload?.phraseKind || 'token').trim(),
    requestSource: String(entry?.requestSource || payload?.requestSource || '').trim(),
    queueLabel: String(entry?.queueLabel || payload?.queueLabel || '').trim(),
    requestedFrom: String(entry?.requestedFrom || payload?.requestedFrom || '').trim(),
    status: String(entry?.status || payload?.status || 'pending').trim(),
  };
};

export const getDictionaryDocId = (englishWord = '') => (
  encodeURIComponent(String(englishWord || '').trim().toLowerCase()).replace(/\./g, '%2E') || `word-${Date.now()}`
);

export const sanitizeUserForCache = (user = {}) => {
  if (!user || typeof user !== 'object') return user;
  const nextUser = { ...user };
  delete nextUser.pin;
  return nextUser;
};

export const sanitizeUsersForCache = (users = []) => (
  Array.isArray(users) ? users.map((user) => sanitizeUserForCache(user)) : []
);

export const maskSecret = (value = '', visibleCount = 0) => {
  const text = String(value || '').trim();
  if (!text) return 'Not stored';
  const safeVisibleCount = Math.max(0, Number(visibleCount) || 0);
  const maskedLength = Math.max(0, text.length - safeVisibleCount);
  return `${'*'.repeat(maskedLength)}${text.slice(-safeVisibleCount)}`;
};

export const toTagList = (value = '') => (
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

export const upsertStatusHistoryEntry = (history = [], entry = {}) => {
  const nextHistory = Array.isArray(history) ? [...history] : [];
  const entryKey = String(entry.key || '').trim();
  if (!entryKey) return nextHistory;
  const existingIndex = nextHistory.findIndex((item) => item?.key === entryKey);
  if (existingIndex >= 0) {
    nextHistory[existingIndex] = { ...nextHistory[existingIndex], ...entry };
  } else {
    nextHistory.push(entry);
  }
  return nextHistory;
};

export const getFeedbackSlaDaysValue = (item) => {
  const createdAt = item?.createdAt || item?.date || '';
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
};

export const getDrawerSummaryRows = (drawer = {}, users = []) => {
  const data = drawer?.data || {};
  if (drawer?.type === 'detail' && /^User - /.test(drawer?.title || '')) {
    const pendingUpdates = Object.entries(data?.pendingUpdates || {})
      .filter(([, value]) => String(value?.status || '').toLowerCase() === 'pending')
      .length;
    const feedbackEntries = Array.isArray(data?.feedbackEntries) ? data.feedbackEntries.length : 0;
    return [
      { label: 'Dealer Code', value: data?.dealerCode || '-' },
      { label: 'Role', value: data?.role || '-' },
      { label: 'Status', value: data?.status || '-' },
      { label: 'Package', value: data?.package || '-' },
      { label: 'Valid Till', value: formatDisplayDate(data?.validTill) },
      { label: 'Pending Requests', value: pendingUpdates || 0 },
      { label: 'Dictionary Queue', value: Number(data?.dictionaryPendingCount || 0) },
      { label: 'Support Messages', value: feedbackEntries },
    ];
  }
  if (drawer?.type === 'approval') {
    return [
      { label: 'Dealer Code', value: drawer?.dealerCode || data?.dealerCode || '-' },
      { label: 'Request Type', value: drawer?.typeLabel || drawer?.approvalType || drawer?.rawType || '-' },
      { label: 'Requested At', value: formatDisplayDateTime(drawer?.requestedAt || data?.requestedAt) },
      { label: 'Existing Users', value: users.filter((user) => String(user?.dealerCode || '').trim() === String(drawer?.dealerCode || '').trim()).length },
    ];
  }
  if (drawer?.type === 'request') {
    return [
      { label: 'Dealer Code', value: data?.dealerCode || '-' },
      { label: 'Dealer Name', value: data?.dealerName || '-' },
      { label: 'Package', value: data?.package || '-' },
      { label: 'Requested At', value: formatDisplayDateTime(data?.createdAt || data?.approvedAt) },
    ];
  }
  return Object.entries(data || {})
    .slice(0, 8)
    .map(([label, value]) => ({
      label,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value || '-'),
    }));
};

export const formatDrawerFieldLabel = (label = '') => (
  String(label || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

export const formatDrawerFieldValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === 'object') return 'Available';
  return String(value);
};

export const getDrawerDetailSections = (data = {}) => {
  const entries = Object.entries(data || {});
  const hiddenKeys = new Set(['approvalStatus', 'profileData', 'bankDetailsData', 'ratesData', 'hindiHeaderData', 'pendingUpdates', 'lastUploadedData']);
  const simpleFields = [];
  const groupedFields = [];
  const listFields = [];

  entries.forEach(([key, value]) => {
    if (hiddenKeys.has(key)) return;
    if (Array.isArray(value)) {
      listFields.push({ key, value });
      return;
    }
    if (value && typeof value === 'object') {
      groupedFields.push({ key, value });
      return;
    }
    simpleFields.push({ key, value });
  });

  return {
    simpleFields,
    groupedFields,
    listFields,
  };
};

export const PLAN_UPGRADE_OPTIONS = PACKAGE_OPTIONS;

export const normalizePendingTypeLabel = (type) => {
  const raw = String(type || '').toLowerCase().trim();
  if (raw === 'profile' || raw === 'profiledata') return 'profile';
  if (raw === 'bank' || raw === 'bankdetails' || raw === 'bankdetailsdata') return 'bank';
  if (raw === 'rates' || raw === 'rate' || raw === 'ratesdata') return 'rates';
  if (raw === 'header' || raw === 'hindiheader' || raw === 'hindiheaderdata') return 'header';
  if (raw === 'planupgrade' || raw === 'plan' || raw === 'package') return 'plan upgrade';
  if (raw === 'deliveryarea' || raw === 'delivery area') return 'Delivery Area';
  if (raw === 'deliverystaff' || raw === 'delivery staff') return 'Delivery Staff';
  return raw;
};

export const headerMapping = {
  uniqueconsumerid: 'UniqueConsumerId',
  consumerno: 'Consumer No.',
  consumername: 'Consumer Name',
  naturecode_desc: 'Consumer Nature',
  packagecode_desc: 'Consumer Package',
  consumertype: 'Consumer Type',
  orderno: 'Order No.',
  orderstatus: 'Order Status',
  orderdate: 'Order Date',
  ordersource: 'Order Source',
  ordertype: 'Order Type',
  cashmemono: 'Cash Memo No.',
  cashmemostatus: 'Cash Memo Status',
  cashmemodate: 'Cash Memo Date',
  orderquantity: 'Order Qty.',
  consumedsubsidyqty: 'Consumed Subsidy Qty',
  areaname: 'Delivery Area',
  deliveryman: 'Delivery Man',
  refillpaymentstatus: 'Online Refill Payment status',
  ivrsbookingnumber: 'IVR Booking No.',
  mobileno: 'Mobile No.',
  mobilenumber: 'Mobile No.',
  bookingdonethroughregisteremobile: 'Is Reg Mobile',
  consumeraddress: 'Address',
  isrefillport: 'IsRefillPort',
  ekycstatus: 'EKYC Status',
};

export const normalizeData = (data) => data.map((row) => {
  const newRow = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const cleanedKey = key.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      const newKey = headerMapping[cleanedKey] || key.trim();
      newRow[newKey] = row[key];
    }
  }
  if (!newRow['LPG ID'] && newRow.UniqueConsumerId) {
    newRow['LPG ID'] = newRow.UniqueConsumerId;
  }
  return newRow;
});

export const ADMIN_ROLE_PERMISSIONS = {
  'super-admin': { tabs: ['dashboard', 'dictionary', 'pending-registration', 'approval', 'active-user', 'total-user', 'create-user', 'announcements', 'recycle-bin'], mutate: true },
  'approval-admin': { tabs: ['dashboard', 'dictionary', 'pending-registration', 'approval', 'announcements'], mutate: true },
  'support-admin': { tabs: ['dashboard', 'dictionary', 'active-user', 'total-user', 'announcements'], mutate: true },
  viewer: { tabs: ['dashboard', 'dictionary', 'active-user', 'total-user', 'feedback'], mutate: false },
};
