import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import * as XLSX from 'xlsx';
import {
  loadSalesReportData,
  loadSalesReportFromFirebase,
  saveSalesReportData,
  importSalesBatch,
  rollbackSalesBatch,
  confirmMonthData,
  unlockMonthData,
  resetMonthSalesData,
  resetAllSalesData,
  toggleAllowDataReset,
  updateProductSettings,
  toggleUploadStatus,
  DEFAULT_PRODUCT_TYPES,
} from './services/salesReportStore';
import {
  MONTH_NAMES,
  FY_MONTHS,
  FY_MONTH_ORDER,
  formatFYLabel,
} from './utils/salesDataNormalizer';
import SalesFilterBar from './components/SalesReport/SalesFilterBar';
import SalesImportModal from './components/SalesReport/SalesImportModal';
import {
  SimpleBarChart,
  HorizontalBarChart,
  DonutChart,
  RefillDacComparisonChart,
  ProductBreakdownChart,
} from './components/SalesReport/SalesReportCharts';
import './SalesReportPage.css';

const DETAIL_SEARCH_FIELDS = [
  'consumerName', 'consumerNo', 'orderNo', 'cashMemoNo', 'mobileNo',
  'deliveryStaff', 'deliveryArea', 'packageCode', 'natureOfConsumer',
  'paymentMode', 'dacType', 'salesDate', 'actualDeliveryDate',
];

const normalizeDetailSearch = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const buildDetailSearchText = (row) => DETAIL_SEARCH_FIELDS
  .map((field) => normalizeDetailSearch(row?.[field]))
  .filter(Boolean)
  .join(' ');

const SAMPLE_SEPTEMBER_2026_DAYWISE_DAC = [
  { day: 1, date: '01,09,2026', cdcms: 15, otpDac: 235, masterDac: 0, total: 250, dacPercent: '94%' },
  { day: 2, date: '02,09,2026', cdcms: 6, otpDac: 252, masterDac: 0, total: 258, dacPercent: '98%' },
  { day: 3, date: '03,09,2026', cdcms: 9, otpDac: 274, masterDac: 0, total: 283, dacPercent: '97%' },
  { day: 4, date: '04,09,2026', cdcms: 10, otpDac: 259, masterDac: 0, total: 269, dacPercent: '96%' },
  { day: 5, date: '05,09,2026', cdcms: 7, otpDac: 226, masterDac: 0, total: 233, dacPercent: '97%' },
  { day: 6, date: '06,09,2026', cdcms: 6, otpDac: 242, masterDac: 0, total: 248, dacPercent: '98%' },
  { day: 7, date: '07,09,2026', cdcms: 6, otpDac: 270, masterDac: 0, total: 276, dacPercent: '98%' },
  { day: 8, date: '08,09,2026', cdcms: 7, otpDac: 335, masterDac: 0, total: 342, dacPercent: '98%' },
  { day: 9, date: '09,09,2026', cdcms: 7, otpDac: 304, masterDac: 0, total: 311, dacPercent: '98%' },
  { day: 10, date: '10,09,2026', cdcms: 7, otpDac: 366, masterDac: 0, total: 373, dacPercent: '98%' },
  { day: 11, date: '11,09,2026', cdcms: 10, otpDac: 344, masterDac: 0, total: 354, dacPercent: '97%' },
  { day: 12, date: '12,09,2026', cdcms: 11, otpDac: 353, masterDac: 0, total: 364, dacPercent: '97%' },
  { day: 13, date: '13,09,2026', cdcms: 6, otpDac: 326, masterDac: 0, total: 332, dacPercent: '98%' },
  { day: 14, date: '14,09,2026', cdcms: 0, otpDac: 16, masterDac: 0, total: 16, dacPercent: '100%' },
  { day: 15, date: '15,09,2026', cdcms: 9, otpDac: 154, masterDac: 0, total: 163, dacPercent: '94%' },
  { day: 16, date: '16,09,2026', cdcms: 20, otpDac: 429, masterDac: 0, total: 449, dacPercent: '96%' },
  { day: 17, date: '17,09,2026', cdcms: 10, otpDac: 152, masterDac: 0, total: 162, dacPercent: '94%' },
  { day: 18, date: '18,09,2026', cdcms: 18, otpDac: 301, masterDac: 0, total: 319, dacPercent: '94%' },
  { day: 19, date: '19,09,2026', cdcms: 19, otpDac: 240, masterDac: 0, total: 259, dacPercent: '93%' },
  { day: 20, date: '20,09,2026', cdcms: 8, otpDac: 297, masterDac: 0, total: 305, dacPercent: '97%' },
  { day: 21, date: '21,09,2026', cdcms: 5, otpDac: 267, masterDac: 0, total: 272, dacPercent: '98%' },
  { day: 22, date: '22,09,2026', cdcms: 0, otpDac: 0, masterDac: 0, total: 0, dacPercent: '0%' },
  { day: 23, date: '23,09,2026', cdcms: 0, otpDac: 0, masterDac: 0, total: 0, dacPercent: '0%' },
  { day: 24, date: '24,09,2026', cdcms: 0, otpDac: 0, masterDac: 0, total: 0, dacPercent: '0%' },
  { day: 25, date: '25,09,2026', cdcms: 0, otpDac: 0, masterDac: 0, total: 0, dacPercent: '0%' },
  { day: 26, date: '26,09,2026', cdcms: 0, otpDac: 0, masterDac: 0, total: 0, dacPercent: '0%' },
  { day: 27, date: '27,09,2026', cdcms: 0, otpDac: 0, masterDac: 0, total: 0, dacPercent: '0%' },
  { day: 28, date: '28,09,2026', cdcms: 0, otpDac: 0, masterDac: 0, total: 0, dacPercent: '0%' },
  { day: 29, date: '29,09,2026', cdcms: 0, otpDac: 0, masterDac: 0, total: 0, dacPercent: '0%' },
  { day: 30, date: '30,09,2026', cdcms: 0, otpDac: 0, masterDac: 0, total: 0, dacPercent: '0%' },
];

export const DEFAULT_DAC_PRODUCTS = [
  '14.2 KG NON-SUBSIDIZED CYLINDER',
  '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)',
];

// Standard reference delivery staff from DAC Advance Matrix
export const DEFAULT_ADVANCE_DELIVERY_STAFF = [
  'DM Dharmendra',
  'DM Dinesh',
  'DM Raja',
  'LALU BELAHI AREA',
  'LALU DRIVER RUNNI AREA',
  'MAHADEV HP GAS',
  'MAHESH DRIVER',
  'Mani',
  'Prashant',
  'Sunny',
  'Alok Kumar',
  'Kamlesh G',
  'DM Guddu',
  'KRT',
];

const toLocalInputDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const getAdvanceDefaultDates = () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return { today: toLocalInputDate(today), yesterday: toLocalInputDate(yesterday) };
};

// Fallback reference data matching user's September 2026 screenshots
export const SAMPLE_DAC_ADVANCE_DATA = {
  packageWise: [
    { name: '(149)5 KG FILLED LPG CYLINDER(FTL-RFL)', count: 0 },
    { name: '14.2 KG NON-SUBSIDIZED CYLINDER', count: 156 },
    { name: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', count: 5717 },
    { name: '19 KG FILLED LPG CYLINDER', count: 45 },
    { name: '19KG FILLED HP GAS FLAME PLUS VOT', count: 15 },
    { name: '5 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', count: 0 },
  ],
  orderType: [
    { name: 'Pending SV', count: 1 },
    { name: 'Refill', count: 5932 },
  ],
  consumerType: [
    { name: 'DBC', count: 1902 },
    { name: 'SBC', count: 4017 },
  ],
  orderSource: [
    { name: 'Chatbot', count: 40, isOnline: true },
    { name: 'CSC', count: 0, isOnline: true },
    { name: 'Distributor', count: 52, isOnline: false },
    { name: 'E Comm App', count: 45, isOnline: true },
    { name: 'HP Pay', count: 561, isOnline: true },
    { name: 'IVRS', count: 5043, isOnline: true },
    { name: 'Portal', count: 4, isOnline: true },
    { name: 'Vitran', count: 107, isOnline: false },
    { name: 'Other', count: 0, isOnline: false },
  ],
  deliveryStaff: [
    { name: 'DM Dharmendra', month: 665, day1: 0, day2: 31 },
    { name: 'DM Dinesh', month: 630, day1: 0, day2: 31 },
    { name: 'DM Raja', month: 548, day1: 0, day2: 35 },
    { name: 'LALU BELAHI AREA', month: 325, day1: 3, day2: 13 },
    { name: 'LALU DRIVER RUNNI AREA', month: 626, day1: 2, day2: 41 },
    { name: 'MAHADEV HP GAS', month: 254, day1: 10, day2: 27 },
    { name: 'MAHESH DRIVER', month: 0, day1: 0, day2: 0 },
    { name: 'Mani', month: 594, day1: 0, day2: 0 },
    { name: 'Prashant', month: 687, day1: 20, day2: 58 },
    { name: 'Sunny', month: 755, day1: 0, day2: 0 },
    { name: 'Alok Kumar', month: 0, day1: 0, day2: 0 },
    { name: 'Kamlesh G', month: 560, day1: 0, day2: 31 },
    { name: 'DM Guddu', month: 33, day1: 0, day2: 0 },
    { name: 'KRT', month: 0, day1: 0, day2: 0 },
  ],
};

const INITIAL_FILTERS = {
  fy: 'ALL',
  monthNo: 'ALL',
  startDate: '',
  endDate: '',
  orderStatus: 'ALL',
  orderSource: 'ALL',
  orderType: 'ALL',
  natureOfConsumer: 'ALL',
  packageCode: 'ALL',
  selectedProducts: [],
  typeOfConsumer: 'ALL',
  deliveryMode: 'ALL',
  deliveryStaff: 'ALL',
  deliveryArea: 'ALL',
  isRegMobile: 'ALL',
  dacType: 'ALL',
  isRefillPort: 'ALL',
  ekycStatus: 'ALL',
};

function SectionFilterToolbar({
  monthNo,
  selectedProducts = [],
  availableProducts = [],
  onMonthChange,
  onProductsChange,
  onReset,
  extraBadge,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const isAll = selectedProducts.length === 0;
  const isDefault =
    selectedProducts.length === DEFAULT_DAC_PRODUCTS.length &&
    DEFAULT_DAC_PRODUCTS.every((p) => selectedProducts.includes(p));

  const buttonLabel = isAll
    ? `All Products (${availableProducts.length})`
    : isDefault
    ? `14.2 KG Domestic (Default: 2)`
    : `${selectedProducts.length} Product${selectedProducts.length > 1 ? 's' : ''} Selected`;

  return (
    <div className="section-filter-toolbar no-print">
      <div className="section-filter-row">
        <div className="section-filter-controls">
          {/* Month Dropdown */}
          <div className="section-filter-item">
            <label>📅 Select Month</label>
            <select
              className="section-filter-select"
              value={monthNo || 'ALL'}
              onChange={(e) => onMonthChange(e.target.value)}
            >
              <option value="ALL">All Months</option>
              {FY_MONTHS.map((m) => (
                <option key={m.monthCode} value={m.monthCode}>
                  {m.name} ({m.monthCode})
                </option>
              ))}
            </select>
          </div>

          {/* Multi-Product Select */}
          <div className="section-filter-item">
            <label>📦 Multi-Product Select</label>
            <div className="daywise-multiselect-wrap" ref={popoverRef}>
              <button
                type="button"
                className={`daywise-multiselect-btn ${selectedProducts.length > 0 ? 'is-active' : ''}`}
                onClick={() => setDropdownOpen((prev) => !prev)}
              >
                <span>{buttonLabel}</span>
                <span style={{ fontSize: '10px' }}>{dropdownOpen ? '▲' : '▼'}</span>
              </button>

              {dropdownOpen && (
                <div className="daywise-multiselect-popover">
                  <div className="daywise-multiselect-header">
                    <span>Choose Products</span>
                    <div className="daywise-multiselect-actions">
                      <button
                        type="button"
                        onClick={() => onProductsChange(DEFAULT_DAC_PRODUCTS)}
                        title="Select default 14.2 KG Domestic cylinders"
                      >
                        Default (14.2 KG)
                      </button>
                      <button
                        type="button"
                        onClick={() => onProductsChange([])}
                        title="Include all products without filter"
                      >
                        All ({availableProducts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => onProductsChange([])}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="daywise-multiselect-list">
                    {availableProducts.map((p) => {
                      const isChecked = selectedProducts.includes(p);
                      return (
                        <label key={p} className="daywise-product-checkbox-label">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                onProductsChange(selectedProducts.filter((item) => item !== p));
                              } else {
                                onProductsChange([...selectedProducts, p]);
                              }
                            }}
                          />
                          <span title={p} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: '8px', textAlign: 'right', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                    <button
                      type="button"
                      className="sales-report-btn sales-report-btn--primary"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => setDropdownOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reset Filters */}
          <div className="section-filter-item">
            <button
              type="button"
              className="section-filter-reset-btn"
              onClick={onReset}
              title="Reset Month and Product filters"
            >
              🔄 Reset Filters
            </button>
          </div>
        </div>

        {/* Active Filter Summary Badge */}
        {(monthNo !== 'ALL' || selectedProducts.length > 0 || extraBadge) && (
          <div className="section-filter-badge">
            Active: {monthNo !== 'ALL' ? MONTH_NAMES[parseInt(monthNo, 10) - 1] : 'All Months'}
            {selectedProducts.length > 0
              ? isDefault
                ? ' • 14.2 KG Domestic (2 Products)'
                : ` • ${selectedProducts.length} Product${selectedProducts.length > 1 ? 's' : ''}`
              : ' • All Products'}
            {extraBadge ? ` • ${extraBadge}` : ''}
          </div>
        )}
      </div>

      {/* Selected Product Badges Bar */}
      {selectedProducts.length > 0 && (
        <div className="daywise-selected-chips-bar" style={{ marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Filtered Products:</span>
          {selectedProducts.map((p) => (
            <span key={p} className="daywise-product-chip" title={p}>
              {p.slice(0, 32)}{p.length > 32 ? '…' : ''}
              <button
                type="button"
                onClick={() => onProductsChange(selectedProducts.filter((item) => item !== p))}
                title="Remove product filter"
              >
                ✕
              </button>
            </span>
          ))}
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: '0 4px' }}
            onClick={() => onProductsChange([])}
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}

export default function SalesReportPage({ loggedInUser, parsedData = [], onClose }) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonthCode = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentMonthName = MONTH_NAMES[currentDate.getMonth()];
  const [storeData, setStoreData] = useState(() => loadSalesReportData(loggedInUser));
  const loggedInUserRef = useRef(loggedInUser);
  loggedInUserRef.current = loggedInUser;
  const salesReportAccountKey = String(
    loggedInUser?.id || loggedInUser?.dealerCode || loggedInUser?.dealerName || 'default',
  );
  // Tabs: 'overview' | 'consumerSearch' | 'currentMonthDac' | 'productWise' | 'monthWise' | 'monthlyDac' | 'dayWise' | 'fyWise' | 'breakdowns' | 'upload' | 'history' | 'detailed' | 'settings'
  const [activeTab, setActiveTab] = useState('overview');

  const [consumerSearchMode, setConsumerSearchMode] = useState('consumerNo');
  const [consumerSearchQuery, setConsumerSearchQuery] = useState('');
  const [consumerSearchFocused, setConsumerSearchFocused] = useState(false);
  const [selectedConsumerSearchNo, setSelectedConsumerSearchNo] = useState('');

  // Breakdown sub-navigation
  const [breakdownTab, setBreakdownTab] = useState('area'); // 'area' | 'staff' | 'package' | 'nature' | 'source' | 'ekyc' | 'cancellation'
  const [areaPage, setAreaPage] = useState(1);
  const [areasPerPage, setAreasPerPage] = useState(10);
  const [selectedAdvancedReport, setSelectedAdvancedReport] = useState(null);
  const [advancedDetailPage, setAdvancedDetailPage] = useState(1);

  // Sales Date Basis (Section 36)
  const [salesDateBasis, setSalesDateBasis] = useState(storeData?.settings?.salesDateBasis || 'actualDeliveryDate');

  // Combined Filters State
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  // Import Modal Configuration
  const [importModalConfig, setImportModalConfig] = useState({
    isOpen: false,
    uploadType: 'monthWise',
    year: currentYear,
    monthCode: currentMonthCode,
  });

  // Uploads view state
  const [uploadYear, setUploadYear] = useState(currentYear);

  // Settings custom product addition state
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Domestic');
  const [newProductRate, setNewProductRate] = useState('1039');

  // Setting 2: Product & Package Code Enable / Disable Month Selector & Rate Edit
  const [productSettingYm, setProductSettingYm] = useState('CURRENT');
  const [editingRateProd, setEditingRateProd] = useState(null);
  const [editingRateVal, setEditingRateVal] = useState('');

  // Search & Pagination in Detailed View
  const [detailSearch, setDetailSearch] = useState('');
  const deferredDetailSearch = useDeferredValue(detailSearch);
  const [detailPage, setDetailPage] = useState(1);
  const [detailRowsPerPage, setDetailRowsPerPage] = useState(25);
  const [savingUploadToggle, setSavingUploadToggle] = useState(false);
  const [savingResetToggle, setSavingResetToggle] = useState(false);

  // Month-vs-Month Comparison Pickers
  const [compMonthA, setCompMonthA] = useState('08');
  const [compMonthB, setCompMonthB] = useState('09');

  // Day-wise DAC Report Filter States (Past Month & Multi-Product selection)
  const [dacReportMonth, setDacReportMonth] = useState('09');
  const [dacReportYear, setDacReportYear] = useState(2026);
  const [dacSelectedProducts, setDacSelectedProducts] = useState(DEFAULT_DAC_PRODUCTS);
  const [dacProductDropdownOpen, setDacProductDropdownOpen] = useState(false);

  // DAC Advance Report States
  const [advanceDacMonth, setAdvanceDacMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [advanceDacYear, setAdvanceDacYear] = useState(() => new Date().getFullYear());
  const [advanceDacDay1, setAdvanceDacDay1] = useState(() => getAdvanceDefaultDates().today);
  const [advanceDacDay2, setAdvanceDacDay2] = useState(() => getAdvanceDefaultDates().yesterday);
  const [advanceDacMode, setAdvanceDacMode] = useState('otpDac'); // 'otpDac' | 'all'
  const [deliveryDrilldown, setDeliveryDrilldown] = useState(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.().catch(() => {});
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Notification flash
  const [notification, setNotification] = useState(null);

  // Admin privileges
  const userRole = String(loggedInUser?.role || loggedInUser?.userType || '').toLowerCase();
  const isAdmin = !userRole || userRole.includes('admin') || userRole.includes('dealer') || userRole.includes('owner');

  // Cloud sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [hasCompletedInitialSync, setHasCompletedInitialSync] = useState(false);
  const [cloudOperation, setCloudOperation] = useState(null);
  const progressOptions = (label) => ({
    onProgress: (percent) => setCloudOperation({ label, percent }),
  });

  // Load from Firebase on mount
  useEffect(() => {
    let active = true;
    const syncUser = loggedInUserRef.current;
    setHasCompletedInitialSync(false);
    setIsSyncing(true);
    setSyncProgress(0);
    loadSalesReportFromFirebase(syncUser, {
      onProgress: (percent) => { if (active) setSyncProgress(percent); },
    }).then((remote) => {
      if (active && remote) {
        setStoreData(remote);
      }
    }).finally(() => {
      if (active) {
        setIsSyncing(false);
        setHasCompletedInitialSync(true);
      }
    });
    return () => { active = false; };
  }, [salesReportAccountKey]);

  const handleManualCloudSync = async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    try {
      const remote = await loadSalesReportFromFirebase(loggedInUser, { onProgress: setSyncProgress });
      if (remote) {
        setStoreData(remote);
        showNotification(`Cloud sync complete! ${remote.transactions?.length || 0} transactions synchronized.`, 'success');
      } else {
        showNotification('Cloud data synchronized successfully.', 'success');
      }
    } catch (err) {
      console.error('Cloud sync error:', err);
      showNotification('Cloud sync failed. Please check connection.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const showNotification = (text, tone = 'success') => {
    setNotification({ text, tone });
    setTimeout(() => setNotification(null), 4000);
  };

  const uploadEnabled = storeData?.settings?.uploadEnabled !== false;
  const transactions = Array.isArray(storeData.transactions) ? storeData.transactions : [];
  const batches = Array.isArray(storeData.batches) ? storeData.batches : [];
  const lockedMonths = storeData?.settings?.lockedMonths || {};

  const consumerSearchIndex = useMemo(() => {
    const fields = ['consumerNo', 'mobileNo', 'orderNo', 'cashMemoNo', 'consumerName'];
    const index = Object.fromEntries(fields.map((field) => [field, { suggestions: [], suggestionKeys: new Set(), rows: new Map() }]));
    const normalize = (field, value) => field === 'mobileNo'
      ? String(value || '').replace(/\D/g, '')
      : String(value || '').trim().replace(/\s+/g, '').toLowerCase();

    transactions.forEach((row) => {
      fields.forEach((field) => {
        const displayValue = String(row[field] || '').trim();
        const normalized = normalize(field, displayValue);
        if (!normalized) return;
        if (!index[field].rows.has(normalized)) index[field].rows.set(normalized, []);
        const suggestionKey = field === 'consumerName' ? `${normalized}|${row.consumerNo || ''}` : normalized;
        if (!index[field].suggestionKeys.has(suggestionKey)) {
          index[field].suggestionKeys.add(suggestionKey);
          index[field].suggestions.push({
            value: displayValue,
            normalized,
            consumerName: row.consumerName || 'Unknown Consumer',
            consumerNo: row.consumerNo || '—',
            mobile: row.mobileNo || '—',
          });
        }
        index[field].rows.get(normalized).push(row);
      });
    });
    fields.forEach((field) => {
      index[field].suggestions.sort((a, b) => a.normalized.localeCompare(b.normalized, undefined, { numeric: true }));
    });
    return index;
  }, [transactions]);

  const consumerSearchResults = useMemo(() => {
    const queryValue = consumerSearchMode === 'mobileNo'
      ? consumerSearchQuery.replace(/\D/g, '')
      : consumerSearchQuery.trim().replace(/\s+/g, '').toLowerCase();
    if (!queryValue) return [];
    const field = {
      consumerNo: 'consumerNo',
      mobileNo: 'mobileNo',
      orderNo: 'orderNo',
      cashMemoNo: 'cashMemoNo',
      consumerName: 'consumerName',
    }[consumerSearchMode] || 'consumerNo';
    if (consumerSearchMode === 'consumerName' && !selectedConsumerSearchNo) return [];
    const matchedRows = [...(consumerSearchIndex[field]?.rows.get(queryValue) || [])];
    const selectedRows = consumerSearchMode === 'consumerName' && selectedConsumerSearchNo
      ? matchedRows.filter((row) => String(row.consumerNo || '') === selectedConsumerSearchNo)
      : matchedRows;
    return selectedRows
      .sort((a, b) => String(b.actualDeliveryDate || b.cashMemoDate || b.orderDateKey || b.orderDate || '')
        .localeCompare(String(a.actualDeliveryDate || a.cashMemoDate || a.orderDateKey || a.orderDate || '')));
  }, [consumerSearchIndex, consumerSearchMode, consumerSearchQuery, selectedConsumerSearchNo]);

  const activeConsumerSearchSuggestions = useMemo(() => {
    const field = {
      consumerNo: 'consumerNo',
      mobileNo: 'mobileNo',
      orderNo: 'orderNo',
      cashMemoNo: 'cashMemoNo',
      consumerName: 'consumerName',
    }[consumerSearchMode] || 'consumerNo';
    const normalize = (value) => consumerSearchMode === 'mobileNo'
      ? String(value || '').replace(/\D/g, '')
      : String(value || '').trim().replace(/\s+/g, '').toLowerCase();
    const queryValue = normalize(consumerSearchQuery);
    const suggestions = consumerSearchIndex[field]?.suggestions || [];
    if (!queryValue) return suggestions.slice(0, 8);
    const prefixMatches = [];
    const containsMatches = [];
    for (const suggestion of suggestions) {
      if (suggestion.normalized.startsWith(queryValue)) prefixMatches.push(suggestion);
      else if (suggestion.normalized.includes(queryValue)) containsMatches.push(suggestion);
      if (prefixMatches.length >= 8) break;
    }
    return [...prefixMatches, ...containsMatches].slice(0, 8);
  }, [consumerSearchIndex, consumerSearchMode, consumerSearchQuery]);

  // Open Import Modal helper
  const openImportModal = (uploadType = 'monthWise', year = currentYear, monthCode = currentMonthCode) => {
    if (!uploadEnabled && !isAdmin) {
      showNotification('Sales data uploads are currently disabled in Settings.', 'error');
      return;
    }
    setImportModalConfig({
      isOpen: true,
      uploadType,
      year,
      monthCode,
    });
  };

  // Change Sales Date Basis
  const handleSalesDateBasisChange = async (newBasis) => {
    setSalesDateBasis(newBasis);
    const nextStore = {
      ...storeData,
      settings: {
        ...storeData.settings,
        salesDateBasis: newBasis,
      },
    };
    setStoreData(nextStore);
    await saveSalesReportData(loggedInUser, nextStore);
    const label = newBasis === 'orderDate' ? 'Order Date' : newBasis === 'cashMemoDate' ? 'CashMemo Date' : 'Actual Delivery Date';
    showNotification(`Sales Date basis updated to: ${label}`);
  };

  // Confirm month data lock
  const handleConfirmMonth = async (ym) => {
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (ym === currentYm) {
      showNotification('Current month is always unlocked and cannot be confirmed.', 'error');
      return;
    }
    try {
      setCloudOperation({ label: `Locking ${ym}`, percent: 0 });
      const confirmedBy = loggedInUser?.dealerName || loggedInUser?.username || 'User';
      const nextStore = await confirmMonthData(loggedInUser, storeData, ym, confirmedBy, progressOptions(`Locking ${ym}`));
      setStoreData(nextStore);
      showNotification(`Month ${ym} confirmed and locked against re-upload.`);
    } catch (err) {
      showNotification(err.message || 'Confirmation failed.', 'error');
    } finally {
      setCloudOperation(null);
    }
  };

  // Admin unlock month
  const handleUnlockMonth = async (ym) => {
    const canUnlockForReupload = isAdmin || loggedInUser?.userAccess?.allowSalesReupload === true;
    if (!canUnlockForReupload) {
      showNotification('Re-upload permission is required to unlock months.', 'error');
      return;
    }
    try {
      setCloudOperation({ label: `Unlocking ${ym}`, percent: 0 });
      const unlockedBy = loggedInUser?.dealerName || loggedInUser?.username || 'Admin';
      const nextStore = await unlockMonthData(loggedInUser, storeData, ym, unlockedBy, progressOptions(`Unlocking ${ym}`));
      setStoreData(nextStore);
      showNotification(`Month ${ym} unlocked by Admin. Re-upload is now enabled.`);
    } catch (err) {
      showNotification(err.message || 'Unlock failed.', 'error');
    } finally {
      setCloudOperation(null);
    }
  };

  // Toggle allowDataReset setting (Enable / Disable reset protection)
  const handleToggleAllowDataReset = async (enabled) => {
    if (savingResetToggle) return;
    const previousStore = storeData;
    const optimisticStore = {
      ...previousStore,
      settings: { ...previousStore.settings, allowDataReset: enabled },
    };
    setStoreData(optimisticStore);
    setSavingResetToggle(true);
    try {
      const nextStore = await toggleAllowDataReset(loggedInUser, optimisticStore, enabled);
      setStoreData(nextStore);
      showNotification(`Uploaded Data Reset is now ${enabled ? 'ENABLED' : 'DISABLED'}.`);
    } catch (err) {
      setStoreData(previousStore);
      showNotification('Failed to update reset permission setting.', 'error');
    } finally {
      setSavingResetToggle(false);
    }
  };

  // Reset/Delete a specific month's uploaded sales data
  const handleResetMonthData = async (ym) => {
    const isResetAllowed = storeData.settings?.allowDataReset === true;
    if (!isResetAllowed) {
      showNotification('Uploaded Data Reset is DISABLED. Please enable the toggle in settings first.', 'error');
      return;
    }
    const confirmed = window.confirm(
      `⚠️ ARE YOU SURE you want to reset & delete all uploaded sales records for ${ym}?\n\nThis will remove all transactions for this month and unlock the period. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setCloudOperation({ label: `Resetting ${ym}`, percent: 0 });
      const nextStore = await resetMonthSalesData(loggedInUser, storeData, ym, progressOptions(`Resetting ${ym}`));
      setStoreData(nextStore);
      showNotification(`✅ Successfully reset and removed uploaded sales data for ${ym}.`);
    } catch (err) {
      showNotification(err.message || 'Failed to reset month data.', 'error');
    } finally {
      setCloudOperation(null);
    }
  };

  // Reset/Delete ALL uploaded sales data
  const handleResetAllData = async () => {
    const isResetAllowed = storeData.settings?.allowDataReset === true;
    if (!isResetAllowed) {
      showNotification('Uploaded Data Reset is DISABLED. Please enable the toggle in settings first.', 'error');
      return;
    }
    const confirmed = window.confirm(
      `🚨 CRITICAL WARNING: You are about to RESET ALL UPLOADED SALES DATA across ALL months.\n\nAll imported transactions, batches, and records will be permanently deleted.\n\nAre you sure you want to proceed?`
    );
    if (!confirmed) return;

    try {
      setCloudOperation({ label: 'Resetting all sales data', percent: 0 });
      const nextStore = await resetAllSalesData(loggedInUser, storeData, progressOptions('Resetting all sales data'));
      setStoreData(nextStore);
      showNotification('✅ All uploaded sales data has been reset successfully.');
    } catch (err) {
      showNotification(err.message || 'Failed to reset all data.', 'error');
    } finally {
      setCloudOperation(null);
    }
  };

  // Toggle upload enabled in settings
  const handleToggleUpload = async (enabled) => {
    if (savingUploadToggle) return;
    const previousStore = storeData;
    const optimisticStore = {
      ...previousStore,
      settings: { ...previousStore.settings, uploadEnabled: enabled },
    };
    setStoreData(optimisticStore);
    setSavingUploadToggle(true);
    try {
      const nextStore = await toggleUploadStatus(loggedInUser, optimisticStore, enabled);
      setStoreData(nextStore);
      showNotification(`Uploads ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setStoreData(previousStore);
      showNotification('Failed to update upload setting.', 'error');
    } finally {
      setSavingUploadToggle(false);
    }
  };

  // Toggle product type in settings (by Name or Package Code)
  const handleToggleProductByName = async (prodName, enabled) => {
    try {
      const currentDisabled = Array.isArray(storeData.settings?.disabledProducts)
        ? [...storeData.settings.disabledProducts]
        : [];
      const lowerName = String(prodName || '').trim().toLowerCase();

      let nextDisabled;
      if (enabled) {
        nextDisabled = currentDisabled.filter((p) => String(p).trim().toLowerCase() !== lowerName);
      } else {
        if (!currentDisabled.some((p) => String(p).trim().toLowerCase() === lowerName)) {
          nextDisabled = [...currentDisabled, String(prodName).trim()];
        } else {
          nextDisabled = currentDisabled;
        }
      }

      // Also update storeData.settings.products array for backwards compatibility
      const currentProducts = Array.isArray(storeData.settings?.products)
        ? [...storeData.settings.products]
        : [...DEFAULT_PRODUCT_TYPES];
      const existingIdx = currentProducts.findIndex(
        (p) => String(p.name || '').trim().toLowerCase() === lowerName
      );
      let nextProducts;
      if (existingIdx >= 0) {
        nextProducts = currentProducts.map((p, idx) =>
          idx === existingIdx ? { ...p, enabled } : p
        );
      } else {
        nextProducts = [...currentProducts, { id: `prod_${Date.now()}`, name: prodName, enabled }];
      }

      const nextStore = {
        ...storeData,
        settings: {
          ...storeData.settings,
          disabledProducts: nextDisabled,
          products: nextProducts,
        },
      };

      setStoreData(nextStore);
      await saveSalesReportData(loggedInUser, nextStore);
      showNotification(`${prodName} is now ${enabled ? 'ENABLED (Active)' : 'DISABLED'}.`);
    } catch (err) {
      showNotification('Failed to update product setting.', 'error');
    }
  };

  // Backward compatibility alias for handleToggleProduct
  const handleToggleProduct = (productIdOrName, enabled) => {
    handleToggleProductByName(productIdOrName, enabled);
  };

  // Save custom override rate for a product
  const handleSaveProductRate = async (prodName, newRate) => {
    try {
      const parsed = parseFloat(newRate);
      if (isNaN(parsed) || parsed < 0) {
        showNotification('Please enter a valid rate.', 'error');
        return;
      }
      const nextCustomRates = {
        ...(storeData.settings?.customProductRates || {}),
        [prodName]: parsed,
      };
      const nextStore = {
        ...storeData,
        settings: {
          ...storeData.settings,
          customProductRates: nextCustomRates,
        },
      };
      setStoreData(nextStore);
      await saveSalesReportData(loggedInUser, nextStore);
      setEditingRateProd(null);
      setEditingRateVal('');
      showNotification(`Default rate for ${prodName} updated to ₹${parsed.toFixed(2)}.`);
    } catch (err) {
      showNotification('Failed to update rate.', 'error');
    }
  };

  // Reset custom override rate to auto-fetched month rate
  const handleResetProductRate = async (prodName) => {
    try {
      const nextCustomRates = { ...(storeData.settings?.customProductRates || {}) };
      delete nextCustomRates[prodName];
      const nextStore = {
        ...storeData,
        settings: {
          ...storeData.settings,
          customProductRates: nextCustomRates,
        },
      };
      setStoreData(nextStore);
      await saveSalesReportData(loggedInUser, nextStore);
      showNotification(`Reset rate for ${prodName} to auto-fetched month rate.`);
    } catch (err) {
      showNotification('Failed to reset rate.', 'error');
    }
  };

  // Add custom product type in settings
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProductName.trim()) return;
    try {
      const currentProducts = storeData.settings?.products || DEFAULT_PRODUCT_TYPES;
      const parsedRate = parseFloat(newProductRate) || 0;
      const newProd = {
        id: `custom_${Date.now()}`,
        name: newProductName.trim(),
        category: newProductCategory,
        defaultRate: parsedRate,
        enabled: true,
      };
      const updated = [...currentProducts, newProd];
      const customRates = {
        ...(storeData.settings?.customProductRates || {}),
        [newProd.name]: parsedRate,
      };
      const nextStore = {
        ...storeData,
        settings: {
          ...storeData.settings,
          products: updated,
          customProductRates: customRates,
        },
      };
      setStoreData(nextStore);
      await saveSalesReportData(loggedInUser, nextStore);
      setNewProductName('');
      setNewProductRate('1039');
      showNotification(`Added product: ${newProd.name}`);
    } catch (err) {
      showNotification('Failed to add product.', 'error');
    }
  };

  // ==========================================
  // DYNAMIC FILTER OPTIONS
  // ==========================================
  const availableOptions = useMemo(() => {
    const fys = new Set();
    const orderStatuses = new Set();
    const orderSources = new Set();
    const orderTypes = new Set();
    const consumerNatures = new Set();
    const packageCodes = new Set();
    const consumerTypes = new Set();
    const deliveryModes = new Set();
    const deliveryStaffList = new Set();
    const deliveryAreas = new Set();
    const dacTypes = new Set();
    const ekycStatuses = new Set();

    transactions.forEach((r) => {
      if (r.fy) fys.add(r.fy);
      if (r.orderStatus) orderStatuses.add(r.orderStatus);
      if (r.orderSource) orderSources.add(r.orderSource);
      if (r.orderType) orderTypes.add(r.orderType);
      if (r.natureOfConsumer) consumerNatures.add(r.natureOfConsumer);
      if (r.packageCode) packageCodes.add(r.packageCode);
      if (r.typeOfConsumer) consumerTypes.add(r.typeOfConsumer);
      if (r.deliveryMode) deliveryModes.add(r.deliveryMode);
      if (r.deliveryStaff) deliveryStaffList.add(r.deliveryStaff);
      if (r.deliveryArea) deliveryAreas.add(r.deliveryArea);
      if (r.dacType) dacTypes.add(r.dacType);
      if (r.ekycStatus) ekycStatuses.add(r.ekycStatus);
    });

    return {
      fys: Array.from(fys).sort(),
      orderStatuses: Array.from(orderStatuses).sort(),
      orderSources: Array.from(orderSources).sort(),
      orderTypes: Array.from(orderTypes).sort(),
      consumerNatures: Array.from(consumerNatures).sort(),
      packageCodes: Array.from(packageCodes).sort(),
      consumerTypes: Array.from(consumerTypes).sort(),
      deliveryModes: Array.from(deliveryModes).sort(),
      deliveryStaffList: Array.from(deliveryStaffList).sort(),
      deliveryAreas: Array.from(deliveryAreas).sort(),
      dacTypes: Array.from(dacTypes).sort(),
      ekycStatuses: Array.from(ekycStatuses).sort(),
    };
  }, [transactions]);

  // ==========================================
  // FILTERED TRANSACTIONS WITH SALES DATE BASIS
  // ==========================================
  const filteredTransactions = useMemo(() => {
    return transactions.filter((r) => {
      const effectiveDate = salesDateBasis === 'orderDate'
        ? (r.orderDateKey || r.salesDate)
        : salesDateBasis === 'cashMemoDate'
          ? (r.cashMemoDate || r.salesDate)
          : (r.actualDeliveryDate || r.salesDate);

      if (filters.fy !== 'ALL' && r.fy !== filters.fy) return false;
      if (filters.monthNo !== 'ALL' && String(r.monthNo).padStart(2, '0') !== filters.monthNo) return false;
      if (filters.startDate && effectiveDate < filters.startDate) return false;
      if (filters.endDate && effectiveDate > filters.endDate) return false;
      if (filters.orderStatus !== 'ALL' && r.orderStatus !== filters.orderStatus) return false;
      if (filters.orderSource !== 'ALL' && r.orderSource !== filters.orderSource) return false;
      if (filters.orderType !== 'ALL' && r.orderType !== filters.orderType) return false;
      if (filters.natureOfConsumer !== 'ALL' && r.natureOfConsumer !== filters.natureOfConsumer) return false;

      // Product Enable / Disable check from Settings
      const disabledProducts = storeData?.settings?.disabledProducts || [];
      if (disabledProducts.length > 0) {
        const pkg = String(r.packageCode || '').trim().toLowerCase();
        const pType = String(r.productType || '').trim().toLowerCase();
        if (
          disabledProducts.some((d) => {
            const dl = String(d).trim().toLowerCase();
            return dl === pkg || dl === pType;
          })
        ) {
          return false;
        }
      }
      const storedDisabled = (storeData?.settings?.products || [])
        .filter((p) => p.enabled === false)
        .map((p) => String(p.name || '').trim().toLowerCase());
      if (storedDisabled.length > 0) {
        const pkg = String(r.packageCode || '').trim().toLowerCase();
        const pType = String(r.productType || '').trim().toLowerCase();
        if (storedDisabled.includes(pkg) || storedDisabled.includes(pType)) {
          return false;
        }
      }

      // Multi-Product Filter (or single packageCode filter)
      if (Array.isArray(filters.selectedProducts) && filters.selectedProducts.length > 0) {
        const rawP = String(r.packageCode || r.productType || '').trim();
        if (!filters.selectedProducts.some((sel) => sel.toLowerCase() === rawP.toLowerCase())) {
          return false;
        }
      } else if (filters.packageCode !== 'ALL' && r.packageCode !== filters.packageCode) {
        return false;
      }
      if (filters.typeOfConsumer !== 'ALL' && r.typeOfConsumer !== filters.typeOfConsumer) return false;
      if (filters.deliveryMode !== 'ALL' && r.deliveryMode !== filters.deliveryMode) return false;
      if (filters.deliveryStaff !== 'ALL' && r.deliveryStaff !== filters.deliveryStaff) return false;
      if (filters.deliveryArea !== 'ALL' && r.deliveryArea !== filters.deliveryArea) return false;
      if (filters.isRegMobile !== 'ALL' && r.isRegMobile !== filters.isRegMobile) return false;
      if (filters.dacType !== 'ALL' && r.dacType !== filters.dacType) return false;
      if (filters.isRefillPort !== 'ALL' && r.isRefillPort !== filters.isRefillPort) return false;
      if (filters.ekycStatus !== 'ALL' && r.ekycStatus !== filters.ekycStatus) return false;
      return true;
    }).map((r) => {
      const effectiveDate = salesDateBasis === 'orderDate'
        ? (r.orderDateKey || r.salesDate)
        : salesDateBasis === 'cashMemoDate'
          ? (r.cashMemoDate || r.salesDate)
          : (r.actualDeliveryDate || r.salesDate);
      return {
        ...r,
        salesDate: effectiveDate,
      };
    });
  }, [transactions, filters, salesDateBasis, storeData?.settings]);

  // FY headline remains an annual total even when the dashboard month filter
  // is used for month/day-specific cards and charts.
  const fyHeadline = useMemo(() => {
    let refill = 0;
    let dac = 0;
    const activeDays = new Set();
    transactions.forEach((row) => {
      if (filters.fy !== 'ALL' && row.fy !== filters.fy) return;
      const qty = Number(row.orderQuantity) || 1;
      refill += qty;
      if (row.dacVerified) dac += qty;
      const date = salesDateBasis === 'orderDate'
        ? (row.orderDateKey || row.salesDate)
        : salesDateBasis === 'cashMemoDate'
          ? (row.cashMemoDate || row.salesDate)
          : (row.actualDeliveryDate || row.salesDate);
      if (date) activeDays.add(String(date).slice(0, 10));
    });
    return {
      refill,
      dac,
      dacPercent: refill > 0 ? ((dac / refill) * 100).toFixed(1) : '0.0',
      activeDays: Math.max(activeDays.size, 1),
      averageDaily: Math.round(refill / Math.max(activeDays.size, 1)),
    };
  }, [transactions, filters.fy, salesDateBasis]);

  const fyMonthlyRefillChart = useMemo(() => {
    const totals = {};
    transactions.forEach((row) => {
      if (filters.fy !== 'ALL' && row.fy !== filters.fy) return;
      const monthNo = Number(row.monthNo);
      if (monthNo < 1 || monthNo > 12) return;
      totals[monthNo] = (totals[monthNo] || 0) + (Number(row.orderQuantity) || 1);
    });
    return FY_MONTHS.map((month) => ({
      label: month.shortName,
      value: totals[month.monthNo] || 0,
    }));
  }, [transactions, filters.fy]);

  const financialYearComparisonChart = useMemo(() => {
    const totals = {};
    transactions.forEach((row) => {
      if (filters.fy !== 'ALL' && row.fy !== filters.fy) return;
      const fy = row.fy ? formatFYLabel(row.fy) : 'Unknown';
      totals[fy] = (totals[fy] || 0) + (Number(row.orderQuantity) || 1);
    });
    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ label, value }));
  }, [transactions, filters.fy]);

  // ==========================================
  // TOP DASHBOARD KPIS (Section 40)
  // ==========================================
  const dashboardKpis = useMemo(() => {
    let totalRefillQuantity = 0;
    let totalOrders = 0;
    let totalTransactionsCount = filteredTransactions.length;
    let totalSalesValue = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let dacVerifiedCount = 0;
    const uniqueConsumers = new Set();
    const distinctDays = new Set();

    filteredTransactions.forEach((r) => {
      const q = Number(r.orderQuantity) || 1;
      totalRefillQuantity += q;
      totalOrders += q;
      totalSalesValue += (r.salesValue || 0);
      if (r.consumerNo) uniqueConsumers.add(r.consumerNo);
      if (r.salesDate) distinctDays.add(r.salesDate);

      const isDelivered = r.orderStatus === 'Delivered';
      const isCancelled = r.orderStatus === 'Cancelled' || r.cashMemoCancelDate;

      if (isDelivered) deliveredOrders += q;
      if (isCancelled) cancelledOrders += q;
      if (r.dacVerified) dacVerifiedCount += q;
    });

    const activeDaysCount = Math.max(distinctDays.size, 1);
    const averageDailySales = Math.round(totalRefillQuantity / activeDaysCount);
    const dacPercent = totalRefillQuantity > 0 ? ((dacVerifiedCount / totalRefillQuantity) * 100).toFixed(1) : '0.0';

    const toLocalDateKey = (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const todayKey = toLocalDateKey(today);
    const yesterdayKey = toLocalDateKey(yesterday);
    const selectedMonthNo = filters.monthNo !== 'ALL'
      ? parseInt(filters.monthNo, 10)
      : today.getMonth() + 1;
    const selectedMonthYears = filteredTransactions
      .filter((row) => Number(row.monthNo) === selectedMonthNo)
      .map((row) => Number(row.year))
      .filter(Number.isFinite);
    const selectedMonthYear = selectedMonthYears.includes(today.getFullYear())
      ? today.getFullYear()
      : (selectedMonthYears.length > 0 ? Math.max(...selectedMonthYears) : today.getFullYear());
    const currentMonthKey = `${selectedMonthYear}-${String(selectedMonthNo).padStart(2, '0')}`;

    const summarizePeriod = (predicate) => {
      let refill = 0;
      let dac = 0;
      filteredTransactions.forEach((row) => {
        if (!predicate(String(row.salesDate || '').slice(0, 10))) return;
        const qty = Number(row.orderQuantity) || 1;
        refill += qty;
        if (row.dacVerified) dac += qty;
      });
      return {
        refill,
        dacCount: dac,
        dacPercent: refill > 0 ? ((dac / refill) * 100).toFixed(1) : '0.0',
      };
    };

    const currentMonth = summarizePeriod((dateKey) => dateKey.startsWith(currentMonthKey));
    const yesterdaySummary = summarizePeriod((dateKey) => dateKey === yesterdayKey);
    const todaySummary = summarizePeriod((dateKey) => dateKey === todayKey);

    return {
      totalRefillQuantity: fyHeadline.refill,
      totalOrders,
      totalTransactionsCount,
      totalSalesValue,
      uniqueConsumers: uniqueConsumers.size,
      deliveredOrders,
      cancelledOrders,
      averageDailySales: fyHeadline.averageDaily,
      dacPercent: fyHeadline.dacPercent,
      dacVerifiedCount: fyHeadline.dac,
      activeDaysCount: fyHeadline.activeDays,
      currentMonth,
      yesterday: yesterdaySummary,
      today: todaySummary,
      currentMonthLabel: new Date(selectedMonthYear, selectedMonthNo - 1, 1)
        .toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
      yesterdayLabel: yesterday.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      todayLabel: today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    };
  }, [filteredTransactions, filters.monthNo, fyHeadline]);

  // ==========================================
  // CHARTS DATA COMPUTATIONS
  // ==========================================
  const chartsData = useMemo(() => {
    const dailyMap = {};
    const areaMap = {};
    const staffMap = {};
    const packageMap = {};
    const natureMap = {};
    const sourceMap = {};

    filteredTransactions.forEach((r) => {
      const qty = r.orderQuantity || 1;
      const aKey = r.deliveryArea || 'General';
      areaMap[aKey] = (areaMap[aKey] || 0) + qty;

      const sKey = r.deliveryStaff || 'General Staff';
      staffMap[sKey] = (staffMap[sKey] || 0) + qty;

      const pKey = r.packageCode || r.productType || '14.2 KG Cylinder';
      packageMap[pKey] = (packageMap[pKey] || 0) + qty;

      const nKey = (r.natureOfConsumer || '1 - Domestic').slice(0, 22);
      natureMap[nKey] = (natureMap[nKey] || 0) + qty;

      const srcKey = r.orderSource || 'IVRS';
      sourceMap[srcKey] = (sourceMap[srcKey] || 0) + qty;
    });

    const now = new Date();
    const targetMonthNo = filters.monthNo !== 'ALL'
      ? parseInt(filters.monthNo, 10)
      : now.getMonth() + 1;
    const monthRows = filteredTransactions.filter((row) => Number(row.monthNo) === targetMonthNo);
    const availableYears = monthRows.map((row) => Number(row.year)).filter(Number.isFinite);
    const targetYear = availableYears.includes(now.getFullYear())
      ? now.getFullYear()
      : (availableYears.length > 0 ? Math.max(...availableYears) : now.getFullYear());

    monthRows.forEach((row) => {
      if (Number(row.year) !== targetYear) return;
      const dateKey = String(row.salesDate || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + (Number(row.orderQuantity) || 1);
    });

    const dailyChart = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ label: label.slice(8, 10), value }));

    const monthlyChart = fyMonthlyRefillChart;

    const fyChart = financialYearComparisonChart;

    const areaChart = Object.entries(areaMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));

    const staffChart = Object.entries(staffMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));

    const packageChart = Object.entries(packageMap).map(([label, value]) => ({ label, value }));
    const natureChart = Object.entries(natureMap).map(([label, value]) => ({ label, value }));
    const sourceChart = Object.entries(sourceMap).map(([label, value]) => ({ label, value }));

    const periodRefillChart = [
      { label: 'Financial Year', refill: dashboardKpis.totalRefillQuantity, dacCount: dashboardKpis.dacVerifiedCount, dac: dashboardKpis.dacPercent },
      { label: 'Current Month', refill: dashboardKpis.currentMonth.refill, dacCount: dashboardKpis.currentMonth.dacCount, dac: dashboardKpis.currentMonth.dacPercent },
      { label: 'Yesterday', refill: dashboardKpis.yesterday.refill, dacCount: dashboardKpis.yesterday.dacCount, dac: dashboardKpis.yesterday.dacPercent },
      { label: 'Today', refill: dashboardKpis.today.refill, dacCount: dashboardKpis.today.dacCount, dac: dashboardKpis.today.dacPercent },
    ];

    return {
      dailyChart,
      monthlyChart,
      fyChart,
      areaChart,
      staffChart,
      packageChart,
      natureChart,
      sourceChart,
      periodRefillChart,
      dailyChartLabel: `${MONTH_NAMES[targetMonthNo - 1]} ${targetYear}`,
    };
  }, [filteredTransactions, dashboardKpis, filters.monthNo, fyMonthlyRefillChart, financialYearComparisonChart]);

  // ==========================================
  // DAY-WISE TABLE & DAC REPORT
  // ==========================================
  const dayWiseReport = useMemo(() => {
    const dayMap = {};

    filteredTransactions.forEach((r) => {
      const d = r.salesDate || 'Unknown';
      if (!dayMap[d]) {
        dayMap[d] = {
          date: d,
          orderCount: 0,
          refillQuantity: 0,
          salesValue: 0,
          cdcms: 0,
          otpDac: 0,
          masterDac: 0,
        };
      }
      const q = Number(r.orderQuantity) || 1;
      dayMap[d].orderCount += q;
      dayMap[d].refillQuantity += q;
      dayMap[d].salesValue += (r.salesValue || 0);

      const dacTypeUpper = String(r.dacType || '').toUpperCase();
      if (dacTypeUpper.includes('CDCMS')) {
        dayMap[d].cdcms += q;
      } else if (dacTypeUpper.includes('MASTER')) {
        dayMap[d].masterDac += q;
      } else {
        dayMap[d].otpDac += q;
      }
    });

    return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions]);

  // Dynamic Product list for DAC Multi-Product filter
  const dacAvailableProducts = useMemo(() => {
    const pSet = new Set();
    // Ensure default domestic 14.2 KG products are always present
    DEFAULT_DAC_PRODUCTS.forEach((p) => pSet.add(p));
    transactions.forEach((r) => {
      const p = r.packageCode || r.productType;
      if (p) pSet.add(p);
    });
    return Array.from(pSet).sort();
  }, [transactions]);

  // Combined all available products for section filters
  const allAvailableProducts = useMemo(() => {
    const pSet = new Set(DEFAULT_DAC_PRODUCTS);
    (availableOptions.packageCodes || []).forEach((p) => pSet.add(p));
    transactions.forEach((r) => {
      const p = r.packageCode || r.productType;
      if (p) pSet.add(p);
    });
    return Array.from(pSet).sort();
  }, [availableOptions.packageCodes, transactions]);

  // Available months in uploaded transactions for product setting selector
  const availableUploadedMonths = useMemo(() => {
    const ymMap = new Map();
    transactions.forEach((r) => {
      if (r.year && r.monthNo) {
        const ym = `${r.year}-${String(r.monthNo).padStart(2, '0')}`;
        const label = `${r.monthName || MONTH_NAMES[parseInt(r.monthNo, 10) - 1] || `Month ${r.monthNo}`} ${r.year}`;
        if (!ymMap.has(ym)) {
          ymMap.set(ym, { ym, label, totalCylinders: 0, orderCount: 0 });
        }
        const item = ymMap.get(ym);
        item.totalCylinders += (Number(r.orderQuantity) || 1);
        item.orderCount += 1;
      }
    });
    const now = new Date();
    const currentActiveYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!ymMap.has(currentActiveYm)) {
      ymMap.set(currentActiveYm, {
        ym: currentActiveYm,
        label: `${MONTH_NAMES[now.getMonth()] || 'Current Month'} ${now.getFullYear()}`,
        totalCylinders: 0,
        orderCount: 0,
      });
    }
    return Array.from(ymMap.values()).sort((a, b) => b.ym.localeCompare(a.ym));
  }, [transactions]);

  // Dynamic Product list and Default Rates auto-fetched strictly from current month uploaded sales data
  const fetchedMonthProducts = useMemo(() => {
    const currentDate = new Date();
    const currentActiveMonthYm = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const targetYm = (productSettingYm === 'CURRENT' || !productSettingYm) ? currentActiveMonthYm : productSettingYm;

    // Determine target transactions strictly from the selected source month.
    let targetRows;
    if (targetYm === 'ALL') {
      targetRows = transactions;
    } else {
      targetRows = transactions.filter((r) => {
        const rowYm = `${r.year}-${String(r.monthNo).padStart(2, '0')}`;
        return rowYm === targetYm;
      });
    }

    const disabledList = Array.isArray(storeData.settings?.disabledProducts)
      ? storeData.settings.disabledProducts.map((p) => String(p).trim().toLowerCase())
      : [];

    const customRates = storeData.settings?.customProductRates || {};
    const storedProducts = Array.isArray(storeData.settings?.products) ? storeData.settings.products : [];

    const productMap = new Map();

    targetRows.forEach((r) => {
      const prodName = String(r.packageCode || r.productType || '').trim();
      if (!prodName) return;

      const qty = Number(r.orderQuantity) || 1;
      const isCommercial = prodName.toUpperCase().includes('19') || prodName.toUpperCase().includes('COMM');
      const salesVal = Number(r.salesValue) || 0;

      if (!productMap.has(prodName)) {
        productMap.set(prodName, {
          name: prodName,
          category: r.category || (isCommercial ? 'Commercial' : 'Domestic'),
          rates: [],
          totalQty: 0,
          totalRsp: 0,
          totalSales: 0,
          txCount: 0,
          productType: r.productType || '',
          packageCode: r.packageCode || '',
          isAutoFetched: true,
          isCustom: false,
        });
      }

      const item = productMap.get(prodName);
      item.totalQty += qty;
      item.totalSales += salesVal;
      item.txCount += 1;
    });

    // ONLY include custom products manually added by user (id starts with 'custom_'), NEVER inject static default dummy products
    const userCustomProducts = storedProducts.filter((sp) => String(sp.id || '').startsWith('custom_'));
    userCustomProducts.forEach((sp) => {
      const spName = String(sp.name || '').trim();
      if (spName && !productMap.has(spName)) {
        productMap.set(spName, {
          name: spName,
          category: sp.category || 'Domestic',
          rates: sp.defaultRate ? [sp.defaultRate] : [],
          totalQty: 0,
          totalSales: 0,
          txCount: 0,
          productType: sp.name,
          packageCode: sp.name,
          isAutoFetched: false,
          isCustom: true,
        });
      }
    });

    // If transactions were completely empty across the system, fallback to DEFAULT_PRODUCT_TYPES
    if (productMap.size === 0 && transactions.length === 0) {
      DEFAULT_PRODUCT_TYPES.forEach((dp) => {
        productMap.set(dp.name, {
          name: dp.name,
          category: dp.category,
          rates: [dp.defaultRate],
          totalQty: 0,
          totalSales: 0,
          txCount: 0,
          productType: dp.name,
          packageCode: dp.name,
          isAutoFetched: false,
          isCustom: false,
        });
      });
    }

    // Convert map to array with computed default rate
    const list = Array.from(productMap.values()).map((item) => {
      let defaultRate = 0;
      let isRateOverridden = false;

      if (customRates[item.name] !== undefined && !isNaN(Number(customRates[item.name]))) {
        defaultRate = Number(customRates[item.name]);
        isRateOverridden = true;
      } else if (item.totalQty > 0 && item.totalSales > 0) {
        // Default Rate = current/selected month Sales Value ÷ Refill Quantity.
        defaultRate = Math.round((item.totalSales / item.totalQty) * 100) / 100;
      }

      // Check disabled status
      const lowerName = item.name.toLowerCase();
      const isExplicitlyDisabled = disabledList.includes(lowerName);
      const storedItem = storedProducts.find((p) => String(p.name || '').toLowerCase() === lowerName);
      const isEnabled = !isExplicitlyDisabled && (storedItem ? storedItem.enabled !== false : true);

      return {
        id: `prod_${item.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: item.name,
        packageCode: item.packageCode,
        productType: item.productType,
        category: item.category,
        defaultRate,
        isRateOverridden,
        totalQty: item.totalQty,
        totalSales: item.totalSales,
        txCount: item.txCount,
        enabled: isEnabled,
        isAutoFetched: item.isAutoFetched,
        isCustom: item.isCustom,
      };
    });

    // Sort: Domestic first, then by totalQty descending
    return list.sort((a, b) => {
      if (b.totalQty !== a.totalQty) return b.totalQty - a.totalQty;
      return a.name.localeCompare(b.name);
    });
  }, [transactions, productSettingYm, storeData.settings]);

  // Dynamic Year list for DAC Past/Current Year selector
  const dacAvailableYears = useMemo(() => {
    const ySet = new Set([2024, 2025, 2026, 2027]);
    transactions.forEach((r) => {
      if (r.year) ySet.add(r.year);
    });
    return Array.from(ySet).sort((a, b) => b - a);
  }, [transactions]);

  // Day-wise DAC table with Past/Current Month & Multi-Product selection
  const dayWiseDacTableData = useMemo(() => {
    const targetYear = parseInt(dacReportYear, 10);
    const targetMonthNo = parseInt(dacReportMonth, 10);

    const daysInMonth = new Date(targetYear, targetMonthNo, 0).getDate();

    // Map each day of the month
    const dayMap = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = String(day).padStart(2, '0');
      const mStr = String(targetMonthNo).padStart(2, '0');
      const dateKey = `${targetYear}-${mStr}-${dStr}`;
      const dateDisplay = `${dStr},${mStr},${targetYear}`;
      dayMap[dateKey] = {
        date: dateDisplay,
        dateKey,
        cdcms: 0,
        otpDac: 0,
        masterDac: 0,
        total: 0,
        dacPercent: '0%',
        details: { cdcms: [] },
      };
    }

    const disabledList = (storeData.settings?.disabledProducts || []).map((p) => String(p).trim().toLowerCase());
    const storedDisabled = (storeData?.settings?.products || [])
      .filter((p) => p.enabled === false)
      .map((p) => String(p.name || '').trim().toLowerCase());
    const allDisabled = [...new Set([...disabledList, ...storedDisabled])];

    // Filter transactions matching selected year, month, and multi-products
    const matchingTx = transactions.filter((r) => {
      if (r.year && r.year !== targetYear) return false;
      if (r.monthNo && r.monthNo !== targetMonthNo) return false;
      const p1 = String(r.packageCode || '').trim().toLowerCase();
      const p2 = String(r.productType || '').trim().toLowerCase();
      if (allDisabled.length > 0 && (allDisabled.includes(p1) || allDisabled.includes(p2))) {
        return false;
      }
      if (dacSelectedProducts.length > 0) {
        const rawP1 = r.packageCode || '';
        const rawP2 = r.productType || '';
        if (!dacSelectedProducts.includes(rawP1) && !dacSelectedProducts.includes(rawP2)) return false;
      }
      return true;
    });

    if (matchingTx.length > 0) {
      matchingTx.forEach((r) => {
        const effectiveDate = salesDateBasis === 'orderDate'
          ? (r.orderDateKey || r.salesDate)
          : salesDateBasis === 'cashMemoDate'
            ? (r.cashMemoDate || r.salesDate)
            : (r.actualDeliveryDate || r.salesDate);

        const dKey = String(effectiveDate || '').split('T')[0];
        if (dayMap[dKey]) {
          const q = r.orderQuantity || 1;
          const dacTypeUpper = String(r.dacType || '').toUpperCase();
          if (dacTypeUpper.includes('CDCMS')) {
            dayMap[dKey].cdcms += q;
            dayMap[dKey].details.cdcms.push(r);
          } else if (dacTypeUpper.includes('MASTER')) {
            dayMap[dKey].masterDac += q;
          } else {
            dayMap[dKey].otpDac += q;
          }
        }
      });
    } else if (transactions.length === 0 && targetMonthNo === 9 && targetYear === 2026 && dacSelectedProducts.length === 0) {
      SAMPLE_SEPTEMBER_2026_DAYWISE_DAC.forEach((s) => {
        const parts = s.date.split(',');
        if (parts.length === 3) {
          const dKey = `${parts[2]}-${parts[1]}-${parts[0]}`;
          if (dayMap[dKey]) {
            dayMap[dKey].cdcms = s.cdcms;
            dayMap[dKey].otpDac = s.otpDac;
            dayMap[dKey].masterDac = s.masterDac;
          }
        }
      });
    }

    let sumCdcms = 0;
    let sumOtpDac = 0;
    let sumMasterDac = 0;
    let sumTotal = 0;

    const dailyRows = Object.values(dayMap).map((item) => {
      const total = item.cdcms + item.otpDac + item.masterDac;
      const dacPct = total > 0 ? Math.round(((item.otpDac + item.masterDac) / total) * 100) : 0;
      sumCdcms += item.cdcms;
      sumOtpDac += item.otpDac;
      sumMasterDac += item.masterDac;
      sumTotal += total;

      return {
        ...item,
        total,
        dacPercent: `${dacPct}%`,
        dacPercentNum: dacPct,
      };
    });

    const monthDacPct = sumTotal > 0 ? Math.round(((sumOtpDac + sumMasterDac) / sumTotal) * 100) : 0;
    const toLocalDateKey = (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    const todayDate = new Date();
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(todayDate.getDate() - 1);
    const emptyDay = (dateKey) => ({
      dateKey, cdcms: 0, otpDac: 0, masterDac: 0, total: 0, dacPercent: '0%',
    });
    const todayKey = toLocalDateKey(todayDate);
    const yesterdayKey = toLocalDateKey(yesterdayDate);
    const todaySummary = dailyRows.find((row) => row.dateKey === todayKey) || emptyDay(todayKey);
    const yesterdaySummary = dailyRows.find((row) => row.dateKey === yesterdayKey) || emptyDay(yesterdayKey);

    return {
      summary: {
        date: 'MONTH DAC',
        cdcms: sumCdcms,
        otpDac: sumOtpDac,
        masterDac: sumMasterDac,
        total: sumTotal,
        dacPercent: `${monthDacPct}%`,
      },
      rows: dailyRows,
      matchedCount: matchingTx.length,
      today: {
        ...todaySummary,
        label: todayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      },
      yesterday: {
        ...yesterdaySummary,
        label: yesterdayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      },
    };
  }, [transactions, dacReportYear, dacReportMonth, dacSelectedProducts, salesDateBasis, storeData?.settings]);

  // ==========================================
  // DAC ADVANCE REPORT DATA (5 Reports from User Screenshots)
  // ==========================================
  const dacAdvanceReportData = useMemo(() => {
    const targetYear = parseInt(advanceDacYear, 10);
    const targetMonthNo = parseInt(advanceDacMonth, 10);

    const disabledList = (storeData.settings?.disabledProducts || []).map((p) => String(p).trim().toLowerCase());
    const storedDisabled = (storeData?.settings?.products || [])
      .filter((p) => p.enabled === false)
      .map((p) => String(p.name || '').trim().toLowerCase());
    const allDisabled = [...new Set([...disabledList, ...storedDisabled])];

    const matchingTx = transactions.filter((r) => {
      if (r.year && r.year !== targetYear) return false;
      if (r.monthNo && r.monthNo !== targetMonthNo) return false;
      const p1 = String(r.packageCode || '').trim().toLowerCase();
      const p2 = String(r.productType || '').trim().toLowerCase();
      if (allDisabled.length > 0 && (allDisabled.includes(p1) || allDisabled.includes(p2))) {
        return false;
      }
      return true;
    });

    const isSample = matchingTx.length === 0;

    // Helper: format ISO date to DD,MM,YYYY
    const formatDacDate = (isoStr) => {
      if (!isoStr) return '';
      const parts = isoStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]},${parts[1]},${parts[0]}`;
      }
      return isoStr;
    };

    // 1. Package Wise Refill Sales Data
    let packageWiseRows = [];
    let packageWiseTotal = 0;
    if (isSample) {
      packageWiseRows = SAMPLE_DAC_ADVANCE_DATA.packageWise.map((p) => ({ ...p }));
      packageWiseTotal = packageWiseRows.reduce((acc, curr) => acc + curr.count, 0);
    } else {
      const pkgMap = {};
      SAMPLE_DAC_ADVANCE_DATA.packageWise.forEach((p) => {
        pkgMap[p.name] = 0;
      });
      matchingTx.forEach((r) => {
        const rawPkg = String(r.packageCode || r.productType || '14.2 KG NON-SUBSIDIZED CYLINDER').trim();
        const matchedKey = Object.keys(pkgMap).find((k) => k.toLowerCase() === rawPkg.toLowerCase())
          || (rawPkg.toUpperCase().includes('LD') && rawPkg.toUpperCase().includes('14.2') ? '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)' : null)
          || (rawPkg.toUpperCase().includes('14.2') ? '14.2 KG NON-SUBSIDIZED CYLINDER' : null)
          || (rawPkg.toUpperCase().includes('FLAME') ? '19KG FILLED HP GAS FLAME PLUS VOT' : null)
          || (rawPkg.toUpperCase().includes('19') ? '19 KG FILLED LPG CYLINDER' : null)
          || (rawPkg.toUpperCase().includes('FTL') || rawPkg.includes('149') ? '(149)5 KG FILLED LPG CYLINDER(FTL-RFL)' : null)
          || (rawPkg.toUpperCase().includes('5 KG') && rawPkg.toUpperCase().includes('LD') ? '5 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)' : null);

        const keyToUse = matchedKey || rawPkg;
        const q = r.orderQuantity || 1;
        pkgMap[keyToUse] = (pkgMap[keyToUse] || 0) + q;
        packageWiseTotal += q;
      });
      packageWiseRows = Object.entries(pkgMap).map(([name, count]) => ({ name, count }));
    }
    // Filter out products with 0 count (User Request)
    packageWiseRows = packageWiseRows.filter((p) => (p.count || 0) > 0);
    packageWiseTotal = packageWiseRows.reduce((acc, curr) => acc + (curr.count || 0), 0);

    // 2. Order Type Delivery
    let orderTypeRows = [];
    let orderTypeTotal = 0;
    if (isSample) {
      orderTypeRows = SAMPLE_DAC_ADVANCE_DATA.orderType.map((o) => ({ ...o }));
      orderTypeTotal = orderTypeRows.reduce((acc, curr) => acc + curr.count, 0);
    } else {
      const otMap = { 'Pending SV': 0, 'Refill': 0 };
      matchingTx.forEach((r) => {
        const ot = String(r.orderType || '').trim();
        const otUpper = ot.toUpperCase();
        const q = r.orderQuantity || 1;
        if (otUpper.includes('SV') || otUpper.includes('PENDING')) {
          otMap['Pending SV'] = (otMap['Pending SV'] || 0) + q;
        } else {
          otMap['Refill'] = (otMap['Refill'] || 0) + q;
        }
        orderTypeTotal += q;
      });
      orderTypeRows = Object.entries(otMap).map(([name, count]) => ({ name, count }));
    }
    orderTypeRows = orderTypeRows.filter((o) => (o.count || 0) > 0);
    orderTypeTotal = orderTypeRows.reduce((acc, curr) => acc + (curr.count || 0), 0);

    // 3. Consumer Type Delivery
    let consumerTypeRows = [];
    let consumerTypeTotal = 0;
    if (isSample) {
      consumerTypeRows = SAMPLE_DAC_ADVANCE_DATA.consumerType.map((c) => ({ ...c }));
      consumerTypeTotal = consumerTypeRows.reduce((acc, curr) => acc + curr.count, 0);
    } else {
      const ctMap = { 'DBC': 0, 'SBC': 0 };
      matchingTx.forEach((r) => {
        const ct = String(r.typeOfConsumer || r.natureOfConsumer || '').toUpperCase();
        const q = r.orderQuantity || 1;
        if (ct.includes('DBC')) {
          ctMap['DBC'] = (ctMap['DBC'] || 0) + q;
        } else {
          ctMap['SBC'] = (ctMap['SBC'] || 0) + q;
        }
      });
      consumerTypeRows = Object.entries(ctMap).map(([name, count]) => ({ name, count }));
    }
    consumerTypeRows = consumerTypeRows.filter((c) => (c.count || 0) > 0);
    consumerTypeTotal = consumerTypeRows.reduce((acc, curr) => acc + (curr.count || 0), 0);

    // 4. Order Source Delivery & Online Booking Breakdown
    let orderSourceRows = [];
    let orderSourceTotal = 0;
    let onlineBooking = 0;
    let manualBooking = 0;
    let onlineBookingPct = '0%';
    if (isSample) {
      orderSourceRows = SAMPLE_DAC_ADVANCE_DATA.orderSource.map((s) => ({ ...s }));
      orderSourceTotal = orderSourceRows.reduce((acc, curr) => acc + curr.count, 0);
      onlineBooking = 5693;
      manualBooking = 159;
      onlineBookingPct = '97%';
    } else {
      const srcMap = {
        'Chatbot': { count: 0, isOnline: true },
        'CSC': { count: 0, isOnline: true },
        'Distributor': { count: 0, isOnline: false },
        'E Comm App': { count: 0, isOnline: true },
        'HP Pay': { count: 0, isOnline: true },
        'IVRS': { count: 0, isOnline: true },
        'Portal': { count: 0, isOnline: true },
        'Vitran': { count: 0, isOnline: false },
        'Other': { count: 0, isOnline: false },
      };
      matchingTx.forEach((r) => {
        const src = String(r.orderSource || '').toUpperCase();
        const q = r.orderQuantity || 1;
        let matched = 'Other';
        if (src.includes('CHAT')) matched = 'Chatbot';
        else if (src.includes('CSC')) matched = 'CSC';
        else if (src.includes('DIST')) matched = 'Distributor';
        else if (src.includes('COMM') || (src.includes('APP') && !src.includes('HP'))) matched = 'E Comm App';
        else if (src.includes('HP PAY') || src.includes('HPPAY') || src.includes('HPAY')) matched = 'HP Pay';
        else if (src.includes('IVR')) matched = 'IVRS';
        else if (src.includes('PORTAL') || src.includes('WEB')) matched = 'Portal';
        else if (src.includes('VITRAN')) matched = 'Vitran';
        else {
          matched = 'Other';
        }

        srcMap[matched].count += q;
        orderSourceTotal += q;
        if (srcMap[matched].isOnline) {
          onlineBooking += q;
        } else {
          manualBooking += q;
        }
      });
      orderSourceRows = Object.entries(srcMap).map(([name, data]) => ({
        name,
        count: data.count,
        isOnline: data.isOnline,
      }));
      const pctNum = orderSourceTotal > 0 ? Math.round((onlineBooking / orderSourceTotal) * 100) : 0;
      onlineBookingPct = `${pctNum}%`;
    }
    // Filter out order sources with 0 count (User Request)
    orderSourceRows = orderSourceRows.filter((s) => (s.count || 0) > 0);
    orderSourceTotal = orderSourceRows.reduce((acc, curr) => acc + (curr.count || 0), 0);

    // 5. Deliveryman Performance Matrix (3 Columns)
    const isCountableDelivery = (r) => {
      if (advanceDacMode === 'all') return true;
      const dacUpper = String(r.dacType || '').toUpperCase();
      return r.dacVerified || (!dacUpper.includes('CDCMS') && dacUpper.length > 0);
    };

    let deliveryMatrix = [];
    let monthTotal = 0;
    let day1Total = 0;
    let day2Total = 0;

    if (isSample) {
      deliveryMatrix = SAMPLE_DAC_ADVANCE_DATA.deliveryStaff.map((s) => ({ ...s }));
      monthTotal = deliveryMatrix.reduce((acc, curr) => acc + curr.month, 0); // 5677
      day1Total = deliveryMatrix.reduce((acc, curr) => acc + curr.day1, 0); // 35
      day2Total = deliveryMatrix.reduce((acc, curr) => acc + curr.day2, 0); // 267
    } else {
      const staffSet = new Set(DEFAULT_ADVANCE_DELIVERY_STAFF);
      matchingTx.forEach((r) => {
        const st = String(r.deliveryStaff || '').trim();
        if (st && st !== 'General Staff') staffSet.add(st);
      });

      const staffStats = {};
      DEFAULT_ADVANCE_DELIVERY_STAFF.forEach((st) => {
        staffStats[st] = { name: st, month: 0, day1: 0, day2: 0, details: { month: [], day1: [], day2: [] } };
      });
      staffSet.forEach((st) => {
        if (!staffStats[st]) {
          staffStats[st] = { name: st, month: 0, day1: 0, day2: 0, details: { month: [], day1: [], day2: [] } };
        }
      });

      matchingTx.forEach((r) => {
        if (!isCountableDelivery(r)) return;
        const st = String(r.deliveryStaff || '').trim();
        const effectiveDate = salesDateBasis === 'orderDate'
          ? (r.orderDateKey || r.salesDate)
          : salesDateBasis === 'cashMemoDate'
            ? (r.cashMemoDate || r.salesDate)
            : (r.actualDeliveryDate || r.salesDate);
        const dateKey = String(effectiveDate || '').split(' ')[0].split('T')[0];

        const matchedStaff = Object.keys(staffStats).find(
          (k) => k.toLowerCase() === st.toLowerCase() || (st && k.toLowerCase().includes(st.toLowerCase()))
        ) || (st && st !== 'General Staff' ? st : 'DM Dharmendra');

        if (!staffStats[matchedStaff]) {
          staffStats[matchedStaff] = { name: matchedStaff, month: 0, day1: 0, day2: 0, details: { month: [], day1: [], day2: [] } };
        }

        const q = r.orderQuantity || 1;
        staffStats[matchedStaff].month += q;
        staffStats[matchedStaff].details.month.push(r);
        monthTotal += q;

        if (dateKey === advanceDacDay1) {
          staffStats[matchedStaff].day1 += q;
          staffStats[matchedStaff].details.day1.push(r);
          day1Total += q;
        }
        if (dateKey === advanceDacDay2) {
          staffStats[matchedStaff].day2 += q;
          staffStats[matchedStaff].details.day2.push(r);
          day2Total += q;
        }
      });

      deliveryMatrix = Object.values(staffStats);
    }

    // Filter out deliverymen with 0 deliveries in the entire month (User Request)
    deliveryMatrix = deliveryMatrix.filter((dm) => (dm.month || 0) > 0);
    monthTotal = deliveryMatrix.reduce((acc, curr) => acc + (curr.month || 0), 0);
    day1Total = deliveryMatrix.reduce((acc, curr) => acc + (curr.day1 || 0), 0);
    day2Total = deliveryMatrix.reduce((acc, curr) => acc + (curr.day2 || 0), 0);

    return {
      isSample,
      packageWise: { rows: packageWiseRows, total: packageWiseTotal },
      orderType: { rows: orderTypeRows, total: orderTypeTotal },
      consumerType: { rows: consumerTypeRows, total: consumerTypeTotal },
      orderSource: {
        rows: orderSourceRows,
        total: orderSourceTotal,
        onlineBooking,
        manualBooking,
        onlineBookingPct,
      },
      deliveryMatrix: {
        rows: deliveryMatrix,
        monthTotal,
        day1Total,
        day2Total,
        day1Label: formatDacDate(advanceDacDay1),
        day2Label: formatDacDate(advanceDacDay2),
      },
    };
  }, [transactions, advanceDacYear, advanceDacMonth, advanceDacDay1, advanceDacDay2, advanceDacMode, salesDateBasis, storeData?.settings]);

  // ==========================================
  // MONTH-WISE REPORT & COMPARISON
  // ==========================================
  const monthWiseReport = useMemo(() => {
    const mGroups = {};
    FY_MONTHS.forEach((fym) => {
      mGroups[fym.monthCode] = {
        monthCode: fym.monthCode,
        monthNo: fym.monthNo,
        monthName: fym.name,
        orderCount: 0,
        refillQuantity: 0,
        salesValue: 0,
        daysWithSales: new Set(),
      };
    });

    filteredTransactions.forEach((r) => {
      if (r.monthNo) {
        const code = String(r.monthNo).padStart(2, '0');
        if (mGroups[code]) {
          const q = Number(r.orderQuantity) || 1;
          mGroups[code].orderCount += q;
          mGroups[code].refillQuantity += q;
          mGroups[code].salesValue += (r.salesValue || 0);
          if (r.salesDate) mGroups[code].daysWithSales.add(r.salesDate);
        }
      }
    });

    return FY_MONTHS.map((fym) => {
      const m = mGroups[fym.monthCode];
      const activeDays = Math.max(m.daysWithSales.size, 1);
      const avgDaily = m.refillQuantity > 0 ? Math.round(m.refillQuantity / activeDays) : 0;
      return {
        ...m,
        avgDaily,
      };
    });
  }, [filteredTransactions]);

  const monthComparison = useMemo(() => {
    const dataA = monthWiseReport.find((m) => m.monthCode === compMonthA) || { refillQuantity: 0, orderCount: 0, salesValue: 0, monthName: 'Month A' };
    const dataB = monthWiseReport.find((m) => m.monthCode === compMonthB) || { refillQuantity: 0, orderCount: 0, salesValue: 0, monthName: 'Month B' };

    const qtyDiff = dataB.refillQuantity - dataA.refillQuantity;
    const qtyGrowth = dataA.refillQuantity > 0 ? ((qtyDiff / dataA.refillQuantity) * 100).toFixed(1) : '—';

    const revDiff = dataB.salesValue - dataA.salesValue;
    const revGrowth = dataA.salesValue > 0 ? ((revDiff / dataA.salesValue) * 100).toFixed(1) : '—';

    return {
      monthAName: dataA.monthName,
      monthBName: dataB.monthName,
      dataA,
      dataB,
      qtyDiff,
      qtyGrowth,
      revDiff,
      revGrowth,
    };
  }, [monthWiseReport, compMonthA, compMonthB]);

  // ==========================================
  // MONTHLY DAC % REPORT (Manthy DAC %)
  // ==========================================
  const monthlyDacReport = useMemo(() => {
    const fyMonthOrder = FY_MONTH_ORDER;
    const mGroups = {};
    fyMonthOrder.forEach((mNo) => {
      const code = String(mNo).padStart(2, '0');
      mGroups[code] = {
        monthCode: code,
        monthNo: mNo,
        monthName: MONTH_NAMES[mNo - 1],
        cdcms: 0,
        otpDac: 0,
        masterDac: 0,
        total: 0,
        details: { cdcms: [], masterDac: [] },
      };
    });

    filteredTransactions.forEach((r) => {
      if (r.monthNo) {
        const code = String(r.monthNo).padStart(2, '0');
        if (!mGroups[code]) {
          mGroups[code] = {
            monthCode: code,
            monthNo: r.monthNo,
            monthName: MONTH_NAMES[r.monthNo - 1] || `Month ${r.monthNo}`,
            cdcms: 0,
            otpDac: 0,
            masterDac: 0,
            total: 0,
            details: { cdcms: [], masterDac: [] },
          };
        }
        const q = Number(r.orderQuantity) || 1;
        const dacTypeUpper = String(r.dacType || '').toUpperCase();
        if (dacTypeUpper.includes('CDCMS')) {
          mGroups[code].cdcms += q;
          mGroups[code].details.cdcms.push(r);
        } else if (dacTypeUpper.includes('MASTER')) {
          mGroups[code].masterDac += q;
          mGroups[code].details.masterDac.push(r);
        } else {
          mGroups[code].otpDac += q;
        }
        mGroups[code].total += q;
      }
    });

    return fyMonthOrder.map((mNo) => {
      const code = String(mNo).padStart(2, '0');
      const item = mGroups[code];
      const dacPct = item.total > 0 ? Math.round(((item.otpDac + item.masterDac) / item.total) * 100) : 0;
      return {
        ...item,
        dacPercent: `${dacPct}%`,
        dacPercentNum: dacPct,
      };
    });
  }, [filteredTransactions]);

  // ==========================================
  // FY-WISE REPORT
  // ==========================================
  const fyWiseReport = useMemo(() => {
    const fyMap = {};

    filteredTransactions.forEach((r) => {
      const fy = r.fy || 'Unknown';
      if (!fyMap[fy]) {
        fyMap[fy] = {
          fy,
          orderCount: 0,
          refillQuantity: 0,
          salesValue: 0,
          months: new Set(),
        };
      }
      const q = Number(r.orderQuantity) || 1;
      fyMap[fy].orderCount += 1;
      fyMap[fy].refillQuantity += q;
      fyMap[fy].salesValue += Number(r.salesValue) || 0;
      if (r.monthNo) fyMap[fy].months.add(r.monthNo);
    });

    return Object.values(fyMap)
      .sort((a, b) => a.fy.localeCompare(b.fy))
      .map((item) => {
        const mCount = Math.max(item.months.size, 1);
        const avgMonthly = Math.round(item.refillQuantity / mCount);
        return {
          ...item,
          avgMonthly,
        };
      });
  }, [filteredTransactions]);

  // ==========================================
  // DIMENSIONAL BREAKDOWN REPORTS (Section 39.F - 39.R)
  // ==========================================
  const dimensionalReports = useMemo(() => {
    const areaMap = {};
    const staffMap = {};
    const pkgMap = {};
    const natureMap = {};
    const srcMap = {};
    const ekycMap = {};
    const cancellations = [];

    filteredTransactions.forEach((r) => {
      const qty = Number(r.orderQuantity) || 1;
      const val = Number(r.salesValue) || 0;

      // Area
      const area = r.deliveryArea || 'General Area';
      if (!areaMap[area]) areaMap[area] = { area, orders: 0, refillQuantity: 0, salesValue: 0 };
      areaMap[area].orders += qty;
      areaMap[area].refillQuantity += qty;
      areaMap[area].salesValue += val;

      // Staff
      const staff = r.deliveryStaff || 'General Staff';
      if (!staffMap[staff]) staffMap[staff] = { staff, orders: 0, refillQuantity: 0, salesValue: 0, dacCount: 0 };
      staffMap[staff].orders += qty;
      staffMap[staff].refillQuantity += qty;
      staffMap[staff].salesValue += val;
      if (r.dacVerified) staffMap[staff].dacCount += qty;

      // Package
      const pkg = r.packageCode || r.productType || '14.2 KG Domestic';
      if (!pkgMap[pkg]) pkgMap[pkg] = { packageCode: pkg, category: r.category || 'Domestic', orders: 0, refillQuantity: 0, salesValue: 0 };
      pkgMap[pkg].orders += qty;
      pkgMap[pkg].refillQuantity += qty;
      pkgMap[pkg].salesValue += val;

      // Nature & Consumer Type
      const nature = r.natureOfConsumer || '1 - Domestic';
      if (!natureMap[nature]) natureMap[nature] = { nature, sbcOrders: 0, dbcOrders: 0, orders: 0, refillQuantity: 0, salesValue: 0 };
      natureMap[nature].orders += qty;
      natureMap[nature].refillQuantity += qty;
      natureMap[nature].salesValue += val;
      if (r.typeOfConsumer === 'SBC') natureMap[nature].sbcOrders += qty;
      else if (r.typeOfConsumer === 'DBC') natureMap[nature].dbcOrders += qty;

      // Source & Mode
      const src = r.orderSource || 'IVRS';
      if (!srcMap[src]) srcMap[src] = { source: src, homeOrders: 0, instantOrders: 0, orders: 0, refillQuantity: 0, salesValue: 0, instantDetails: [] };
      srcMap[src].orders += qty;
      srcMap[src].refillQuantity += qty;
      srcMap[src].salesValue += val;
      const deliveryMode = String(r.deliveryMode || '').trim().toLowerCase();
      if (deliveryMode === 'home' || deliveryMode.includes('home delivery')) srcMap[src].homeOrders += qty;
      else if (deliveryMode.includes('instant') || deliveryMode.includes('counter')) {
        srcMap[src].instantOrders += qty;
        srcMap[src].instantDetails.push(r);
      }

      // eKYC & Mobile
      const ekyc = r.ekycStatus || 'Not Seeded / Pending';
      if (!ekycMap[ekyc]) ekycMap[ekyc] = { ekycStatus: ekyc, regMobile: 0, nonRegMobile: 0, orders: 0, refillQuantity: 0, details: [] };
      ekycMap[ekyc].orders += qty;
      ekycMap[ekyc].refillQuantity += qty;
      ekycMap[ekyc].details.push(r);
      if (String(r.isRegMobile || '').trim().toUpperCase() === 'Y') ekycMap[ekyc].regMobile += qty;
      else ekycMap[ekyc].nonRegMobile += qty;

      // Cancellations
      if (r.orderStatus === 'Cancelled' || r.cashMemoCancelDate || r.cancellationReason) {
        cancellations.push(r);
      }
    });

    const totalQty = Math.max(dashboardKpis.totalRefillQuantity, 1);

    const areas = Object.values(areaMap).map((a) => ({
      ...a,
      share: ((a.refillQuantity / totalQty) * 100).toFixed(1),
    })).sort((a, b) => b.refillQuantity - a.refillQuantity);

    const staffList = Object.values(staffMap).map((s) => ({
      ...s,
      dacPct: s.orders > 0 ? ((s.dacCount / s.orders) * 100).toFixed(1) : '0.0',
      dacPct: s.refillQuantity > 0 ? ((s.dacCount / s.refillQuantity) * 100).toFixed(1) : '0.0',
    })).sort((a, b) => b.refillQuantity - a.refillQuantity);

    const packages = Object.values(pkgMap).map((p) => ({
      ...p,
      share: ((p.refillQuantity / totalQty) * 100).toFixed(1),
    })).sort((a, b) => b.refillQuantity - a.refillQuantity);

    const natures = Object.values(natureMap).sort((a, b) => b.refillQuantity - a.refillQuantity);
    const sources = Object.values(srcMap).sort((a, b) => b.refillQuantity - a.refillQuantity);
    const ekycs = Object.values(ekycMap).sort((a, b) => b.orders - a.orders);

    return {
      areas,
      staffList,
      packages,
      natures,
      sources,
      ekycs,
      cancellations,
    };
  }, [filteredTransactions, dashboardKpis.totalRefillQuantity]);

  const areaTotalPages = Math.max(1, Math.ceil(dimensionalReports.areas.length / areasPerPage));
  const safeAreaPage = Math.min(areaPage, areaTotalPages);
  const paginatedAreas = dimensionalReports.areas.slice(
    (safeAreaPage - 1) * areasPerPage,
    safeAreaPage * areasPerPage,
  );

  const advancedReports = useMemo(() => {
    const rows = filteredTransactions;
    const qtyOf = (row) => Number(row.orderQuantity) || 1;
    const consumers = new Map();
    const payments = new Map();
    const staffWorkload = new Map();
    const delays = { sameDay: 0, nextDay: 0, delayed: 0 };
    let latestDeliveryMs = 0;
    let delayDaysTotal = 0;
    let delayRows = 0;
    let onlineOrders = 0;

    rows.forEach((row) => {
      const consumerNo = String(row.consumerNo || 'Unknown');
      const deliveryDate = new Date(row.actualDeliveryDate || row.salesDate || '');
      const deliveryMs = Number.isNaN(deliveryDate.getTime()) ? 0 : deliveryDate.getTime();
      latestDeliveryMs = Math.max(latestDeliveryMs, deliveryMs);
      const current = consumers.get(consumerNo) || { name: row.consumerName || 'Unknown', consumerNo, qty: 0, sales: 0, lastMs: 0 };
      current.qty += qtyOf(row); current.sales += Number(row.salesValue) || 0; current.lastMs = Math.max(current.lastMs, deliveryMs);
      consumers.set(consumerNo, current);

      const payment = row.paymentMode || 'Not Specified';
      payments.set(payment, (payments.get(payment) || 0) + qtyOf(row));
      if (/online|pay|upi|card/i.test(payment)) onlineOrders += qtyOf(row);

      const staffName = String(row.deliveryStaff || 'General Staff').trim() || 'General Staff';
      const staff = staffWorkload.get(staffName) || { name: staffName, qty: 0, areas: new Set(), days: new Set() };
      staff.qty += qtyOf(row);
      if (row.deliveryArea) staff.areas.add(String(row.deliveryArea).trim());
      const workDate = String(row.actualDeliveryDate || row.salesDate || '').split('T')[0].split(' ')[0];
      if (workDate) staff.days.add(workDate);
      staffWorkload.set(staffName, staff);

      const orderDate = new Date(row.orderDateKey || row.orderDate || '');
      if (deliveryMs && !Number.isNaN(orderDate.getTime())) {
        const days = Math.max(0, Math.round((deliveryMs - orderDate.getTime()) / 86400000));
        delayDaysTotal += days; delayRows += 1;
        if (days === 0) delays.sameDay += qtyOf(row); else if (days === 1) delays.nextDay += qtyOf(row); else delays.delayed += qtyOf(row);
      }
    });

    const consumerList = [...consumers.values()].sort((a, b) => b.qty - a.qty);
    const dormant = consumerList.filter((item) => latestDeliveryMs && item.lastMs && (latestDeliveryMs - item.lastMs) / 86400000 >= 60);
    const missingMobile = rows.filter((row) => !String(row.mobileNo || '').trim()).length;
    const missingArea = rows.filter((row) => !String(row.deliveryArea || '').trim()).length;
    const totalQty = rows.reduce((sum, row) => sum + qtyOf(row), 0);
    const totalSales = rows.reduce((sum, row) => sum + (Number(row.salesValue) || 0), 0);
    const formatItems = (items) => items.map(([label, value]) => ({ label, value }));
    const averageStaffQty = staffWorkload.size ? totalQty / staffWorkload.size : 0;
    const workloadRows = [...staffWorkload.values()].map((staff) => {
      const share = totalQty ? (staff.qty / totalQty) * 100 : 0;
      const averageDaily = staff.qty / Math.max(staff.days.size, 1);
      const status = staff.qty > averageStaffQty * 1.2
        ? 'Overloaded'
        : staff.qty < averageStaffQty * 0.6 ? 'Underutilized' : 'Balanced';
      return { ...staff, share, averageDaily, status };
    }).sort((a, b) => b.qty - a.qty);
    const overloadedCount = workloadRows.filter((staff) => staff.status === 'Overloaded').length;
    const underutilizedCount = workloadRows.filter((staff) => staff.status === 'Underutilized').length;
    const pmuyConsumers = new Map();
    const pmuyAreas = new Map();
    const bookingDates = new Map();
    const bookingWeekdays = new Map();
    const bookingPeriods = new Map();
    rows.forEach((row) => {
      const qty = qtyOf(row);
      const nature = String(row.natureOfConsumer || '').toUpperCase();
      if (nature.includes('UJJWALA') || nature.includes('PMUY')) {
        const consumerNo = String(row.consumerNo || 'Unknown');
        const deliveryDate = new Date(row.actualDeliveryDate || row.salesDate || '');
        const deliveryMs = Number.isNaN(deliveryDate.getTime()) ? 0 : deliveryDate.getTime();
        const consumer = pmuyConsumers.get(consumerNo) || { consumerNo, name: row.consumerName || 'Unknown', area: row.deliveryArea || 'General Area', qty: 0, deliveries: 0, lastMs: 0 };
        consumer.qty += qty; consumer.deliveries += 1; consumer.lastMs = Math.max(consumer.lastMs, deliveryMs);
        pmuyConsumers.set(consumerNo, consumer);
        const area = row.deliveryArea || 'General Area';
        pmuyAreas.set(area, (pmuyAreas.get(area) || 0) + qty);
      }

      const orderDateValue = row.orderDateKey || row.orderDate || row.salesDate;
      const orderDate = new Date(orderDateValue || '');
      if (!Number.isNaN(orderDate.getTime())) {
        const dateKey = String(orderDateValue).split('T')[0].split(' ')[0];
        const weekday = orderDate.toLocaleDateString('en-IN', { weekday: 'long' });
        bookingDates.set(dateKey, (bookingDates.get(dateKey) || 0) + qty);
        bookingWeekdays.set(weekday, (bookingWeekdays.get(weekday) || 0) + qty);
      }
      const hour = Number.parseInt(String(row.orderTime || '').split(':')[0], 10);
      if (!Number.isNaN(hour)) {
        const period = hour < 6 ? 'Night (12 AM–6 AM)' : hour < 12 ? 'Morning (6 AM–12 PM)' : hour < 17 ? 'Afternoon (12 PM–5 PM)' : hour < 21 ? 'Evening (5 PM–9 PM)' : 'Night (9 PM–12 AM)';
        bookingPeriods.set(period, (bookingPeriods.get(period) || 0) + qty);
      }
    });
    const pmuyList = [...pmuyConsumers.values()].sort((a, b) => b.qty - a.qty);
    const dormantPmuy = pmuyList.filter((consumer) => latestDeliveryMs && consumer.lastMs && (latestDeliveryMs - consumer.lastMs) / 86400000 >= 60);
    const pmuyItems = [
      ...[...pmuyAreas.entries()].sort((a, b) => b[1] - a[1]).map(([area, qty]) => ({ label: `Area · ${area}`, value: `${qty} Cyl` })),
      ...pmuyList.map((consumer) => ({ label: `${consumer.consumerNo} · ${consumer.name} · ${consumer.area}`, value: `${consumer.qty} Cyl · ${consumer.deliveries} Refills${dormantPmuy.includes(consumer) ? ' · Dormant' : ''}` })),
    ];
    const peakBookingItems = [
      ...[...bookingDates.entries()].sort((a, b) => b[1] - a[1]).map(([date, qty]) => ({ label: `Booking Date · ${date}`, value: `${qty} Orders` })),
      ...[...bookingWeekdays.entries()].sort((a, b) => b[1] - a[1]).map(([day, qty]) => ({ label: `Weekday · ${day}`, value: `${qty} Orders` })),
      ...[...bookingPeriods.entries()].sort((a, b) => b[1] - a[1]).map(([period, qty]) => ({ label: `Time Period · ${period}`, value: `${qty} Orders` })),
    ];

    return [
      { icon: '🔁', title: 'Repeat Booking / Refill Frequency', metric: `${consumers.size} Consumers`, note: `${consumerList.filter((c) => c.qty > 1).length} repeat consumers`, items: consumerList.map((c) => ({ label: `${c.consumerNo} · ${c.name}`, value: `${c.qty} Cyl` })) },
      { icon: '💤', title: 'Dormant Consumer Report', metric: `${dormant.length} Dormant`, note: '60+ days without delivery', items: dormant.map((c) => ({ label: `${c.consumerNo} · ${c.name}`, value: `${Math.floor((latestDeliveryMs - c.lastMs) / 86400000)} days` })) },
      { icon: '💳', title: 'Payment Collection Report', metric: `₹${totalSales.toLocaleString('en-IN')}`, note: `${payments.size} payment modes`, items: formatItems([...payments.entries()].sort((a, b) => b[1] - a[1])).map((x) => ({ ...x, value: `${x.value} Cyl` })) },
      { icon: '⏱️', title: 'Delivery Delay / Turnaround', metric: `${delayRows ? (delayDaysTotal / delayRows).toFixed(1) : '0.0'} Days Avg`, note: `${delays.delayed} delayed deliveries`, items: [{ label: 'Same Day', value: delays.sameDay }, { label: 'Next Day', value: delays.nextDay }, { label: '2+ Days', value: delays.delayed }] },
      { icon: '👤', title: 'Consumer 360° Report', metric: `${consumers.size} Profiles`, note: 'Consumers by refill quantity', items: consumerList.map((c) => ({ label: `${c.consumerNo} · ${c.name}`, value: `₹${c.sales.toLocaleString('en-IN')}` })) },
      { icon: '🧹', title: 'Exception & Data Quality', metric: `${missingMobile + missingArea} Exceptions`, note: 'Records requiring attention', items: [{ label: 'Missing Mobile', value: missingMobile }, { label: 'Missing Delivery Area', value: missingArea }] },
      { icon: '🛵', title: 'Deliveryman Productivity', metric: `${dimensionalReports.staffList.length} Staff`, note: 'Ranked by delivered cylinders', items: dimensionalReports.staffList.map((s) => ({ label: s.staff, value: `${s.refillQuantity} Cyl` })) },
      { icon: '⚖️', title: 'Deliveryman Workload Balance', metric: `${overloadedCount} Overloaded`, note: `${underutilizedCount} underutilized · ${workloadRows.length} total staff`, items: workloadRows.map((staff) => ({ label: `${staff.name} · ${staff.status}`, value: `${staff.qty} Cyl · ${staff.share.toFixed(1)}% · ${staff.areas.size} Areas · ${staff.averageDaily.toFixed(1)}/Day` })) },
      { icon: '🪷', title: 'Ujjwala / PMUY Consumer Report', metric: `${pmuyList.length} PMUY Consumers`, note: `${pmuyList.reduce((sum, consumer) => sum + consumer.qty, 0)} deliveries · ${dormantPmuy.length} dormant`, items: pmuyItems },
      { icon: '⏰', title: 'Peak Booking Hour / Day Report', metric: `${bookingDates.size} Booking Days`, note: 'Highest dates, weekdays and operational periods', items: peakBookingItems },
      { icon: '📍', title: 'Area Demand & Growth', metric: `${dimensionalReports.areas.length} Areas`, note: 'Areas ranked by demand', items: dimensionalReports.areas.map((a) => ({ label: a.area, value: `${a.refillQuantity} Cyl` })) },
      { icon: '🔮', title: 'Product Demand Forecast', metric: `${dimensionalReports.packages.length} Products`, note: 'Current demand baseline', items: dimensionalReports.packages.map((p) => ({ label: p.packageCode, value: `${p.refillQuantity} Cyl` })) },
      { icon: '❌', title: 'Cancellation & Failed Delivery', metric: `${dimensionalReports.cancellations.length} Cancelled`, note: 'Cancelled or failed records', items: dimensionalReports.cancellations.map((c) => ({ label: c.consumerName || c.consumerNo || 'Unknown', value: c.cancellationReason || c.orderStatus || 'Cancelled' })) },
      { icon: '📲', title: 'Online Adoption Report', metric: `${totalQty ? Math.round((onlineOrders / totalQty) * 100) : 0}% Online`, note: `${onlineOrders} online-paid cylinders`, items: formatItems([...payments.entries()].sort((a, b) => b[1] - a[1])).map((x) => ({ ...x, value: `${x.value}` })) },
      { icon: '📋', title: 'Management Daily MIS', metric: `${totalQty.toLocaleString()} Cylinders`, note: `₹${totalSales.toLocaleString('en-IN')} total sales`, items: [{ label: 'Transactions', value: rows.length }, { label: 'Consumers', value: consumers.size }, { label: 'DAC Verified', value: rows.filter((r) => r.dacVerified).length }] },
    ];
  }, [filteredTransactions, dimensionalReports]);

  const salesTrendData = useMemo(() => {
    const dates = new Map();
    filteredTransactions.forEach((row) => {
      const qty = Number(row.orderQuantity) || 1;
      const deliveryKey = String(row.actualDeliveryDate || row.salesDate || '').split('T')[0].split(' ')[0];
      const bookingKey = String(row.orderDateKey || row.orderDate || '').split('T')[0].split(' ')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryKey)) return;
      if (filters.monthNo !== 'ALL' && deliveryKey.slice(5, 7) !== String(filters.monthNo).padStart(2, '0')) return;
      const item = dates.get(deliveryKey) || { date: deliveryKey, deliveries: 0, sameDay: 0, oneDay: 0, twoDays: 0, threeToSix: 0, sevenPlus: 0, fifteenPlus: 0, twentyOnePlus: 0, unknown: 0, details: { all: [], sameDay: [], oneDay: [], twoDays: [], threeToSix: [], sevenPlus: [], fifteenPlus: [], twentyOnePlus: [], unknown: [] } };
      item.deliveries += qty;
      item.details.all.push(row);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingKey)) { item.unknown += qty; item.details.unknown.push(row); }
      else {
        const age = Math.floor((new Date(`${deliveryKey}T00:00:00`).getTime() - new Date(`${bookingKey}T00:00:00`).getTime()) / 86400000);
        if (age <= 0) { item.sameDay += qty; item.details.sameDay.push(row); }
        else if (age === 1) { item.oneDay += qty; item.details.oneDay.push(row); }
        else if (age === 2) { item.twoDays += qty; item.details.twoDays.push(row); }
        else if (age <= 6) { item.threeToSix += qty; item.details.threeToSix.push(row); }
        else if (age <= 14) { item.sevenPlus += qty; item.details.sevenPlus.push(row); }
        else if (age <= 20) { item.fifteenPlus += qty; item.details.fifteenPlus.push(row); }
        else { item.twentyOnePlus += qty; item.details.twentyOnePlus.push(row); }
      }
      dates.set(deliveryKey, item);
    });
    const rows = [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
    return {
      rows,
      totalDeliveries: rows.reduce((sum, row) => sum + row.deliveries, 0),
      sameDay: rows.reduce((sum, row) => sum + row.sameDay, 0),
      oneToTwoDays: rows.reduce((sum, row) => sum + row.oneDay + row.twoDays, 0),
      sevenPlus: rows.reduce((sum, row) => sum + row.sevenPlus + row.fifteenPlus + row.twentyOnePlus, 0),
      maxValue: Math.max(1, ...rows.map((row) => row.deliveries)),
    };
  }, [filteredTransactions, filters.monthNo]);

  // ==========================================
  // DETAILED SALES DATA (SEARCH & PAGINATION)
  // ==========================================
  const detailedSearchIndex = useMemo(() => filteredTransactions.map((row) => ({
    row,
    searchText: buildDetailSearchText(row),
  })), [filteredTransactions]);

  const detailedFiltered = useMemo(() => {
    const query = normalizeDetailSearch(deferredDetailSearch);
    if (!query) return filteredTransactions;

    const tokens = query.split(/\s+/).filter(Boolean);
    return detailedSearchIndex
      .filter(({ searchText }) => tokens.every((token) => searchText.includes(token)))
      .map(({ row }) => row);
  }, [filteredTransactions, detailedSearchIndex, deferredDetailSearch]);

  const totalDetailPages = detailRowsPerPage > 0
    ? Math.ceil(detailedFiltered.length / detailRowsPerPage) || 1
    : 1;

  const paginatedDetailRows = useMemo(() => {
    if (detailRowsPerPage === 0) return detailedFiltered;
    const start = (detailPage - 1) * detailRowsPerPage;
    return detailedFiltered.slice(start, start + detailRowsPerPage);
  }, [detailedFiltered, detailPage, detailRowsPerPage]);

  // ==========================================
  // IMPORT & ROLLBACK HANDLERS
  // ==========================================
  const handleConfirmImport = async (batchRecord, validRows) => {
    if (!hasCompletedInitialSync || storeData?.cachePartial) {
      showNotification('Full sales data is not synchronized yet. Please run Cloud Sync before uploading.', 'error');
      return false;
    }
    try {
      setCloudOperation({ label: `Uploading ${batchRecord.fileName}`, percent: 0 });
      const nextStore = await importSalesBatch(
        loggedInUser,
        storeData,
        batchRecord,
        validRows,
        progressOptions(`Uploading ${batchRecord.fileName}`),
      );
      setStoreData(nextStore);
      showNotification(`Successfully imported ${validRows.length} sales records!`);
      return true;
    } catch (err) {
      showNotification(err.message || 'Import failed.', 'error');
      return false;
    } finally {
      setCloudOperation(null);
    }
  };

  const handleRollbackBatch = async (batchId) => {
    if (!window.confirm(`Are you sure you want to delete and rollback batch (${batchId})? All its transactions will be permanently removed.`)) {
      return;
    }
    try {
      const nextStore = await rollbackSalesBatch(loggedInUser, storeData, batchId);
      setStoreData(nextStore);
      showNotification('Batch rolled back and transactions removed.');
    } catch (err) {
      showNotification(err.message || 'Rollback failed.', 'error');
    }
  };

  // ==========================================
  // UNIVERSAL TABLE EXPORT HELPERS (Section 54)
  // ==========================================
  const exportTableToExcel = (headers, rows, filename) => {
    const dataObjects = rows.map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataObjects);
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const exportTableToCsv = (headers, rows, filename) => {
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDacAdvanceToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Operational Reports (Package Wise, Order Type, Consumer Type, Order Source)
    const opData = [
      ['Package Wise Refill Sales Data', 'Refill Sales'],
      ...dacAdvanceReportData.packageWise.rows.map((r) => [r.name, r.count]),
      ['Total', dacAdvanceReportData.packageWise.total],
      ['', ''],
      ['Order Type Delivery', 'Refill Sales'],
      ...dacAdvanceReportData.orderType.rows.map((r) => [r.name, r.count]),
      ['Total', dacAdvanceReportData.orderType.total],
      ['', ''],
      ['Consumer Type Delivery', 'Refill Sales'],
      ...dacAdvanceReportData.consumerType.rows.map((r) => [r.name, r.count]),
      ['Total', dacAdvanceReportData.consumerType.total],
      ['', ''],
      ['Order Source delivery', 'Refill Sales'],
      ...dacAdvanceReportData.orderSource.rows.map((r) => [r.name, r.count]),
      ['Total', dacAdvanceReportData.orderSource.total],
      ['Online Booking', dacAdvanceReportData.orderSource.onlineBooking],
      ['Manual Booking', dacAdvanceReportData.orderSource.manualBooking],
      ['Online Booking %', dacAdvanceReportData.orderSource.onlineBookingPct],
    ];
    const wsOp = XLSX.utils.aoa_to_sheet(opData);
    XLSX.utils.book_append_sheet(wb, wsOp, 'Operational_Breakdown');

    // Sheet 2: Deliveryman Matrix
    const matrixData = [
      ['Deliveryman', 'Month Delivery', `Day (${dacAdvanceReportData.deliveryMatrix.day1Label})`, `Date-wise (${dacAdvanceReportData.deliveryMatrix.day2Label})`],
      ...dacAdvanceReportData.deliveryMatrix.rows.map((r) => [r.name, r.month, r.day1, r.day2]),
      ['Total', dacAdvanceReportData.deliveryMatrix.monthTotal, dacAdvanceReportData.deliveryMatrix.day1Total, dacAdvanceReportData.deliveryMatrix.day2Total],
    ];
    const wsMatrix = XLSX.utils.aoa_to_sheet(matrixData);
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Deliveryman_Matrix');

    const fileName = `DAC_Advance_Report_${MONTH_NAMES[parseInt(advanceDacMonth, 10) - 1]}_${advanceDacYear}`;
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const exportDacAdvanceToCsv = () => {
    const csvRows = [
      ['--- OPERATIONAL BREAKDOWN ---'],
      ['Package Wise Refill Sales Data', 'Refill Sales'],
      ...dacAdvanceReportData.packageWise.rows.map((r) => [r.name, r.count]),
      ['Total', dacAdvanceReportData.packageWise.total],
      [],
      ['Order Type Delivery', 'Refill Sales'],
      ...dacAdvanceReportData.orderType.rows.map((r) => [r.name, r.count]),
      ['Total', dacAdvanceReportData.orderType.total],
      [],
      ['Consumer Type Delivery', 'Refill Sales'],
      ...dacAdvanceReportData.consumerType.rows.map((r) => [r.name, r.count]),
      ['Total', dacAdvanceReportData.consumerType.total],
      [],
      ['Order Source delivery', 'Refill Sales'],
      ...dacAdvanceReportData.orderSource.rows.map((r) => [r.name, r.count]),
      ['Total', dacAdvanceReportData.orderSource.total],
      ['Online Booking', dacAdvanceReportData.orderSource.onlineBooking],
      ['Manual Booking', dacAdvanceReportData.orderSource.manualBooking],
      ['Online Booking %', dacAdvanceReportData.orderSource.onlineBookingPct],
      [],
      ['--- DELIVERYMAN PERFORMANCE MATRIX ---'],
      ['Deliveryman', 'Month Delivery', `Day (${dacAdvanceReportData.deliveryMatrix.day1Label})`, `Date-wise (${dacAdvanceReportData.deliveryMatrix.day2Label})`],
      ...dacAdvanceReportData.deliveryMatrix.rows.map((r) => [r.name, r.month, r.day1, r.day2]),
      ['Total', dacAdvanceReportData.deliveryMatrix.monthTotal, dacAdvanceReportData.deliveryMatrix.day1Total, dacAdvanceReportData.deliveryMatrix.day2Total],
    ];
    const csvContent = csvRows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DAC_Advance_Report_${MONTH_NAMES[parseInt(advanceDacMonth, 10) - 1]}_${advanceDacYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDetailedToExcel = () => {
    const exportRows = detailedFiltered.map((r, idx) => ({
      'SL No': idx + 1,
      'Order No': r.orderNo,
      'Order Date': r.orderDate,
      'Order Status': r.orderStatus,
      'Order Source': r.orderSource,
      'Order Type': r.orderType,
      'Consumer No': r.consumerNo,
      'Consumer Name': r.consumerName,
      'Nature of Consumer': r.natureOfConsumer,
      'Package Code': r.packageCode,
      'Type of Consumer': r.typeOfConsumer,
      'CashMemo No': r.cashMemoNo,
      'CashMemo Date': r.cashMemoDate,
      'Cash Memo Cancel Date': r.cashMemoCancelDate || '',
      'CashMemo Status': r.cashMemoStatus,
      'Cancellation Reason': r.cancellationReason || '',
      'Delivery Mode': r.deliveryMode,
      'Actual Delivery Date': r.actualDeliveryDate,
      'Order Quantity': r.orderQuantity,
      'Subsidy Qty': r.subsidyQty,
      'Delivery Man': r.deliveryStaff,
      'Online Refill Payment Status': r.onlineRefillPaymentStatus || '',
      'IVRS BookingNumber': r.ivrsBookingNumber,
      'Mobile No.': r.mobileNo,
      'Is Reg Mobile': r.isRegMobile,
      'DAC TYPE': r.dacType,
      'ConsumerAddress': r.consumerAddress,
      'RSP': r.rsp,
      'Delivery Area': r.deliveryArea,
      'Is Refill Port': r.isRefillPort,
      'Ekyc Status': r.ekycStatus,
      'Sales Date': r.salesDate,
      'Financial Year': r.fy,
      'Sales Value': r.salesValue,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales_Records');
    XLSX.writeFile(workbook, `LPG_Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const agencyName = loggedInUser?.dealerName || loggedInUser?.agencyName || 'LPG Agency';

  return (
    <main className={`sales-report-page${isFullscreen ? ' sales-report-page--fullscreen' : ''}`}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: '8px',
          background: notification.tone === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          fontWeight: '700',
          boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
        }}>
          {notification.text}
        </div>
      )}

      {cloudOperation && (
        <div className="sales-cloud-progress" role="status" aria-live="polite">
          <div className="sales-cloud-progress__label">
            <strong>{cloudOperation.label}</strong>
            <span>{cloudOperation.percent}%</span>
          </div>
          <div className="sales-cloud-progress__track">
            <div className="sales-cloud-progress__fill" style={{ width: `${cloudOperation.percent}%` }} />
          </div>
        </div>
      )}

      {/* Hero Header */}
      <header className="sales-report-hero">
        <div>
          <p>Sales Analytics &amp; Register</p>
          <h1>Sales Report Module</h1>
          <span>{agencyName} — Multi-dimensional Refill Sales, Analytics &amp; Import Management</span>
        </div>
        <div className="sales-report-hero-actions">
          {/* Sales Date Basis Switch (Section 36) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>Date Basis:</span>
            <select
              value={salesDateBasis}
              onChange={(e) => handleSalesDateBasisChange(e.target.value)}
              style={{ background: '#ffffff', color: '#0f3756', border: 0, borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: '700' }}
            >
              <option value="actualDeliveryDate">Actual Delivery Date</option>
              <option value="cashMemoDate">CashMemo Date</option>
              <option value="orderDate">Order Date</option>
            </select>
          </div>
          {/* Top Quick Upload Current Month Action */}
          <button
            type="button"
            className="sales-report-btn sales-report-btn--quick-upload"
            onClick={() => openImportModal('monthWise', currentYear, currentMonthCode)}
            title={`Upload Current Month (${currentMonthName} ${currentYear}) Sales Data`}
          >
            ⚡ Upload Current Month ({currentMonthName.slice(0, 3)} {currentYear})
          </button>
          {/* Cloud Sync Action */}
          <button
            type="button"
            className="sales-report-btn sales-report-btn--cloud-sync"
            onClick={handleManualCloudSync}
            disabled={isSyncing}
            title="Synchronize all Sales Report Data with Firebase Cloud across devices"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isSyncing ? '#475569' : 'rgba(255,255,255,0.18)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontWeight: '700',
              fontSize: '12px',
              cursor: isSyncing ? 'wait' : 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {isSyncing ? `🔄 Syncing... ${syncProgress}%` : '☁️ Cloud Sync'}
            {isSyncing && (
              <span className="cloud-sync-button-progress" style={{ width: `${syncProgress}%` }} />
            )}
          </button>
          {/* Full Screen Viewport Toggle */}
          <button
            type="button"
            className="sales-report-btn sales-report-btn--fullscreen"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Expand Full Screen Viewport'}
          >
            {isFullscreen ? '🗗 Exit Full Screen' : '⛶ Full Screen'}
          </button>
          <button type="button" className="sales-report-btn sales-report-btn--close" onClick={onClose}>
            ← Back to Home
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="sales-report-workspace" style={{ marginTop: '20px' }}>
        {/* Left Sidebar Menu */}
        <aside className="sales-report-sidebar" aria-label="Sales Report Navigation">
          <div className="sales-report-sidebar__title">
            <span>Sales Centre</span>
            <strong>Report Sections</strong>
          </div>
          <nav className="sales-report-tabs">
            <div className="sales-sidebar-group-title">MAIN REPORTS</div>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <span>📊</span>Sales Dashboard
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'salesTrend' ? 'active' : ''}`}
              onClick={() => {
                setFilters((prev) => ({
                  ...prev,
                  monthNo: String(new Date().getMonth() + 1).padStart(2, '0'),
                  packageCode: 'ALL',
                  selectedProducts: [...DEFAULT_DAC_PRODUCTS],
                }));
                setActiveTab('salesTrend');
              }}
            >
              <span>📈</span>Sales Trend
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'consumerSearch' ? 'active' : ''}`}
              onClick={() => setActiveTab('consumerSearch')}
            >
              <span>🔎</span>Search Consumer
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'currentMonthDac' ? 'active' : ''}`}
              onClick={() => setActiveTab('currentMonthDac')}
            >
              <span>🛡️</span>Current Month Day wise DAC
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'dacAdvanceReport' ? 'active' : ''}`}
              onClick={() => setActiveTab('dacAdvanceReport')}
            >
              <span>⚡</span>DAC Advance Report Current Month
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'productWise' ? 'active' : ''}`}
              onClick={() => setActiveTab('productWise')}
            >
              <span>📦</span>Product wise Sales Report
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'monthWise' ? 'active' : ''}`}
              onClick={() => setActiveTab('monthWise')}
            >
              <span>📅</span>Month wise Sales Report
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'monthlyDac' ? 'active' : ''}`}
              onClick={() => setActiveTab('monthlyDac')}
            >
              <span>🎯</span>Monthly DAC %
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'dayWise' ? 'active' : ''}`}
              onClick={() => {
                setFilters((prev) => ({
                  ...prev,
                  monthNo: String(new Date().getMonth() + 1).padStart(2, '0'),
                  packageCode: 'ALL',
                  selectedProducts: [...DEFAULT_DAC_PRODUCTS],
                }));
                setActiveTab('dayWise');
              }}
            >
              <span>📈</span>Day wise Sales
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'fyWise' ? 'active' : ''}`}
              onClick={() => {
                setFilters((prev) => ({ ...prev, monthNo: 'ALL', packageCode: 'ALL', selectedProducts: [] }));
                setActiveTab('fyWise');
              }}
            >
              <span>🗓️</span>FY wise Sales
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'breakdowns' ? 'active' : ''}`}
              onClick={() => setActiveTab('breakdowns')}
            >
              <span>📑</span>Breakdown Reports
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'advanceReports' ? 'active' : ''}`}
              onClick={() => {
                setFilters((prev) => ({
                  ...prev,
                  monthNo: String(new Date().getMonth() + 1).padStart(2, '0'),
                  packageCode: 'ALL',
                  selectedProducts: [...DEFAULT_DAC_PRODUCTS],
                }));
                setSelectedAdvancedReport(null);
                setAdvancedDetailPage(1);
                setActiveTab('advanceReports');
              }}
            >
              <span>🚀</span>Advance Report
            </button>

            <div className="sales-sidebar-group-title">DATA &amp; SETTINGS</div>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'detailed' ? 'active' : ''}`}
              onClick={() => {
                setFilters((prev) => ({
                  ...prev,
                  monthNo: String(new Date().getMonth() + 1).padStart(2, '0'),
                }));
                setDetailPage(1);
                setActiveTab('detailed');
              }}
            >
              <span>📋</span>Detailed Sales Data
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <span>📤</span>Uploads
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <span>🗃️</span>Import History
            </button>
            <button
              type="button"
              className={`sales-report-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <span>⚙️</span>Setting
            </button>
          </nav>
        </aside>

        {/* Right Content Area */}
        <section className={`sales-report-content${!hasCompletedInitialSync ? ' sales-report-content--initial-sync' : ''}`}>
          {!hasCompletedInitialSync && (
            <div className="sales-initial-sync-screen" role="status" aria-live="polite">
              <div className="sales-initial-sync-screen__icon">☁️</div>
              <h2>Loading Sales Report</h2>
              <p>Cloud data synchronize ho raha hai. Report sync complete hone ke baad dikhega.</p>
              <div className="sales-initial-sync-screen__progress">
                <span style={{ width: `${syncProgress}%` }} />
              </div>
              <strong>{syncProgress}% Synced</strong>
            </div>
          )}
          {/* ========================================== */}
          {/* TAB 1: OVERVIEW / SALES DASHBOARD          */}
          {/* ========================================== */}
          {activeTab === 'overview' && (
            <>
              {/* Top Combined Filter Bar */}
              <SalesFilterBar
                filters={filters}
                onFilterChange={(f) => {
                  setFilters(f);
                  setDetailPage(1);
                }}
                onResetFilters={() => {
                  setFilters(INITIAL_FILTERS);
                  setDetailPage(1);
                }}
                availableOptions={availableOptions}
              />

              {/* Top KPI Cards (Section 40) */}
              <div className="sales-kpi-summary-grid sales-kpi-summary-grid--single-row">
                <div className="sales-kpi-summary-card sales-kpi-summary-card--primary">
                  <span>Total Refill Quantity - FY</span>
                  <strong>{dashboardKpis.totalRefillQuantity.toLocaleString()}</strong>
                  <small>Selected financial year</small>
                </div>
                <div className="sales-kpi-summary-card sales-kpi-summary-card--green">
                  <span>Average Daily Sales</span>
                  <strong>{dashboardKpis.averageDailySales.toLocaleString()} Cyl/Day</strong>
                  <small>Across {dashboardKpis.activeDaysCount} active delivery days</small>
                </div>
                <div className="sales-kpi-summary-card sales-kpi-summary-card--amber">
                  <span>DAC Compliance - FY</span>
                  <strong>{dashboardKpis.dacPercent}%</strong>
                  <small>OTP/DAC authenticated</small>
                </div>
                <div className="sales-kpi-summary-card sales-kpi-summary-card--purple">
                  <span>Total Refill - Current Month</span>
                  <strong>{dashboardKpis.currentMonth.refill.toLocaleString()}</strong>
                  <small>{dashboardKpis.currentMonthLabel}</small>
                </div>
                <div className="sales-kpi-summary-card">
                  <span>DAC - Current Month</span>
                  <strong>{dashboardKpis.currentMonth.dacPercent}%</strong>
                  <small>{dashboardKpis.currentMonthLabel} compliance</small>
                </div>
                <div className="sales-kpi-summary-card">
                  <span>Total Refill - Yesterday</span>
                  <strong>{dashboardKpis.yesterday.refill.toLocaleString()}</strong>
                  <small>{dashboardKpis.yesterdayLabel}</small>
                </div>
                <div className="sales-kpi-summary-card">
                  <span>DAC - Yesterday</span>
                  <strong>{dashboardKpis.yesterday.dacPercent}%</strong>
                  <small>{dashboardKpis.yesterdayLabel} compliance</small>
                </div>
                <div className="sales-kpi-summary-card sales-kpi-summary-card--primary">
                  <span>Total Refill - Today</span>
                  <strong>{dashboardKpis.today.refill.toLocaleString()}</strong>
                  <small>{dashboardKpis.todayLabel}</small>
                </div>
                <div className="sales-kpi-summary-card sales-kpi-summary-card--green">
                  <span>DAC - Today</span>
                  <strong>{dashboardKpis.today.dacPercent}%</strong>
                  <small>{dashboardKpis.todayLabel} compliance</small>
                </div>
              </div>

              <div className="sales-card">
                <div className="sales-card-header">
                  <div>
                    <h2>📊 Sales Overview &amp; Visual Analytics</h2>
                  <p>Dynamic charts generated from filtered transaction data</p>
                </div>
              </div>

              <div className="sales-charts-grid">
                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>📊 Total Refill vs DAC</h3>
                    <p>Refill quantity and DAC compliance across key periods</p>
                  </div>
                  <RefillDacComparisonChart
                    data={chartsData.periodRefillChart}
                  />
                </div>

                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>📈 Daily Refill Sales ({chartsData.dailyChartLabel})</h3>
                    <p>Current or selected month refill quantity by delivery day</p>
                  </div>
                  <SimpleBarChart
                    data={chartsData.dailyChart}
                    xKey="label"
                    yKey="value"
                    color="#0284c7"
                    yLabel="Cyl"
                  />
                </div>

                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>📅 Monthly Refill Sales (12-Month Calendar)</h3>
                    <p>Refill quantity distribution by month</p>
                  </div>
                  <SimpleBarChart
                    data={chartsData.monthlyChart}
                    xKey="label"
                    yKey="value"
                    color="#10b981"
                    yLabel="Cyl"
                  />
                </div>

                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>🗓️ Financial Year Comparison</h3>
                    <p>Comparative refill volume across FYs</p>
                  </div>
                  <SimpleBarChart
                    data={chartsData.fyChart}
                    xKey="label"
                    yKey="value"
                    color="#8b5cf6"
                    yLabel="Cyl"
                  />
                </div>

                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>📍 Top Delivery Areas</h3>
                    <p>Ranked delivery areas by refill quantity</p>
                  </div>
                  <HorizontalBarChart
                    data={chartsData.areaChart}
                    labelKey="label"
                    valueKey="value"
                  />
                </div>

                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>🛵 Delivery Staff Performance</h3>
                    <p>Refill cylinders delivered per staff / driver</p>
                  </div>
                  <HorizontalBarChart
                    data={chartsData.staffChart}
                    labelKey="label"
                    valueKey="value"
                  />
                </div>

                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>📦 Package Code / Product Breakdown</h3>
                    <p>Share of domestic vs commercial cylinders</p>
                  </div>
                  <ProductBreakdownChart
                    data={chartsData.packageChart}
                    labelKey="label"
                    valueKey="value"
                  />
                </div>

                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>👥 Nature of Consumer</h3>
                    <p>Ujjwala vs Domestic vs BPL proportion</p>
                  </div>
                  <ProductBreakdownChart
                    data={chartsData.natureChart}
                    labelKey="label"
                    valueKey="value"
                  />
                </div>

                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>📱 Order Source Distribution</h3>
                    <p>IVRS, HP Pay, Distributor, Vitran</p>
                  </div>
                  <ProductBreakdownChart
                    data={chartsData.sourceChart}
                    labelKey="label"
                    valueKey="value"
                  />
                </div>
              </div>
            </div>
          </>
        )}

          {/* ========================================== */}
          {/* TAB: CONSUMER SEARCH & DELIVERY HISTORY   */}
          {/* ========================================== */}
          {activeTab === 'salesTrend' && (
            <div className="sales-card sales-trend-page">
              <div className="sales-card-header">
                <div><h2>📈 Sales Trend</h2><p>Delivery Date-wise booking age trend for selected month</p></div>
              </div>
              <SectionFilterToolbar
                monthNo={filters.monthNo}
                selectedProducts={filters.selectedProducts || []}
                availableProducts={allAvailableProducts}
                onMonthChange={(monthNo) => setFilters((prev) => ({ ...prev, monthNo }))}
                onProductsChange={(selectedProducts) => setFilters((prev) => ({ ...prev, selectedProducts }))}
                onReset={() => setFilters((prev) => ({ ...prev, monthNo: String(new Date().getMonth() + 1).padStart(2, '0'), packageCode: 'ALL', selectedProducts: [...DEFAULT_DAC_PRODUCTS] }))}
              />
              <div className="sales-trend-kpis">
                <article><span>Delivery Date Total</span><strong>{salesTrendData.totalDeliveries.toLocaleString()}</strong><small>Delivered cylinders</small></article>
                <article><span>Same-day Booking</span><strong>{salesTrendData.sameDay.toLocaleString()}</strong><small>Booked and delivered same day</small></article>
                <article><span>1–2 Day Old Booking</span><strong>{salesTrendData.oneToTwoDays.toLocaleString()}</strong><small>Delivered after 1–2 days</small></article>
                <article><span>7+ Day Old Booking</span><strong>{salesTrendData.sevenPlus.toLocaleString()}</strong><small>Older backlog delivered</small></article>
              </div>
              <div className="sales-trend-chart-card">
                <header><div><h3>Daily Delivery vs Booking-Age Trend</h3><p>Each delivery date split by original booking date</p></div><div className="sales-trend-legend"><span><i className="age-0" />Same day</span><span><i className="age-1" />1 day</span><span><i className="age-2" />2 days</span><span><i className="age-3" />3–6 days</span><span><i className="age-7" />7–14 days</span><span><i className="age-15" />15+ days</span><span><i className="age-21" />21+ days</span></div></header>
                {salesTrendData.rows.length ? <div className="sales-age-chart">{salesTrendData.rows.map((row) => {
                  return <div className="sales-age-column" key={row.date}>
                    <strong className="sales-age-total">{row.deliveries}</strong>
                    <div className="sales-age-bar" style={{ height: `${Math.max(28, (row.deliveries / salesTrendData.maxValue) * 230)}px` }} title={`${row.date}: ${row.deliveries} deliveries`}>
                      {row.twentyOnePlus > 0 && <i className="age-21" style={{ flex: row.twentyOnePlus }} title={`21+ days: ${row.twentyOnePlus}`}>{row.twentyOnePlus}</i>}
                      {row.fifteenPlus > 0 && <i className="age-15" style={{ flex: row.fifteenPlus }} title={`15–20 days: ${row.fifteenPlus}`}>{row.fifteenPlus}</i>}
                      {row.sevenPlus > 0 && <i className="age-7" style={{ flex: row.sevenPlus }} title={`7–14 days: ${row.sevenPlus}`}>{row.sevenPlus}</i>}
                      {row.threeToSix > 0 && <i className="age-3" style={{ flex: row.threeToSix }} title={`3–6 days: ${row.threeToSix}`}>{row.threeToSix}</i>}
                      {row.twoDays > 0 && <i className="age-2" style={{ flex: row.twoDays }} title={`2 days: ${row.twoDays}`}>{row.twoDays}</i>}
                      {row.oneDay > 0 && <i className="age-1" style={{ flex: row.oneDay }} title={`1 day: ${row.oneDay}`}>{row.oneDay}</i>}
                      {row.sameDay > 0 && <i className="age-0" style={{ flex: row.sameDay }} title={`Same day: ${row.sameDay}`}>{row.sameDay}</i>}
                    </div><span>{row.date.slice(8, 10)}</span>
                  </div>;
                })}</div> : <div className="sales-trend-empty">Selected filters ke liye delivery data available nahi hai.</div>}
              </div>
              <div className="sales-trend-table-wrap"><table><thead><tr><th>Delivery Date</th><th>Total Delivery</th><th>Same-day Booking</th><th>Same Day Delivery %</th><th>1 Day Old</th><th>2 Days Old</th><th>3–6 Days Old</th><th>7–14 Days Old</th><th>15+ Days Old</th><th>21+ Days Old</th></tr></thead><tbody>{salesTrendData.rows.map((row) => {
                const countButton = (label, count, detailRows) => <button type="button" className="sales-trend-count" disabled={!count} onClick={() => setDeliveryDrilldown({ deliveryman: label, scope: 'Delivery vs Booking-Age Trend', label: row.date, count, rows: detailRows })}>{count}</button>;
                const sameDayPercent = row.deliveries ? (row.sameDay / row.deliveries) * 100 : 0;
                return <tr key={row.date}><td><strong>{row.date}</strong></td><td>{countButton('Total Deliveries', row.deliveries, row.details.all)}</td><td>{countButton('Same-day Booking', row.sameDay, row.details.sameDay)}</td><td><span className={`same-day-percent ${sameDayPercent >= 80 ? 'high' : sameDayPercent >= 50 ? 'medium' : 'low'}`}>{sameDayPercent.toFixed(1)}%</span></td><td>{countButton('1 Day Old Booking', row.oneDay, row.details.oneDay)}</td><td>{countButton('2 Days Old Booking', row.twoDays, row.details.twoDays)}</td><td>{countButton('3–6 Days Old Booking', row.threeToSix, row.details.threeToSix)}</td><td>{countButton('7–14 Days Old Booking', row.sevenPlus, row.details.sevenPlus)}</td><td>{countButton('15+ Days Old Booking', row.fifteenPlus, row.details.fifteenPlus)}</td><td>{countButton('21+ Days Old Booking', row.twentyOnePlus, row.details.twentyOnePlus)}</td></tr>;
              })}</tbody></table></div>
            </div>
          )}

          {activeTab === 'consumerSearch' && (
            <div className="sales-card consumer-search-page">
              <div className="sales-card-header consumer-search-header">
                <div>
                  <h2>🔎 Search Consumer</h2>
                  <p>Find a consumer by Consumer Number or Mobile Number and review complete delivery history.</p>
                </div>
              </div>

              <div className="consumer-search-panel">
                <div className="consumer-search-modes" role="group" aria-label="Consumer search type">
                  <button
                    type="button"
                    className={consumerSearchMode === 'consumerNo' ? 'active' : ''}
                    onClick={() => { setConsumerSearchMode('consumerNo'); setConsumerSearchQuery(''); setSelectedConsumerSearchNo(''); }}
                  >
                    🪪 Consumer Number
                  </button>
                  <button
                    type="button"
                    className={consumerSearchMode === 'mobileNo' ? 'active' : ''}
                    onClick={() => { setConsumerSearchMode('mobileNo'); setConsumerSearchQuery(''); setSelectedConsumerSearchNo(''); }}
                  >
                    📱 Mobile Number
                  </button>
                  <button
                    type="button"
                    className={consumerSearchMode === 'orderNo' ? 'active' : ''}
                    onClick={() => { setConsumerSearchMode('orderNo'); setConsumerSearchQuery(''); setSelectedConsumerSearchNo(''); }}
                  >
                    🧾 Order No
                  </button>
                  <button
                    type="button"
                    className={consumerSearchMode === 'cashMemoNo' ? 'active' : ''}
                    onClick={() => { setConsumerSearchMode('cashMemoNo'); setConsumerSearchQuery(''); setSelectedConsumerSearchNo(''); }}
                  >
                    🧮 CashMemo No
                  </button>
                  <button
                    type="button"
                    className={consumerSearchMode === 'consumerName' ? 'active' : ''}
                    onClick={() => { setConsumerSearchMode('consumerName'); setConsumerSearchQuery(''); setSelectedConsumerSearchNo(''); }}
                  >
                    👤 Consumer Name
                  </button>
                </div>
                <label className="consumer-search-input-wrap">
                  <span>{({
                    consumerNo: 'Consumer Number', mobileNo: 'Mobile Number', orderNo: 'Order Number',
                    cashMemoNo: 'CashMemo Number', consumerName: 'Consumer Name',
                  })[consumerSearchMode]}</span>
                  <div>
                    <span>🔍</span>
                    <input
                      type="search"
                      inputMode={consumerSearchMode === 'mobileNo' ? 'tel' : 'text'}
                      value={consumerSearchQuery}
                      onChange={(event) => {
                        setConsumerSearchQuery(event.target.value);
                        setSelectedConsumerSearchNo('');
                        setConsumerSearchFocused(true);
                      }}
                      onFocus={() => setConsumerSearchFocused(true)}
                      onBlur={() => setConsumerSearchFocused(false)}
                      placeholder={`Enter ${{
                        consumerNo: 'consumer number', mobileNo: 'registered mobile number', orderNo: 'order number',
                        cashMemoNo: 'cash memo number', consumerName: 'consumer name',
                      }[consumerSearchMode]}`}
                      autoComplete="off"
                    />
                    {consumerSearchQuery && (
                      <button type="button" onClick={() => { setConsumerSearchQuery(''); setSelectedConsumerSearchNo(''); }} aria-label="Clear search">✕</button>
                    )}
                  </div>
                  {consumerSearchFocused && activeConsumerSearchSuggestions.length > 0 && (
                    <div className="consumer-mobile-suggestions">
                      {activeConsumerSearchSuggestions.map((suggestion) => (
                        <button
                          type="button"
                          key={`${suggestion.normalized}-${suggestion.consumerNo}`}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setConsumerSearchQuery(suggestion.value);
                            setSelectedConsumerSearchNo(consumerSearchMode === 'consumerName' ? String(suggestion.consumerNo || '') : '');
                            setConsumerSearchFocused(false);
                          }}
                        >
                          <span>
                            {{ consumerNo: '🪪', mobileNo: '📱', orderNo: '🧾', cashMemoNo: '🧮', consumerName: '👤' }[consumerSearchMode]}
                            {' '}<strong>{suggestion.value}</strong>
                          </span>
                          <small>
                            {suggestion.consumerName} • Consumer No: {suggestion.consumerNo} • Mobile: {suggestion.mobile}
                          </small>
                        </button>
                      ))}
                    </div>
                  )}
                </label>
              </div>

              {consumerSearchQuery.trim() && consumerSearchResults.length > 0 && (
                <>
                  <div className="consumer-profile-summary">
                    <div><span>Consumer Number</span><strong>{consumerSearchResults[0].consumerNo || '—'}</strong></div>
                    <div><span>Consumer Name</span><strong>{consumerSearchResults[0].consumerName || '—'}</strong></div>
                    <div><span>Mobile Number</span><strong>{consumerSearchResults[0].mobileNo || '—'}</strong></div>
                    <div className="consumer-profile-summary__address"><span>Address</span><strong>{consumerSearchResults[0].consumerAddress || '—'}</strong></div>
                    <div><span>Delivery Area</span><strong>{consumerSearchResults[0].deliveryArea || '—'}</strong></div>
                    <div><span>Nature of Consumer</span><strong>{consumerSearchResults[0].natureOfConsumer || '—'}</strong></div>
                    <div><span>Last Delivery Date</span><strong>{consumerSearchResults[0].actualDeliveryDate || '—'}</strong></div>
                    <div><span>Last DAC Mode</span><strong>{consumerSearchResults[0].dacType || '—'}</strong></div>
                    <div><span>Total Deliveries</span><strong>{consumerSearchResults.length}</strong></div>
                  </div>

                  <div className="consumer-history-heading">
                    <div><h3>📜 Consumer History</h3><p>{consumerSearchResults.length} booking record{consumerSearchResults.length === 1 ? '' : 's'} found</p></div>
                  </div>
                  <div className="sales-data-table-wrap consumer-history-table-wrap">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>Consumer No</th>
                          <th>Consumer Name</th>
                          <th>Address</th>
                          <th>Mobile</th>
                          <th>Delivery Area</th>
                          <th>Nature of Consumer</th>
                          <th>Booking Date</th>
                          <th>Delivery Date</th>
                          <th>DAC Type</th>
                          <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                          <th>Payment Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consumerSearchResults.map((row, index) => (
                          <tr key={row.id || row.uniqueKey || `${row.consumerNo}-${index}`}>
                            <td>{row.consumerNo || '—'}</td>
                            <td><strong>{row.consumerName || '—'}</strong></td>
                            <td className="consumer-history-address">{row.consumerAddress || '—'}</td>
                            <td>{row.mobileNo || '—'}</td>
                            <td>{row.deliveryArea || '—'}</td>
                            <td>{row.natureOfConsumer || '—'}</td>
                            <td>{row.orderDateKey || row.orderDate || '—'}</td>
                            <td>{row.actualDeliveryDate || '—'}</td>
                            <td><span className="consumer-mode-badge">{row.dacType || '—'}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>
                              ₹{(Number(row.salesValue) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td>{row.paymentMode || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {consumerSearchQuery.trim() && consumerSearchResults.length === 0 && (
                <div className="consumer-search-empty">
                  <span>🔍</span>
                  <strong>{consumerSearchMode === 'consumerName' && !selectedConsumerSearchNo ? 'Select the consumer' : 'No consumer found'}</strong>
                  <p>{consumerSearchMode === 'consumerName' && !selectedConsumerSearchNo ? 'Suggestion list se Consumer Number ke saath correct consumer select karein.' : <>Check the {{
                    consumerNo: 'consumer number', mobileNo: 'mobile number', orderNo: 'order number',
                    cashMemoNo: 'cash memo number', consumerName: 'consumer name',
                  }[consumerSearchMode]} and try again.</>}</p>
                </div>
              )}

              {!consumerSearchQuery.trim() && (
                <div className="consumer-search-empty consumer-search-empty--idle">
                  <span>👤</span>
                  <strong>Search consumer records</strong>
                  <p>Select a search option and enter the exact number above.</p>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: CURRENT MONTH DAY WISE DAC (Request 6 & 7) */}
          {/* ========================================== */}
          {activeTab === 'currentMonthDac' && (
            <div className="sales-card">
              <div className="sales-card-header">
                <div>
                  <h2>🛡️ Day wise DAC Compliance Report</h2>
                  <p>Daily delivery authentication matrix with OTP/DAC, CDCMS, and MasterDAC breakdowns ({MONTH_NAMES[parseInt(dacReportMonth, 10) - 1]} {dacReportYear})</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="sales-report-btn sales-report-btn--export no-print"
                    style={{ background: '#10b981', color: '#fff' }}
                    onClick={() => {
                      const headers = ['Date', 'CDCMS', 'OTP/DAC', 'MasterDAC', 'Total', 'DAC%'];
                      const summaryRow = [
                        dayWiseDacTableData.summary.date,
                        dayWiseDacTableData.summary.cdcms,
                        dayWiseDacTableData.summary.otpDac,
                        dayWiseDacTableData.summary.masterDac,
                        dayWiseDacTableData.summary.total,
                        dayWiseDacTableData.summary.dacPercent,
                      ];
                      const rows = [
                        summaryRow,
                        ...dayWiseDacTableData.rows.map((r) => [r.date, r.cdcms, r.otpDac, r.masterDac, r.total, r.dacPercent]),
                      ];
                      exportTableToExcel(headers, rows, `Daywise_DAC_Report_${MONTH_NAMES[parseInt(dacReportMonth, 10) - 1]}_${dacReportYear}`);
                    }}
                  >
                    📥 Export Excel
                  </button>
                  <button
                    type="button"
                    className="sales-report-btn"
                    style={{ background: '#0284c7', color: '#fff' }}
                    onClick={() => {
                      const headers = ['Date', 'CDCMS', 'OTP/DAC', 'MasterDAC', 'Total', 'DAC%'];
                      const summaryRow = [
                        dayWiseDacTableData.summary.date,
                        dayWiseDacTableData.summary.cdcms,
                        dayWiseDacTableData.summary.otpDac,
                        dayWiseDacTableData.summary.masterDac,
                        dayWiseDacTableData.summary.total,
                        dayWiseDacTableData.summary.dacPercent,
                      ];
                      const rows = [
                        summaryRow,
                        ...dayWiseDacTableData.rows.map((r) => [r.date, r.cdcms, r.otpDac, r.masterDac, r.total, r.dacPercent]),
                      ];
                      exportTableToCsv(headers, rows, `Daywise_DAC_Report_${MONTH_NAMES[parseInt(dacReportMonth, 10) - 1]}_${dacReportYear}`);
                    }}
                  >
                    📥 Export CSV
                  </button>
                  <button
                    type="button"
                    className="sales-report-btn sales-report-btn--print no-print"
                    onClick={() => window.print()}
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>

              {/* Day-wise DAC Dedicated Filter Toolbar: Past Month & Multi-Product Select */}
              <div className="daywise-dac-filter-bar no-print">
                <div className="daywise-dac-filter-row">
                  <div className="daywise-dac-filter-controls">
                    {/* Month Picker (Past / Current) */}
                    <div className="daywise-dac-field">
                      <label>📅 Select Month</label>
                      <select
                        className="daywise-dac-select"
                        value={dacReportMonth}
                        onChange={(e) => setDacReportMonth(e.target.value)}
                      >
                        {FY_MONTHS.map((m) => (
                          <option key={m.monthCode} value={m.monthCode}>
                            {m.name} ({m.monthCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Year Picker */}
                    <div className="daywise-dac-field">
                      <label>🗓️ Select Year</label>
                      <select
                        className="daywise-dac-select"
                        value={dacReportYear}
                        onChange={(e) => setDacReportYear(parseInt(e.target.value, 10))}
                      >
                        {dacAvailableYears.map((yr) => (
                          <option key={yr} value={yr}>
                            {yr}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Multi-Product Selector */}
                    <div className="daywise-dac-field">
                      <label>📦 Multi-Product Select</label>
                      <div className="daywise-multiselect-wrap">
                        <button
                          type="button"
                          className={`daywise-multiselect-btn ${dacSelectedProducts.length > 0 ? 'is-active' : ''}`}
                          onClick={() => setDacProductDropdownOpen((prev) => !prev)}
                        >
                          <span>
                            {dacSelectedProducts.length === 0
                              ? `All Products (${dacAvailableProducts.length})`
                              : (dacSelectedProducts.length === DEFAULT_DAC_PRODUCTS.length && DEFAULT_DAC_PRODUCTS.every((p) => dacSelectedProducts.includes(p)))
                                ? `14.2 KG Domestic (Default: 2)`
                                : `${dacSelectedProducts.length} Product${dacSelectedProducts.length > 1 ? 's' : ''} Selected`}
                          </span>
                          <span style={{ fontSize: '10px' }}>{dacProductDropdownOpen ? '▲' : '▼'}</span>
                        </button>

                        {dacProductDropdownOpen && (
                          <div className="daywise-multiselect-popover">
                            <div className="daywise-multiselect-header">
                              <span>Choose Products</span>
                              <div className="daywise-multiselect-actions">
                                <button
                                  type="button"
                                  onClick={() => setDacSelectedProducts(DEFAULT_DAC_PRODUCTS)}
                                  title="Select default 14.2 KG Domestic cylinders"
                                >
                                  Default (14.2 KG)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDacSelectedProducts([])}
                                  title="Include all products without filter"
                                >
                                  All ({dacAvailableProducts.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDacSelectedProducts([])}
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                            <div className="daywise-multiselect-list">
                              {dacAvailableProducts.map((p) => {
                                const isChecked = dacSelectedProducts.includes(p);
                                return (
                                  <label key={p} className="daywise-product-checkbox-label">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setDacSelectedProducts((prev) =>
                                          isChecked
                                            ? prev.filter((item) => item !== p)
                                            : [...prev, p]
                                        );
                                      }}
                                    />
                                    <span title={p} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {p}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            <div style={{ marginTop: '8px', textAlign: 'right', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                              <button
                                type="button"
                                className="sales-report-btn sales-report-btn--primary"
                                style={{ padding: '4px 10px', fontSize: '11px' }}
                                onClick={() => setDacProductDropdownOpen(false)}
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reset Button */}
                    <div className="daywise-dac-field" style={{ justifyContent: 'flex-end' }}>
                      <label>&nbsp;</label>
                      <button
                        type="button"
                        className="sales-report-btn"
                        style={{ background: '#f1f5f9', color: '#475569', fontSize: '12px', fontWeight: '700', border: '1px solid #cbd5e1', padding: '8px 14px' }}
                        onClick={() => {
                          setDacReportMonth('09');
                          setDacReportYear(2026);
                          setDacSelectedProducts(DEFAULT_DAC_PRODUCTS);
                        }}
                        title="Reset month, year and product filters to default"
                      >
                        🔄 Reset Filters
                      </button>
                    </div>
                  </div>

                  {/* Active Filter Summary */}
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                    Showing: <strong style={{ color: '#0f3756' }}>{MONTH_NAMES[parseInt(dacReportMonth, 10) - 1]} {dacReportYear}</strong>
                    {dacSelectedProducts.length === 0 ? (
                      <span> • <strong style={{ color: '#16a34a' }}>All Products</strong></span>
                    ) : (dacSelectedProducts.length === DEFAULT_DAC_PRODUCTS.length && DEFAULT_DAC_PRODUCTS.every((p) => dacSelectedProducts.includes(p))) ? (
                      <span> • <strong style={{ color: '#0284c7' }}>14.2 KG Domestic (Default: 2 Products)</strong></span>
                    ) : (
                      <span> • <strong style={{ color: '#0284c7' }}>{dacSelectedProducts.length} Product{dacSelectedProducts.length > 1 ? 's' : ''}</strong></span>
                    )}
                  </div>
                </div>

                {/* Selected Products Badges */}
                {dacSelectedProducts.length > 0 && (
                  <div className="daywise-selected-chips-bar">
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Filtered Products:</span>
                    {dacSelectedProducts.map((p) => (
                      <span key={p} className="daywise-product-chip" title={p}>
                        {p.slice(0, 32)}{p.length > 32 ? '…' : ''}
                        <button
                          type="button"
                          onClick={() => setDacSelectedProducts((prev) => prev.filter((item) => item !== p))}
                          title="Remove product filter"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: '0 4px' }}
                      onClick={() => setDacSelectedProducts(DEFAULT_DAC_PRODUCTS)}
                    >
                      Reset to Default (14.2 KG)
                    </button>
                  </div>
                )}
              </div>

              {/* Month, yesterday and today DAC KPIs */}
              {[
                { title: 'Current Month', subtitle: `${MONTH_NAMES[parseInt(dacReportMonth, 10) - 1]} ${dacReportYear}`, data: dayWiseDacTableData.summary },
                { title: 'Yesterday', subtitle: dayWiseDacTableData.yesterday.label, data: dayWiseDacTableData.yesterday },
                { title: 'Today', subtitle: dayWiseDacTableData.today.label, data: dayWiseDacTableData.today },
              ].map((period) => (
                <section className="daywise-dac-kpi-section" key={period.title}>
                  <div className="daywise-dac-kpi-heading">
                    <strong>{period.title} DAC Summary</strong>
                    <span>{period.subtitle}</span>
                  </div>
                  <div className="daywise-dac-kpi-grid">
                    <div className="sales-kpi-summary-card sales-kpi-summary-card--primary">
                      <span>{period.title} DAC %</span>
                      <strong>{period.data.dacPercent}</strong>
                      <small>Authenticated deliveries</small>
                    </div>
                    <div className="sales-kpi-summary-card sales-kpi-summary-card--green">
                      <span>OTP / DAC Refills</span>
                      <strong>{period.data.otpDac.toLocaleString()}</strong>
                      <small>OTP authenticated deliveries</small>
                    </div>
                    <div className="sales-kpi-summary-card sales-kpi-summary-card--amber">
                      <span>CDCMS Deliveries</span>
                      <strong>{period.data.cdcms.toLocaleString()}</strong>
                      <small>Emergency / Offline mode</small>
                    </div>
                    <div className="sales-kpi-summary-card sales-kpi-summary-card--purple">
                      <span>Total Cylinders</span>
                      <strong>{period.data.total.toLocaleString()}</strong>
                      <small>CDCMS + OTP/DAC + MasterDAC</small>
                    </div>
                  </div>
                </section>
              ))}

              {/* Exact Day-wise DAC Table from Screenshot */}
              <div className="daywise-dac-sheet">
                {/* Header Legend */}
                <div className="daywise-dac-sheet-bar no-print">
                  <div className="daywise-dac-sheet-title">
                    <span>📅 Daily Deliveries &amp; Authentication Log ({MONTH_NAMES[parseInt(dacReportMonth, 10) - 1]} {dacReportYear})</span>
                    <small>All dates for {MONTH_NAMES[parseInt(dacReportMonth, 10) - 1]} {dacReportYear} {dacSelectedProducts.length > 0 ? `• ${dacSelectedProducts.length} Product${dacSelectedProducts.length > 1 ? 's' : ''} Filtered` : '• All Products'}</small>
                  </div>
                  <div className="daywise-dac-legend">
                    <span className="dac-legend-item"><i className="dac-dot dac-dot--high"></i> ≥95% Target</span>
                    <span className="dac-legend-item"><i className="dac-dot dac-dot--medium"></i> 90–94% Good</span>
                    <span className="dac-legend-item"><i className="dac-dot dac-dot--low"></i> &lt;90% Low</span>
                    <span className="dac-legend-item"><i className="dac-dot dac-dot--zero"></i> 0% Inactive</span>
                  </div>
                </div>

                <div className="daywise-dac-table-wrap">
                  <table className="daywise-dac-table">
                    <thead>
                      <tr>
                        <th style={{ width: '20%', textAlign: 'center' }}>Date</th>
                        <th style={{ width: '16%', textAlign: 'right' }}>CDCMS</th>
                        <th style={{ width: '18%', textAlign: 'right' }}>OTP/DAC</th>
                        <th style={{ width: '16%', textAlign: 'right' }}>MasterDAC</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Total</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>DAC%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayWiseDacTableData.rows.map((row) => {
                        const dacNum = parseInt(row.dacPercent, 10) || 0;
                        const isZero = row.dacPercent === '0%' || row.total === 0;
                        let badgeClass = 'dac-badge dac-badge--zero';
                        if (!isZero) {
                          if (dacNum >= 95) badgeClass = 'dac-badge dac-badge--high';
                          else if (dacNum >= 90) badgeClass = 'dac-badge dac-badge--medium';
                          else badgeClass = 'dac-badge dac-badge--low';
                        }
                        return (
                          <tr key={row.date}>
                            <td className="daywise-date-cell" style={{ textAlign: 'center' }}>{row.date}</td>
                            <td style={{ textAlign: 'right' }}><button type="button" className="dac-delivery-count-btn" disabled={!row.cdcms} onClick={() => setDeliveryDrilldown({ deliveryman: 'CDCMS Deliveries', scope: 'Daily Authentication Log', label: row.date, count: row.cdcms, rows: row.details?.cdcms || [] })}>{row.cdcms.toLocaleString()}</button></td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: '#0284c7' }}>{row.otpDac.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: '#94a3b8' }}>{row.masterDac.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>{row.total.toLocaleString()}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={badgeClass}>{row.dacPercent}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: DAC ADVANCE REPORT CURRENT MONTH      */}
          {/* ========================================== */}
          {activeTab === 'dacAdvanceReport' && (
            <div className="sales-card dac-advance-container">
              <div className="sales-card-header">
                <div>
                  <h2>⚡ DAC Advance Report Current Month</h2>
                  <p>Comprehensive Operational Breakdown &amp; Deliveryman Authentication Performance Matrix ({MONTH_NAMES[parseInt(advanceDacMonth, 10) - 1]} {advanceDacYear})</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="sales-report-btn sales-report-btn--export no-print"
                    style={{ background: '#10b981', color: '#fff' }}
                    onClick={exportDacAdvanceToExcel}
                  >
                    📥 Export Excel
                  </button>
                  <button
                    type="button"
                    className="sales-report-btn"
                    style={{ background: '#0284c7', color: '#fff' }}
                    onClick={exportDacAdvanceToCsv}
                  >
                    📥 Export CSV
                  </button>
                  <button
                    type="button"
                    className="sales-report-btn sales-report-btn--print no-print"
                    onClick={() => window.print()}
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>

              {/* Dedicated Filter Toolbar */}
              <div className="daywise-dac-filter-bar no-print" style={{ marginBottom: '20px' }}>
                <div className="daywise-dac-filter-row">
                  <div className="daywise-dac-filter-controls">
                    {/* Month Picker */}
                    <div className="daywise-dac-field">
                      <label>📅 Select Month</label>
                      <select
                        className="daywise-dac-select"
                        value={advanceDacMonth}
                        onChange={(e) => setAdvanceDacMonth(e.target.value)}
                      >
                        {FY_MONTHS.map((m) => (
                          <option key={m.monthCode} value={m.monthCode}>
                            {m.name} ({m.monthCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Year Picker */}
                    <div className="daywise-dac-field">
                      <label>🗓️ Select Year</label>
                      <select
                        className="daywise-dac-select"
                        value={advanceDacYear}
                        onChange={(e) => setAdvanceDacYear(parseInt(e.target.value, 10))}
                      >
                        {dacAvailableYears.map((yr) => (
                          <option key={yr} value={yr}>
                            {yr}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Delivery Counting Mode */}
                    <div className="daywise-dac-field">
                      <label>🎯 Delivery Counter Mode</label>
                      <select
                        className="daywise-dac-select"
                        value={advanceDacMode}
                        onChange={(e) => setAdvanceDacMode(e.target.value)}
                      >
                        <option value="otpDac">OTP / DAC Deliveries (Matching DAC)</option>
                        <option value="all">All Refill Deliveries</option>
                      </select>
                    </div>

                    {/* Day 1 Date Picker */}
                    <div className="daywise-dac-field">
                      <label>📅 Day 1 Date ({dacAdvanceReportData.deliveryMatrix.day1Label})</label>
                      <input
                        type="date"
                        className="daywise-dac-select"
                        value={advanceDacDay1}
                        onChange={(e) => setAdvanceDacDay1(e.target.value)}
                      />
                    </div>

                    {/* Day 2 Date Picker */}
                    <div className="daywise-dac-field">
                      <label>📅 Day 2 Date ({dacAdvanceReportData.deliveryMatrix.day2Label})</label>
                      <input
                        type="date"
                        className="daywise-dac-select"
                        value={advanceDacDay2}
                        onChange={(e) => setAdvanceDacDay2(e.target.value)}
                      />
                    </div>

                    {/* Reset Button */}
                    <div className="daywise-dac-field" style={{ justifyContent: 'flex-end' }}>
                      <label>&nbsp;</label>
                      <button
                        type="button"
                        className="sales-report-btn"
                        style={{ background: '#f1f5f9', color: '#475569', fontSize: '12px', fontWeight: '700', border: '1px solid #cbd5e1', padding: '8px 14px' }}
                        onClick={() => {
                          const defaults = getAdvanceDefaultDates();
                          const now = new Date();
                          setAdvanceDacMonth(String(now.getMonth() + 1).padStart(2, '0'));
                          setAdvanceDacYear(now.getFullYear());
                          setAdvanceDacMode('otpDac');
                          setAdvanceDacDay1(defaults.today);
                          setAdvanceDacDay2(defaults.yesterday);
                        }}
                        title="Reset all filters to default"
                      >
                        🔄 Reset Filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reference Data Banner when using sample data */}
              {dacAdvanceReportData.isSample && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span>ℹ️ <strong>Standard Reference View:</strong> Showing baseline September 2026 data matching your operational reports. Upload your sales file to refresh dynamically.</span>
                  <button
                    type="button"
                    className="sales-report-btn sales-report-btn--quick-upload"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => openImportModal('monthWise', currentYear, currentMonthCode)}
                  >
                    ⚡ Upload {currentMonthName.slice(0, 3)} {currentYear} File
                  </button>
                </div>
              )}

              {/* 1. TOP SECTION: Deliveryman Performance Matrix (User Request: "isko upar rakho") */}
              <div className="dac-advance-matrix-card">
                <div className="dac-advance-matrix-header">
                  <div className="dac-matrix-header-info">
                    <div className="dac-matrix-icon-title">
                      <span className="dac-matrix-emoji">🚚</span>
                      <div>
                        <h3>Deliveryman Performance Matrix</h3>
                        <p>Comparative authentication matrix: Month-to-date vs Selected Day ({dacAdvanceReportData.deliveryMatrix.day1Label}) vs Date-wise ({dacAdvanceReportData.deliveryMatrix.day2Label})</p>
                      </div>
                    </div>
                  </div>
                  <div className="dac-matrix-header-badges no-print">
                    <span className="dac-mode-tag">
                      Mode: <strong>{advanceDacMode === 'otpDac' ? 'OTP / DAC Verified' : 'All Refills'}</strong>
                    </span>
                  </div>
                </div>

                <div className="dac-matrix-scroll-wrap">
                  <div className="dac-advance-matrix-grid">
                    {/* Column 1: Month Delivery */}
                    <div className="dac-matrix-col">
                      <div className="dac-matrix-footer">
                        <span className="dac-matrix-footer-btn">Month 👆</span>
                        <span className="dac-matrix-date-badge">{MONTH_NAMES[parseInt(advanceDacMonth, 10) - 1]} {advanceDacYear}</span>
                      </div>
                      <table className="dac-advance-table">
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Deliveryman</th>
                            <th style={{ width: '95px', textAlign: 'right' }}>Delivery</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dacAdvanceReportData.deliveryMatrix.rows.map((dm, idx) => (
                            <tr key={idx}>
                              <td>{dm.name}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="dac-delivery-count-btn"
                                  disabled={!dm.month}
                                  onClick={() => setDeliveryDrilldown({ deliveryman: dm.name, scope: 'Month', label: `${MONTH_NAMES[parseInt(advanceDacMonth, 10) - 1]} ${advanceDacYear}`, count: dm.month, rows: dm.details?.month || [] })}
                                  title={`View ${dm.name} consumer deliveries`}
                                >{dm.month.toLocaleString()}</button>
                              </td>
                            </tr>
                          ))}
                          <tr className="dac-advance-yellow-row">
                            <td style={{ textAlign: 'left', fontWeight: '900' }}>Total</td>
                            <td style={{ textAlign: 'right', fontWeight: '900' }}>{dacAdvanceReportData.deliveryMatrix.monthTotal.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Column 2: Selected Day Delivery */}
                    <div className="dac-matrix-col">
                      <div className="dac-matrix-footer">
                        <span className="dac-matrix-footer-btn">Day 👆</span>
                        <span className="dac-matrix-date-badge">{dacAdvanceReportData.deliveryMatrix.day1Label}</span>
                      </div>
                      <table className="dac-advance-table">
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Deliveryman</th>
                            <th style={{ width: '95px', textAlign: 'right' }}>Delivery</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dacAdvanceReportData.deliveryMatrix.rows.map((dm, idx) => (
                            <tr key={idx}>
                              <td>{dm.name}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="dac-delivery-count-btn"
                                  disabled={!dm.day1}
                                  onClick={() => setDeliveryDrilldown({ deliveryman: dm.name, scope: 'Selected Day', label: dacAdvanceReportData.deliveryMatrix.day1Label, count: dm.day1, rows: dm.details?.day1 || [] })}
                                  title={`View ${dm.name} consumer deliveries`}
                                >{dm.day1.toLocaleString()}</button>
                              </td>
                            </tr>
                          ))}
                          <tr className="dac-advance-yellow-row">
                            <td style={{ textAlign: 'left', fontWeight: '900' }}>Total</td>
                            <td style={{ textAlign: 'right', fontWeight: '900' }}>{dacAdvanceReportData.deliveryMatrix.day1Total.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Column 3: Date wise Delivery */}
                    <div className="dac-matrix-col">
                      <div className="dac-matrix-footer">
                        <span className="dac-matrix-footer-btn">Date wise 👆</span>
                        <span className="dac-matrix-date-badge">{dacAdvanceReportData.deliveryMatrix.day2Label}</span>
                      </div>
                      <table className="dac-advance-table">
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Date</th>
                            <th style={{ width: '105px', textAlign: 'right' }}>{dacAdvanceReportData.deliveryMatrix.day2Label}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dacAdvanceReportData.deliveryMatrix.rows.map((dm, idx) => (
                            <tr key={idx}>
                              <td>{dm.name}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="dac-delivery-count-btn"
                                  disabled={!dm.day2}
                                  onClick={() => setDeliveryDrilldown({ deliveryman: dm.name, scope: 'Date-wise', label: dacAdvanceReportData.deliveryMatrix.day2Label, count: dm.day2, rows: dm.details?.day2 || [] })}
                                  title={`View ${dm.name} consumer deliveries`}
                                >{dm.day2.toLocaleString()}</button>
                              </td>
                            </tr>
                          ))}
                          <tr className="dac-advance-yellow-row">
                            <td style={{ textAlign: 'left', fontWeight: '900' }}>Total</td>
                            <td style={{ textAlign: 'right', fontWeight: '900' }}>{dacAdvanceReportData.deliveryMatrix.day2Total.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION HEADER FOR OPERATIONAL BREAKDOWN */}
              <div className="dac-section-divider">
                <div className="dac-section-divider-title">
                  <span>📊 Operational Breakdown Reports</span>
                  <small>Package types, order types, consumer categories, and online vs manual booking channels</small>
                </div>
              </div>

              {/* 2. LOWER SECTION: 4 Operational Cards in a 3-Column Balanced Layout */}
              <div className="dac-advance-operational-layout">
                {/* Col 1: Package Wise Refill Sales Data */}
                <div className="dac-operational-col">
                  <div className="dac-advance-card">
                    <div className="dac-card-bar">
                      <h4>📦 Package Wise Refill Sales Data</h4>
                    </div>
                    <table className="dac-advance-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Package Wise Refill Sales Data</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Refill Sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dacAdvanceReportData.packageWise.rows.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.name}</td>
                            <td style={{ textAlign: 'right' }}>{row.count.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="dac-advance-total-row">
                          <td style={{ textAlign: 'center', fontWeight: '900' }}>Total</td>
                          <td style={{ textAlign: 'right', fontWeight: '900' }}>{dacAdvanceReportData.packageWise.total.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Col 2: Order Type Delivery & Consumer Type Delivery Stacked */}
                <div className="dac-operational-col dac-operational-col--stacked">
                  {/* Order Type Delivery */}
                  <div className="dac-advance-card">
                    <div className="dac-card-bar">
                      <h4>📋 Order Type Delivery</h4>
                    </div>
                    <table className="dac-advance-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Order Type Delivery</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Refill Sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dacAdvanceReportData.orderType.rows.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.name}</td>
                            <td style={{ textAlign: 'right' }}>{row.count.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="dac-advance-total-row">
                          <td style={{ textAlign: 'center', fontWeight: '900' }}>Total</td>
                          <td style={{ textAlign: 'right', fontWeight: '900' }}>{dacAdvanceReportData.orderType.total.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Consumer Type Delivery */}
                  <div className="dac-advance-card">
                    <div className="dac-card-bar">
                      <h4>👥 Consumer Type Delivery</h4>
                    </div>
                    <table className="dac-advance-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Consumer Type Delivery</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Refill Sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dacAdvanceReportData.consumerType.rows.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.name}</td>
                            <td style={{ textAlign: 'right' }}>{row.count.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="dac-advance-total-row">
                          <td style={{ textAlign: 'center', fontWeight: '900' }}>Total</td>
                          <td style={{ textAlign: 'right', fontWeight: '900' }}>{dacAdvanceReportData.consumerType.total.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Col 3: Order Source Delivery & Online Booking Breakdown */}
                <div className="dac-operational-col">
                  <div className="dac-advance-card">
                    <div className="dac-card-bar">
                      <h4>📱 Order Source Delivery &amp; Online Booking</h4>
                    </div>
                    <table className="dac-advance-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Order Source delivery</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Refill Sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dacAdvanceReportData.orderSource.rows.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.name}</td>
                            <td style={{ textAlign: 'right' }}>{row.count.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="dac-advance-total-row">
                          <td style={{ textAlign: 'center', fontWeight: '900' }}>Total</td>
                          <td style={{ textAlign: 'right', fontWeight: '900' }}>{dacAdvanceReportData.orderSource.total.toLocaleString()}</td>
                        </tr>
                        {/* 3 Bright Yellow Highlight Summary Rows */}
                        <tr className="dac-advance-yellow-row">
                          <td style={{ fontWeight: '900' }}>Online Booking</td>
                          <td style={{ textAlign: 'right', fontWeight: '900' }}>{dacAdvanceReportData.orderSource.onlineBooking.toLocaleString()}</td>
                        </tr>
                        <tr className="dac-advance-yellow-row">
                          <td style={{ fontWeight: '900' }}>Manual Booking</td>
                          <td style={{ textAlign: 'right', fontWeight: '900' }}>{dacAdvanceReportData.orderSource.manualBooking.toLocaleString()}</td>
                        </tr>
                        <tr className="dac-advance-yellow-row">
                          <td style={{ fontWeight: '900' }}>Online Booking %</td>
                          <td style={{ textAlign: 'right', fontWeight: '900' }}>{dacAdvanceReportData.orderSource.onlineBookingPct}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: PRODUCT WISE SALES REPORT             */}
          {/* ========================================== */}
          {activeTab === 'productWise' && (
            <div className="sales-card">
              <div className="sales-card-header">
                <div>
                  <h2>📦 Product wise Sales Report</h2>
                  <p>Volume distribution, revenue turnover, and market share by cylinder package type</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="sales-report-btn"
                    style={{ background: '#10b981', color: '#fff' }}
                    onClick={() => {
                      const headers = ['Package Code / Product', 'Category', 'Orders', 'Refill Quantity', 'Sales Value (Rs)', 'Share %'];
                      const rows = dimensionalReports.packages.map((p) => [p.packageCode, p.category, p.orders, p.refillQuantity, p.salesValue.toFixed(2), `${p.share}%`]);
                      exportTableToExcel(headers, rows, 'Product_Wise_Sales_Report');
                    }}
                  >
                    📥 Export Excel
                  </button>
                  <button
                    type="button"
                    className="sales-report-btn sales-report-btn--print"
                    onClick={() => window.print()}
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>

              {/* Product Visual Charts Grid */}
              <div className="sales-charts-grid" style={{ marginBottom: '24px' }}>
                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>📦 Product Share Distribution</h3>
                    <p>Proportion of refills by cylinder type</p>
                  </div>
                  <DonutChart
                    data={chartsData.packageChart}
                    labelKey="label"
                    valueKey="value"
                    maxLegendItems={Number.POSITIVE_INFINITY}
                  />
                </div>

                <div className="sales-chart-card">
                  <div className="sales-chart-card-header">
                    <h3>📊 Product Refill Volumes (Cylinders)</h3>
                    <p>Ranked delivery volumes</p>
                  </div>
                  <HorizontalBarChart
                    data={dimensionalReports.packages.map((p) => ({ label: p.packageCode, value: p.refillQuantity }))}
                    labelKey="label"
                    valueKey="value"
                    maxItems={dimensionalReports.packages.length}
                  />
                </div>
              </div>

              {/* Product Ledger Table */}
              <div className="sales-data-table-wrap">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Sr</th>
                      <th>Package Code / Product Name</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'center' }}>Orders</th>
                      <th style={{ textAlign: 'center' }}>Refill Quantity (Cyl)</th>
                      <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                      <th style={{ textAlign: 'center' }}>Volume Share %</th>
                      <th style={{ textAlign: 'right' }} title="Sales Value divided by Refill Quantity">
                        Avg Rate / Cyl (₹)
                        <small style={{ display: 'block', fontSize: '9px', fontWeight: '600', opacity: 0.75 }}>
                          Sales Value ÷ Refill Qty
                        </small>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensionalReports.packages.length > 0 ? (
                      dimensionalReports.packages.map((p, i) => {
                        const avgRate = p.refillQuantity > 0 ? (p.salesValue / p.refillQuantity).toFixed(2) : '—';
                        return (
                          <tr key={p.packageCode}>
                            <td>{i + 1}</td>
                            <td><strong>{p.packageCode}</strong></td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: '700',
                                background: p.category === 'Commercial' ? '#fef3c7' : '#e0f2fe',
                                color: p.category === 'Commercial' ? '#92400e' : '#0369a1',
                              }}>
                                {p.category}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>{p.orders}</td>
                            <td style={{ textAlign: 'center' }}><strong>{p.refillQuantity}</strong></td>
                            <td style={{ textAlign: 'right' }}>₹{p.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ textAlign: 'center' }}>{p.share}%</td>
                            <td style={{ textAlign: 'right' }}>₹{avgRate}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>
                          No product transactions match the current filter selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {dimensionalReports.packages.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3}>Total</td>
                        <td style={{ textAlign: 'center' }}>{dimensionalReports.packages.reduce((s, p) => s + p.orders, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{dimensionalReports.packages.reduce((s, p) => s + p.refillQuantity, 0)}</td>
                        <td style={{ textAlign: 'right' }}>₹{dimensionalReports.packages.reduce((s, p) => s + p.salesValue, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'center' }}>100%</td>
                        <td style={{ textAlign: 'right' }}>₹{(
                          dimensionalReports.packages.reduce((s, p) => s + p.salesValue, 0)
                          / Math.max(dimensionalReports.packages.reduce((s, p) => s + p.refillQuantity, 0), 1)
                        ).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: MONTHLY DAC % (Manthy DAC %)          */}
          {/* ========================================== */}
          {activeTab === 'monthlyDac' && (
            <div className="sales-card modern-report-card modern-report-card--dac">
              <div className="sales-card-header">
                <div>
                  <h2>🎯 Monthly DAC % (Manthy DAC %) Report</h2>
                  <p>12-Month delivery authentication compliance ledger &amp; performance tracking</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="sales-report-btn"
                    style={{ background: '#10b981', color: '#fff' }}
                    onClick={() => {
                      const headers = ['Month', 'CDCMS', 'OTP/DAC', 'MasterDAC', 'Total Refills', 'DAC %'];
                      const rows = monthlyDacReport.map((m) => [m.monthName, m.cdcms, m.otpDac, m.masterDac, m.total, m.dacPercent]);
                      exportTableToExcel(headers, rows, 'Monthly_DAC_Percentage_Report');
                    }}
                  >
                    📥 Export Excel
                  </button>
                  <button
                    type="button"
                    className="sales-report-btn sales-report-btn--print"
                    onClick={() => window.print()}
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>

              {/* Monthly DAC Bar Chart */}
              <div className="modern-report-chart-panel">
                <h3 style={{ fontSize: '15px', color: '#0f3756', margin: '0 0 10px' }}>
                  📊 12-Month DAC % Performance (Benchmark: 95.0%)
                </h3>
                <SimpleBarChart
                  data={monthlyDacReport.map((m) => ({ label: m.monthName.slice(0, 3), value: m.dacPercentNum }))}
                  xKey="label"
                  yKey="value"
                  color="#10b981"
                  yLabel="%"
                />
              </div>

              {/* 12-Month Table */}
              <div className="sales-data-table-wrap">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Month (Indian FY)</th>
                      <th style={{ textAlign: 'center' }}>CDCMS Deliveries</th>
                      <th style={{ textAlign: 'center' }}>OTP/DAC Authenticated</th>
                      <th style={{ textAlign: 'center' }}>MasterDAC</th>
                      <th style={{ textAlign: 'center' }}>Total Refill Deliveries</th>
                      <th style={{ textAlign: 'center' }}>DAC %</th>
                      <th style={{ textAlign: 'center' }}>Compliance Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyDacReport.map((m) => {
                      const isCompliant = m.dacPercentNum >= 95;
                      const hasData = m.total > 0;
                      return (
                        <tr key={m.monthCode}>
                          <td><strong>{m.monthName}</strong></td>
                          <td style={{ textAlign: 'center' }}><button type="button" className="dac-delivery-count-btn" disabled={!m.cdcms} onClick={() => setDeliveryDrilldown({ deliveryman: 'CDCMS Deliveries', scope: 'Monthly DAC Report', label: m.monthName, count: m.cdcms, rows: m.details?.cdcms || [] })}>{m.cdcms || '—'}</button></td>
                          <td style={{ textAlign: 'center', fontWeight: '700' }}>{m.otpDac || '—'}</td>
                          <td style={{ textAlign: 'center' }}><button type="button" className="dac-delivery-count-btn" disabled={!m.masterDac} onClick={() => setDeliveryDrilldown({ deliveryman: 'MasterDAC Deliveries', scope: 'Monthly DAC Report', label: m.monthName, count: m.masterDac, rows: m.details?.masterDac || [] })}>{m.masterDac || 0}</button></td>
                          <td style={{ textAlign: 'center' }}><strong>{m.total || '—'}</strong></td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              fontWeight: '800',
                              color: !hasData ? '#94a3b8' : isCompliant ? '#15803d' : '#b91c1c',
                            }}>
                              {hasData ? m.dacPercent : '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {!hasData ? (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>No Data</span>
                            ) : isCompliant ? (
                              <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: '#dcfce7', color: '#15803d' }}>
                                ✅ Compliant (&ge;95%)
                              </span>
                            ) : (
                              <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: '#fee2e2', color: '#b91c1c' }}>
                                ⚠️ Low DAC (&lt;95%)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const sumCdcms = monthlyDacReport.reduce((s, m) => s + m.cdcms, 0);
                      const sumOtp = monthlyDacReport.reduce((s, m) => s + m.otpDac, 0);
                      const sumMaster = monthlyDacReport.reduce((s, m) => s + m.masterDac, 0);
                      const sumTot = monthlyDacReport.reduce((s, m) => s + m.total, 0);
                      const overallDac = sumTot > 0 ? Math.round(((sumOtp + sumMaster) / sumTot) * 100) : 0;
                      return (
                        <tr>
                          <td>Total</td>
                          <td style={{ textAlign: 'center' }}>{sumCdcms}</td>
                          <td style={{ textAlign: 'center' }}>{sumOtp}</td>
                          <td style={{ textAlign: 'center' }}>{sumMaster}</td>
                          <td style={{ textAlign: 'center' }}>{sumTot}</td>
                          <td style={{ textAlign: 'center' }}><strong>{overallDac}%</strong></td>
                          <td style={{ textAlign: 'center' }}>
                            {overallDac >= 95 ? '✅ Benchmark Achieved' : '⚠️ Attention Required'}
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: DAY WISE SALES REPORT                 */}
          {/* ========================================== */}
          {activeTab === 'dayWise' && (
            <div className="sales-card modern-report-card modern-report-card--day">
              <div className="sales-card-header">
                <div>
                  <h2>📈 Day Wise Refill Orders &amp; Revenue Ledger</h2>
                  <p>Daily order volume, refill quantity, and gross sales revenue</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="sales-report-btn sales-report-btn--export no-print"
                    style={{ background: '#10b981', color: '#fff' }}
                    onClick={() => {
                      const headers = ['Date', 'Orders', 'Refill Quantity (Cyl)', 'Sales Value (Rs)'];
                      const rows = dayWiseReport.map((d) => [d.date, d.orderCount, d.refillQuantity, d.salesValue.toFixed(2)]);
                      exportTableToExcel(headers, rows, 'Day_Wise_Sales_Ledger');
                    }}
                  >
                    📥 Export Excel
                  </button>
                  <button
                    type="button"
                    className="sales-report-btn sales-report-btn--print no-print"
                    onClick={() => window.print()}
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>

              {/* Section Filter Toolbar: Month, Multi-Product & Reset */}
              <SectionFilterToolbar
                monthNo={filters.monthNo}
                selectedProducts={filters.selectedProducts || []}
                availableProducts={allAvailableProducts}
                onMonthChange={(m) => setFilters((prev) => ({ ...prev, monthNo: m }))}
                onProductsChange={(prods) => setFilters((prev) => ({ ...prev, selectedProducts: prods }))}
                onReset={() => setFilters((prev) => ({
                  ...prev,
                  monthNo: String(new Date().getMonth() + 1).padStart(2, '0'),
                  packageCode: 'ALL',
                  selectedProducts: [...DEFAULT_DAC_PRODUCTS],
                }))}
              />

              <div className="sales-data-table-wrap">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th style={{ textAlign: 'center' }}>Orders</th>
                      <th style={{ textAlign: 'center' }}>Refill Quantity (Cyl)</th>
                      <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayWiseReport.map((d) => (
                      <tr key={d.date}>
                        <td><strong>{d.date}</strong></td>
                        <td style={{ textAlign: 'center' }}>{d.orderCount}</td>
                        <td style={{ textAlign: 'center' }}><strong>{d.refillQuantity}</strong></td>
                        <td style={{ textAlign: 'right' }}>₹{d.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td style={{ textAlign: 'center' }}>{dayWiseReport.reduce((s, r) => s + r.orderCount, 0)}</td>
                      <td style={{ textAlign: 'center' }}>{dayWiseReport.reduce((s, r) => s + r.refillQuantity, 0)}</td>
                      <td style={{ textAlign: 'right' }}>₹{dayWiseReport.reduce((s, r) => s + r.salesValue, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 3: MONTH WISE SALES REPORT             */}
          {/* ========================================== */}
          {activeTab === 'monthWise' && (
            <div className="sales-card modern-report-card modern-report-card--month">
              <div className="sales-card-header">
                <div>
                  <h2>📅 Month Wise Sales Report</h2>
                  <p>12-month aggregated refill sales, turnover, and month-vs-month comparative analysis</p>
                </div>
                <button
                  type="button"
                  className="sales-report-btn"
                  style={{ background: '#10b981', color: '#fff' }}
                  onClick={() => {
                    const headers = ['Month', 'Order Count', 'Refill Quantity', 'Sales Value (Rs)', 'Avg Daily Sales'];
                    const rows = monthWiseReport.map((m) => [m.monthName, m.orderCount, m.refillQuantity, m.salesValue.toFixed(2), m.avgDaily]);
                    exportTableToExcel(headers, rows, 'Monthly_Sales_Report');
                  }}
                >
                  📥 Export Excel
                </button>
              </div>

              {/* 12-Month Table */}
              <div className="sales-data-table-wrap">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th style={{ textAlign: 'center' }}>Order Count</th>
                      <th style={{ textAlign: 'center' }}>Refill Quantity (Cyl)</th>
                      <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                      <th style={{ textAlign: 'center' }}>Avg Daily Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthWiseReport.map((m) => (
                      <tr key={m.monthCode}>
                        <td><strong>{m.monthName}</strong></td>
                        <td style={{ textAlign: 'center' }}>{m.orderCount || '—'}</td>
                        <td style={{ textAlign: 'center' }}><strong>{m.refillQuantity || '—'}</strong></td>
                        <td style={{ textAlign: 'right' }}>
                          {m.salesValue > 0 ? `₹${m.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>{m.avgDaily ? `${m.avgDaily} Cyl` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td style={{ textAlign: 'center' }}>{monthWiseReport.reduce((s, m) => s + m.orderCount, 0)}</td>
                      <td style={{ textAlign: 'center' }}>{monthWiseReport.reduce((s, m) => s + m.refillQuantity, 0)}</td>
                      <td style={{ textAlign: 'right' }}>₹{monthWiseReport.reduce((s, m) => s + m.salesValue, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'center' }}>—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Month-vs-Month Comparison Card (Section 39.D) */}
              <div className="modern-comparison-panel">
                <h3 style={{ margin: '0 0 10px', fontSize: '15px', color: '#0f3756' }}>
                  ⚖️ Month Comparison (Growth &amp; Trend)
                </h3>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <div className="upload-select-group">
                    <label>Base Month (A)</label>
                    <select value={compMonthA} onChange={(e) => setCompMonthA(e.target.value)}>
                      {FY_MONTHS.map((m) => (
                        <option key={m.monthCode} value={m.monthCode}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#64748b', marginTop: '16px' }}>VS</div>
                  <div className="upload-select-group">
                    <label>Comparison Month (B)</label>
                    <select value={compMonthB} onChange={(e) => setCompMonthB(e.target.value)}>
                      {FY_MONTHS.map((m) => (
                        <option key={m.monthCode} value={m.monthCode}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="sales-kpi-summary-grid">
                  <div className="sales-kpi-summary-card">
                    <span>{monthComparison.monthAName} Qty</span>
                    <strong>{monthComparison.dataA.refillQuantity} Cyl</strong>
                  </div>
                  <div className="sales-kpi-summary-card">
                    <span>{monthComparison.monthBName} Qty</span>
                    <strong>{monthComparison.dataB.refillQuantity} Cyl</strong>
                  </div>
                  <div className="sales-kpi-summary-card sales-kpi-summary-card--green">
                    <span>Volume Growth</span>
                    <strong style={{ color: monthComparison.qtyDiff >= 0 ? '#15803d' : '#b91c1c' }}>
                      {monthComparison.qtyDiff >= 0 ? `+${monthComparison.qtyDiff}` : monthComparison.qtyDiff} Cyl ({monthComparison.qtyGrowth}%)
                    </strong>
                  </div>
                  <div className="sales-kpi-summary-card sales-kpi-summary-card--amber">
                    <span>Revenue Growth</span>
                    <strong style={{ color: monthComparison.revDiff >= 0 ? '#15803d' : '#b91c1c' }}>
                      ₹{monthComparison.revDiff.toLocaleString('en-IN')} ({monthComparison.revGrowth}%)
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 4: FY WISE SALES REPORT                */}
          {/* ========================================== */}
          {activeTab === 'fyWise' && (
            <div className="sales-card modern-report-card modern-report-card--fy">
              <div className="sales-card-header">
                <div>
                  <h2>🗓️ Financial Year (FY) Wise Sales Report</h2>
                  <p>Multi-year financial year sales breakdown, volume, and yearly comparisons (April – March)</p>
                </div>
                <button
                  type="button"
                  className="sales-report-btn"
                  style={{ background: '#10b981', color: '#fff' }}
                  onClick={() => {
                    const headers = ['Financial Year', 'Order Count', 'Refill Quantity', 'Sales Value (Rs)', 'Avg Monthly Sales'];
                    const rows = fyWiseReport.map((f) => [`FY ${f.fy}`, f.orderCount, f.refillQuantity, f.salesValue.toFixed(2), f.avgMonthly]);
                    exportTableToExcel(headers, rows, 'Financial_Year_Sales_Report');
                  }}
                >
                  📥 Export Excel
                </button>
              </div>

              {/* Section Filter Toolbar: Month, Multi-Product & Reset */}
              <SectionFilterToolbar
                monthNo={filters.monthNo}
                selectedProducts={filters.selectedProducts || []}
                availableProducts={allAvailableProducts}
                onMonthChange={(m) => { setFilters((prev) => ({ ...prev, monthNo: m })); setAreaPage(1); }}
                onProductsChange={(prods) => { setFilters((prev) => ({ ...prev, selectedProducts: prods })); setAreaPage(1); }}
                onReset={() => { setFilters((prev) => ({ ...prev, monthNo: 'ALL', packageCode: 'ALL', selectedProducts: [] })); setAreaPage(1); }}
              />

              <div className="sales-data-table-wrap">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Financial Year</th>
                      <th style={{ textAlign: 'center' }}>Order Count</th>
                      <th style={{ textAlign: 'center' }}>Refill Quantity (Cylinders)</th>
                      <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                      <th style={{ textAlign: 'center' }}>Average Monthly Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fyWiseReport.length > 0 ? (
                      fyWiseReport.map((f) => (
                        <tr key={f.fy}>
                          <td><strong>FY {f.fy}</strong></td>
                          <td style={{ textAlign: 'center' }}>{f.orderCount}</td>
                          <td style={{ textAlign: 'center' }}><strong>{f.refillQuantity}</strong></td>
                          <td style={{ textAlign: 'right' }}>₹{f.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'center' }}>{f.avgMonthly} Cyl/Month</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '30px' }}>
                          No FY sales records available for current filter selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {fyWiseReport.length > 0 && (
                    <tfoot>
                      <tr>
                        <td>Total Across FYs</td>
                        <td style={{ textAlign: 'center' }}>{fyWiseReport.reduce((s, f) => s + f.orderCount, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{fyWiseReport.reduce((s, f) => s + f.refillQuantity, 0)}</td>
                        <td style={{ textAlign: 'right' }}>₹{fyWiseReport.reduce((s, f) => s + f.salesValue, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'center' }}>—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {activeTab === 'advanceReports' && (
            <div className="sales-card advanced-report-page">
              <div className="sales-card-header">
                <div>
                  <h2>🚀 Advance Reports</h2>
                  <p>15 actionable operational, consumer, payment, delivery and management reports</p>
                </div>
              </div>
              <SectionFilterToolbar
                monthNo={filters.monthNo}
                selectedProducts={filters.selectedProducts || []}
                availableProducts={allAvailableProducts}
                onMonthChange={(monthNo) => setFilters((prev) => ({ ...prev, monthNo }))}
                onProductsChange={(selectedProducts) => setFilters((prev) => ({ ...prev, selectedProducts }))}
                onReset={() => setFilters((prev) => ({
                  ...prev,
                  monthNo: String(new Date().getMonth() + 1).padStart(2, '0'),
                  packageCode: 'ALL',
                  selectedProducts: [...DEFAULT_DAC_PRODUCTS],
                }))}
              />
              <div className="advanced-report-intro">
                <strong>{filteredTransactions.length.toLocaleString()} transactions analyzed</strong>
                <span>Reports selected month aur product filters ke according automatically update hote hain.</span>
              </div>
              <div className="advanced-report-grid">
                {advancedReports.map((report, index) => (
                  <article className="advanced-report-card" key={report.title}>
                    <header><span>{report.icon}</span><b>REPORT {String(index + 1).padStart(2, '0')}</b></header>
                    <h3>{report.title}</h3>
                    <strong className="advanced-report-card__metric">{report.metric}</strong>
                    <p>{report.note}</p>
                    <div className="advanced-report-card__list">
                      {report.items.length ? report.items.slice(0, 3).map((item, itemIndex) => (
                        <div key={`${item.label}-${itemIndex}`}><span>{item.label}</span><strong>{item.value}</strong></div>
                      )) : <small>No matching records available.</small>}
                    </div>
                    <button type="button" className="advanced-report-card__open" onClick={() => { setSelectedAdvancedReport(index); setAdvancedDetailPage(1); }}>
                      View Detailed Report →
                    </button>
                  </article>
                ))}
              </div>
              {selectedAdvancedReport !== null && advancedReports[selectedAdvancedReport] && (() => {
                const report = advancedReports[selectedAdvancedReport];
                const pageSize = 25;
                const pageCount = Math.max(1, Math.ceil(report.items.length / pageSize));
                const page = Math.min(advancedDetailPage, pageCount);
                const visibleItems = report.items.slice((page - 1) * pageSize, page * pageSize);
                return <div className="advanced-detail-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAdvancedReport(null); }}>
                  <section className="advanced-detail-panel" role="dialog" aria-modal="true" aria-labelledby="advanced-detail-title">
                    <header>
                      <div><span>{report.icon} DETAILED ADVANCE REPORT</span><h3 id="advanced-detail-title">{report.title}</h3><p>{report.metric} · {report.note}</p></div>
                      <button type="button" onClick={() => setSelectedAdvancedReport(null)} aria-label="Close detailed report">✕</button>
                    </header>
                    <div className="advanced-detail-summary"><strong>{report.items.length.toLocaleString()} detailed rows</strong><span>Current month/product filters applied</span></div>
                    <div className="advanced-detail-table-wrap">
                      <table><thead><tr><th>Rank</th><th>Details / Category</th><th>Result</th></tr></thead>
                        <tbody>{visibleItems.length ? visibleItems.map((item, itemIndex) => <tr key={`${item.label}-${itemIndex}`}><td>{(page - 1) * pageSize + itemIndex + 1}</td><td><strong>{item.label}</strong></td><td>{item.value}</td></tr>) : <tr><td colSpan={3}>No matching detailed records available.</td></tr>}</tbody>
                      </table>
                    </div>
                    <footer><span>Page {page} of {pageCount}</span><div><button type="button" disabled={page === 1} onClick={() => setAdvancedDetailPage((value) => Math.max(1, value - 1))}>‹ Previous</button><button type="button" disabled={page === pageCount} onClick={() => setAdvancedDetailPage((value) => Math.min(pageCount, value + 1))}>Next ›</button></div></footer>
                  </section>
                </div>;
              })()}
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: BREAKDOWN REPORTS (Section 39.F - 39.R) */}
          {/* ========================================== */}
          {activeTab === 'breakdowns' && (
            <div className="sales-card modern-report-card modern-report-card--breakdown modern-breakdown-card">
              <div className="sales-card-header">
                <div>
                  <h2>📑 Dimensional Breakdown Reports</h2>
                  <p>Detailed sales reports by Delivery Area, Staff, Package, Consumer Nature, Mode &amp; Cancellations</p>
                </div>
              </div>

              {/* Section Filter Toolbar: Month, Multi-Product & Reset */}
              <SectionFilterToolbar
                monthNo={filters.monthNo}
                selectedProducts={filters.selectedProducts || []}
                availableProducts={allAvailableProducts}
                onMonthChange={(m) => setFilters((prev) => ({ ...prev, monthNo: m }))}
                onProductsChange={(prods) => setFilters((prev) => ({ ...prev, selectedProducts: prods }))}
                onReset={() => setFilters((prev) => ({ ...prev, monthNo: 'ALL', packageCode: 'ALL', selectedProducts: [] }))}
              />

              {/* Sub-navigation Pills */}
              <div className="breakdown-subnav">
                <button
                  type="button"
                  className={`breakdown-pill-btn ${breakdownTab === 'area' ? 'active' : ''}`}
                  onClick={() => setBreakdownTab('area')}
                >
                  📍 Delivery Area
                </button>
                <button
                  type="button"
                  className={`breakdown-pill-btn ${breakdownTab === 'staff' ? 'active' : ''}`}
                  onClick={() => setBreakdownTab('staff')}
                >
                  🛵 Delivery Staff
                </button>
                <button
                  type="button"
                  className={`breakdown-pill-btn ${breakdownTab === 'package' ? 'active' : ''}`}
                  onClick={() => setBreakdownTab('package')}
                >
                  📦 Package Code
                </button>
                <button
                  type="button"
                  className={`breakdown-pill-btn ${breakdownTab === 'nature' ? 'active' : ''}`}
                  onClick={() => setBreakdownTab('nature')}
                >
                  👥 Consumer Nature &amp; Type
                </button>
                <button
                  type="button"
                  className={`breakdown-pill-btn ${breakdownTab === 'source' ? 'active' : ''}`}
                  onClick={() => setBreakdownTab('source')}
                >
                  📱 Order Source &amp; Mode
                </button>
                <button
                  type="button"
                  className={`breakdown-pill-btn ${breakdownTab === 'ekyc' ? 'active' : ''}`}
                  onClick={() => setBreakdownTab('ekyc')}
                >
                  🪪 eKYC &amp; Mobile Reg
                </button>
                <button
                  type="button"
                  className={`breakdown-pill-btn ${breakdownTab === 'cancellation' ? 'active' : ''}`}
                  onClick={() => setBreakdownTab('cancellation')}
                >
                  ❌ Cancellation Report
                </button>
              </div>

              {/* Sub-tab 1: Delivery Area */}
              {breakdownTab === 'area' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f3756' }}>
                      Delivery Area-wise Report ({dimensionalReports.areas.length} Areas)
                    </h3>
                    <button
                      type="button"
                      className="sales-report-btn"
                      style={{ background: '#10b981', color: '#fff', fontSize: '11px', padding: '5px 10px' }}
                      onClick={() => {
                        const headers = ['Delivery Area', 'Orders', 'Refill Quantity', 'Sales Value (Rs)', 'Share %'];
                        const rows = dimensionalReports.areas.map((a) => [a.area, a.orders, a.refillQuantity, a.salesValue.toFixed(2), `${a.share}%`]);
                        exportTableToExcel(headers, rows, 'Delivery_Area_Sales_Report');
                      }}
                    >
                      📥 Export Excel
                    </button>
                  </div>
                  <div className="sales-data-table-wrap">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>Sr</th>
                          <th>Delivery Area</th>
                          <th style={{ textAlign: 'center' }}>Orders</th>
                          <th style={{ textAlign: 'center' }}>Refill Quantity (Cyl)</th>
                          <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                          <th style={{ textAlign: 'center' }}>Share %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAreas.map((a, i) => (
                          <tr key={a.area}>
                            <td>{(safeAreaPage - 1) * areasPerPage + i + 1}</td>
                            <td><strong>{a.area}</strong></td>
                            <td style={{ textAlign: 'center' }}>{a.orders}</td>
                            <td style={{ textAlign: 'center' }}><strong>{a.refillQuantity}</strong></td>
                            <td style={{ textAlign: 'right' }}>₹{a.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ textAlign: 'center' }}>{a.share}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="sales-pagination-wrap area-report-pagination">
                    <div className="area-report-pagination__summary">
                      <label>Areas per page:
                        <select value={areasPerPage} onChange={(event) => { setAreasPerPage(Number(event.target.value)); setAreaPage(1); }}>
                          <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                        </select>
                      </label>
                      <span>Showing {dimensionalReports.areas.length ? (safeAreaPage - 1) * areasPerPage + 1 : 0}–{Math.min(safeAreaPage * areasPerPage, dimensionalReports.areas.length)} of {dimensionalReports.areas.length} areas</span>
                    </div>
                    {areaTotalPages > 1 && <div className="sales-pagination-controls">
                      <button type="button" className="sales-page-btn" disabled={safeAreaPage === 1} onClick={() => setAreaPage(1)}>« First</button>
                      <button type="button" className="sales-page-btn" disabled={safeAreaPage === 1} onClick={() => setAreaPage((page) => Math.max(1, page - 1))}>‹ Prev</button>
                      <span>Page <strong>{safeAreaPage}</strong> of {areaTotalPages}</span>
                      <button type="button" className="sales-page-btn" disabled={safeAreaPage === areaTotalPages} onClick={() => setAreaPage((page) => Math.min(areaTotalPages, page + 1))}>Next ›</button>
                      <button type="button" className="sales-page-btn" disabled={safeAreaPage === areaTotalPages} onClick={() => setAreaPage(areaTotalPages)}>Last »</button>
                    </div>}
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Delivery Staff */}
              {breakdownTab === 'staff' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f3756' }}>
                      Delivery Staff / Man Performance Report ({dimensionalReports.staffList.length} Staff)
                    </h3>
                    <button
                      type="button"
                      className="sales-report-btn"
                      style={{ background: '#10b981', color: '#fff', fontSize: '11px', padding: '5px 10px' }}
                      onClick={() => {
                        const headers = ['Delivery Man', 'Orders', 'Refill Quantity', 'Sales Value (Rs)', 'DAC %'];
                        const rows = dimensionalReports.staffList.map((s) => [s.staff, s.orders, s.refillQuantity, s.salesValue.toFixed(2), `${s.dacPct}%`]);
                        exportTableToExcel(headers, rows, 'Delivery_Staff_Sales_Report');
                      }}
                    >
                      📥 Export Excel
                    </button>
                  </div>
                  <div className="sales-data-table-wrap">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>Sr</th>
                          <th>Delivery Man</th>
                          <th style={{ textAlign: 'center' }}>Orders</th>
                          <th style={{ textAlign: 'center' }}>Refill Quantity (Cyl)</th>
                          <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                          <th style={{ textAlign: 'center' }}>DAC %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dimensionalReports.staffList.map((s, i) => (
                          <tr key={s.staff}>
                            <td>{i + 1}</td>
                            <td><strong>{s.staff}</strong></td>
                            <td style={{ textAlign: 'center' }}>{s.orders}</td>
                            <td style={{ textAlign: 'center' }}><strong>{s.refillQuantity}</strong></td>
                            <td style={{ textAlign: 'right' }}>₹{s.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: '700', color: parseFloat(s.dacPct) >= 95 ? '#15803d' : '#b45309' }}>
                                {s.dacPct}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Package Code */}
              {breakdownTab === 'package' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f3756' }}>
                      Package Code &amp; Product Sales Report
                    </h3>
                    <button
                      type="button"
                      className="sales-report-btn"
                      style={{ background: '#10b981', color: '#fff', fontSize: '11px', padding: '5px 10px' }}
                      onClick={() => {
                        const headers = ['Package Code', 'Category', 'Orders', 'Refill Quantity', 'Sales Value (Rs)', 'Share %'];
                        const rows = dimensionalReports.packages.map((p) => [p.packageCode, p.category, p.orders, p.refillQuantity, p.salesValue.toFixed(2), `${p.share}%`]);
                        exportTableToExcel(headers, rows, 'Package_Sales_Report');
                      }}
                    >
                      📥 Export Excel
                    </button>
                  </div>
                  <div className="sales-data-table-wrap">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>Sr</th>
                          <th>Package Code / Product</th>
                          <th>Category</th>
                          <th style={{ textAlign: 'center' }}>Orders</th>
                          <th style={{ textAlign: 'center' }}>Refill Quantity (Cyl)</th>
                          <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                          <th style={{ textAlign: 'center' }}>Share %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dimensionalReports.packages.map((p, i) => (
                          <tr key={p.packageCode}>
                            <td>{i + 1}</td>
                            <td><strong>{p.packageCode}</strong></td>
                            <td>{p.category}</td>
                            <td style={{ textAlign: 'center' }}>{p.orders}</td>
                            <td style={{ textAlign: 'center' }}><strong>{p.refillQuantity}</strong></td>
                            <td style={{ textAlign: 'right' }}>₹{p.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ textAlign: 'center' }}>{p.share}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 4: Consumer Nature & Type */}
              {breakdownTab === 'nature' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f3756' }}>
                      Consumer Nature (Ujjwala / Domestic) &amp; Connection Type (SBC / DBC) Report
                    </h3>
                    <button
                      type="button"
                      className="sales-report-btn"
                      style={{ background: '#10b981', color: '#fff', fontSize: '11px', padding: '5px 10px' }}
                      onClick={() => {
                        const headers = ['Nature of Consumer', 'SBC Orders', 'DBC Orders', 'Total Orders', 'Refill Quantity', 'Sales Value (Rs)'];
                        const rows = dimensionalReports.natures.map((n) => [n.nature, n.sbcOrders, n.dbcOrders, n.orders, n.refillQuantity, n.salesValue.toFixed(2)]);
                        exportTableToExcel(headers, rows, 'Consumer_Nature_Sales_Report');
                      }}
                    >
                      📥 Export Excel
                    </button>
                  </div>
                  <div className="sales-data-table-wrap">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>Nature of Consumer</th>
                          <th style={{ textAlign: 'center' }}>SBC Orders</th>
                          <th style={{ textAlign: 'center' }}>DBC Orders</th>
                          <th style={{ textAlign: 'center' }}>Total Orders</th>
                          <th style={{ textAlign: 'center' }}>Refill Quantity (Cyl)</th>
                          <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dimensionalReports.natures.map((n) => (
                          <tr key={n.nature}>
                            <td><strong>{n.nature}</strong></td>
                            <td style={{ textAlign: 'center' }}>{n.sbcOrders}</td>
                            <td style={{ textAlign: 'center' }}>{n.dbcOrders}</td>
                            <td style={{ textAlign: 'center' }}><strong>{n.orders}</strong></td>
                            <td style={{ textAlign: 'center' }}><strong>{n.refillQuantity}</strong></td>
                            <td style={{ textAlign: 'right' }}>₹{n.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 5: Order Source & Mode */}
              {breakdownTab === 'source' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f3756' }}>
                      Order Source (IVRS / HP Pay) &amp; Delivery Mode (Home / Instant) Report
                    </h3>
                    <button
                      type="button"
                      className="sales-report-btn"
                      style={{ background: '#10b981', color: '#fff', fontSize: '11px', padding: '5px 10px' }}
                      onClick={() => {
                        const headers = ['Order Source', 'Home Orders', 'Instant Orders', 'Total Orders', 'Refill Quantity', 'Sales Value (Rs)'];
                        const rows = dimensionalReports.sources.map((s) => [s.source, s.homeOrders, s.instantOrders, s.orders, s.refillQuantity, s.salesValue.toFixed(2)]);
                        exportTableToExcel(headers, rows, 'Order_Source_Sales_Report');
                      }}
                    >
                      📥 Export Excel
                    </button>
                  </div>
                  <div className="sales-data-table-wrap">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>Order Source</th>
                          <th style={{ textAlign: 'center' }}>Home Delivery</th>
                          <th style={{ textAlign: 'center' }}>Instant / Counter</th>
                          <th style={{ textAlign: 'center' }}>Total Orders</th>
                          <th style={{ textAlign: 'center' }}>Refill Quantity (Cyl)</th>
                          <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dimensionalReports.sources.map((s) => (
                          <tr key={s.source}>
                            <td><strong>{s.source}</strong></td>
                            <td style={{ textAlign: 'center' }}>{s.homeOrders}</td>
                            <td style={{ textAlign: 'center' }}><button type="button" className="dac-delivery-count-btn" disabled={!s.instantOrders} onClick={() => setDeliveryDrilldown({ deliveryman: `${s.source} · Instant / Counter`, scope: 'Order Source & Delivery Mode', label: 'Instant / Counter', count: s.instantOrders, rows: s.instantDetails || [] })}>{s.instantOrders}</button></td>
                            <td style={{ textAlign: 'center' }}><strong>{s.orders}</strong></td>
                            <td style={{ textAlign: 'center' }}><strong>{s.refillQuantity}</strong></td>
                            <td style={{ textAlign: 'right' }}>₹{s.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 6: eKYC & Mobile */}
              {breakdownTab === 'ekyc' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f3756' }}>
                      eKYC Compliance &amp; Registered Mobile Numbers
                    </h3>
                  </div>
                  <div className="sales-data-table-wrap">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>eKYC Status</th>
                          <th style={{ textAlign: 'center' }}>Registered Mobile (Y)</th>
                          <th style={{ textAlign: 'center' }}>Unregistered Mobile (N)</th>
                          <th style={{ textAlign: 'center' }}>Total Orders</th>
                          <th style={{ textAlign: 'center' }}>Refill Quantity (Cyl)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dimensionalReports.ekycs.map((k) => (
                          <tr key={k.ekycStatus}>
                            <td><strong>{k.ekycStatus}</strong></td>
                            <td style={{ textAlign: 'center' }}><button type="button" className="dac-delivery-count-btn" disabled={!k.regMobile} onClick={() => setDeliveryDrilldown({ deliveryman: `${k.ekycStatus} · Registered Mobile`, scope: 'eKYC Compliance', label: 'Registered Mobile (Y)', count: k.regMobile, rows: (k.details || []).filter((row) => String(row.isRegMobile || '').trim().toUpperCase() === 'Y') })}>{k.regMobile}</button></td>
                            <td style={{ textAlign: 'center' }}><button type="button" className="dac-delivery-count-btn" disabled={!k.nonRegMobile} onClick={() => setDeliveryDrilldown({ deliveryman: `${k.ekycStatus} · Unregistered Mobile`, scope: 'eKYC Compliance', label: 'Unregistered Mobile (N)', count: k.nonRegMobile, rows: (k.details || []).filter((row) => String(row.isRegMobile || '').trim().toUpperCase() !== 'Y') })}>{k.nonRegMobile}</button></td>
                            <td style={{ textAlign: 'center' }}><strong>{k.orders}</strong></td>
                            <td style={{ textAlign: 'center' }}><button type="button" className="dac-delivery-count-btn" disabled={!k.refillQuantity} onClick={() => setDeliveryDrilldown({ deliveryman: k.ekycStatus, scope: 'eKYC Compliance', label: 'Refill Quantity (Cyl)', count: k.refillQuantity, rows: k.details || [] })}>{k.refillQuantity}</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 7: Cancellation Report (Section 39.R) */}
              {breakdownTab === 'cancellation' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#0f3756' }}>
                        Refill Order &amp; CashMemo Cancellation Report ({dimensionalReports.cancellations.length} Cancelled)
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                        Records flagged with Cancelled order status, cash memo cancel date, or cancellation reasons
                      </p>
                    </div>
                    {dimensionalReports.cancellations.length > 0 && (
                      <button
                        type="button"
                        className="sales-report-btn"
                        style={{ background: '#b91c1c', color: '#fff', fontSize: '11px', padding: '5px 10px' }}
                        onClick={() => {
                          const headers = ['Order No', 'CashMemo No', 'Consumer Name', 'Cancel Date', 'Status', 'Cancellation Reason', 'Qty'];
                          const rows = dimensionalReports.cancellations.map((c) => [
                            c.orderNo, c.cashMemoNo, c.consumerName, c.cashMemoCancelDate || c.salesDate, c.orderStatus, c.cancellationReason || 'N/A', c.orderQuantity
                          ]);
                          exportTableToExcel(headers, rows, 'Cancellation_Report');
                        }}
                      >
                        📥 Export Excel
                      </button>
                    )}
                  </div>

                  <div className="sales-data-table-wrap">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>Sr</th>
                          <th>Order No</th>
                          <th>CashMemo No</th>
                          <th>Consumer Name</th>
                          <th>Cancel Date</th>
                          <th>Status</th>
                          <th>Cancellation Reason</th>
                          <th style={{ textAlign: 'center' }}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dimensionalReports.cancellations.length > 0 ? (
                          dimensionalReports.cancellations.map((c, i) => (
                            <tr key={c.id || i}>
                              <td>{i + 1}</td>
                              <td>{c.orderNo}</td>
                              <td><strong>{c.cashMemoNo}</strong></td>
                              <td>{c.consumerName}</td>
                              <td>{c.cashMemoCancelDate || c.salesDate}</td>
                              <td>
                                <span style={{ padding: '2px 6px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', background: '#fee2e2', color: '#b91c1c' }}>
                                  {c.orderStatus || 'Cancelled'}
                                </span>
                              </td>
                              <td>{c.cancellationReason || 'Not Specified'}</td>
                              <td style={{ textAlign: 'center' }}>{c.orderQuantity}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#15803d', fontWeight: '700' }}>
                              ✅ No cancelled orders or cash memos found in current filter range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: UPLOADS                               */}
          {/* ========================================== */}
          {activeTab === 'upload' && (
            <div className="sales-card">
              <div className="sales-card-header">
                <div>
                  <h2>📤 Month-wise Sales Data Uploads</h2>
                  <p>Select calendar year, inspect upload status, confirm month data, and upload refill sales dumps</p>
                </div>
                {/* Year Dropdown Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: '#0f3756', textTransform: 'uppercase' }}>
                    Select Year:
                  </label>
                  <select
                    value={uploadYear}
                    onChange={(e) => setUploadYear(Number(e.target.value))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#0f3756',
                      background: '#ffffff',
                    }}
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!uploadEnabled && (
                <div className="upload-status-banner upload-status-banner--disabled" style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <strong>⚠️ Uploads Currently Disabled in Settings</strong>
                  <span style={{ display: 'block', fontSize: '12px', marginTop: '2px' }}>
                    Non-admin users cannot upload new files while uploads are turned off in Settings.
                  </span>
                </div>
              )}

              {/* Current Month Quick Action Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #0e7490, #0284c7)',
                color: '#ffffff',
                padding: '18px 22px',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '22px',
                boxShadow: '0 4px 16px rgba(14, 116, 144, 0.2)',
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.9 }}>
                    ⚡ Current Month Fast Track
                  </div>
                  <strong style={{ fontSize: '17px', display: 'block', marginTop: '2px' }}>
                    Upload {currentMonthName} {currentYear} Sales Data
                  </strong>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    Import today's or month-end refill dump directly with instant duplicate validation.
                  </span>
                </div>
                <button
                  type="button"
                  className="sales-report-btn"
                  style={{ background: '#fbbf24', color: '#1e1b4b', fontWeight: '800', padding: '10px 18px' }}
                  onClick={() => openImportModal('monthWise', currentYear, currentMonthCode)}
                >
                  🚀 Upload {currentMonthName} {currentYear} Now
                </button>
              </div>

              {/* 12-Month Cards Grid */}
              <h3 style={{ fontSize: '15px', color: '#0f3756', margin: '0 0 10px' }}>
                📅 {uploadYear} Monthly Upload Status &amp; Confirmations
              </h3>
              <div className="month-cards-grid">
                {FY_MONTHS.map((m) => {
                  const mCode = m.monthCode;
                  const mName = m.name;
                  const ymKey = `${uploadYear}-${mCode}`;
                  const monthData = storeData.monthlyUploads?.[ymKey];
                  const now = new Date();
                  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  const isCurrentMonth = ymKey === currentYm;
                  const isLocked = !isCurrentMonth && !!(lockedMonths[ymKey]?.confirmed || monthData?.confirmed);
                  const canReupload = !isLocked;
                  const hasData = !!(monthData && (monthData.summary?.totalRows > 0 || (monthData.rows && monthData.rows.length > 0)));

                  return (
                    <div
                      key={ymKey}
                      className={`month-card ${isLocked ? 'locked' : ''} ${hasData ? 'has-data' : ''}`}
                    >
                      <div className="month-card__header">
                        <h4>{mName} {uploadYear}</h4>
                        {isLocked ? (
                          <span className="month-badge month-badge--confirmed" title="Locked: re-upload requires Admin approval">
                            🔒 Confirmed
                          </span>
                        ) : hasData ? (
                          <span className="month-badge month-badge--uploaded">
                            ✅ Uploaded
                          </span>
                        ) : (
                          <span className="month-badge month-badge--pending">
                            ⏳ No Data
                          </span>
                        )}
                      </div>

                      {hasData ? (
                        <div className="month-card__stats">
                          <div>
                            <span>Cylinders:</span>
                            <strong>{monthData.summary?.totalCylinders || monthData.rows?.length || 0}</strong>
                          </div>
                          <div>
                            <span>DAC %:</span>
                            <strong style={{ color: (monthData.summary?.dacPercent || 0) >= 95 ? '#15803d' : '#b45309' }}>
                              {monthData.summary?.dacPercent || 0}%
                            </strong>
                          </div>
                          <div>
                            <span>Orders:</span>
                            <strong>{monthData.summary?.totalRows || monthData.rows?.length || 0}</strong>
                          </div>
                          <div>
                            <span>File:</span>
                            <strong style={{ fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={monthData.fileName}>
                              {monthData.fileName || 'Data Loaded'}
                            </strong>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '14px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                          No sales data uploaded for {mName}.
                        </div>
                      )}

                      <div className="month-card__actions">
                        <button
                          type="button"
                          className="sales-report-btn"
                          style={{
                            flex: 1,
                            fontSize: '11px',
                            padding: '6px 8px',
                            background: !canReupload ? '#e2e8f0' : '#0284c7',
                            color: !canReupload ? '#94a3b8' : '#ffffff',
                            cursor: !canReupload ? 'not-allowed' : 'pointer',
                          }}
                          disabled={!canReupload}
                          onClick={() => openImportModal('monthWise', uploadYear, mCode)}
                          title={!canReupload ? 'Month is locked. Admin approval required to re-upload.' : 'Upload / Replace Sales Excel'}
                        >
                          📤 {hasData ? 'Re-upload' : 'Upload'}
                        </button>

                        {hasData && !isLocked && !isCurrentMonth && (
                          <button
                            type="button"
                            className="sales-report-btn"
                            style={{ fontSize: '11px', padding: '6px 8px', background: '#10b981', color: '#fff' }}
                            onClick={() => handleConfirmMonth(ymKey)}
                            title="Confirm and lock month against accidental overwrites"
                          >
                            🔒 Confirm
                          </button>
                        )}

                        {hasData && (
                          <button
                            type="button"
                            className="sales-report-btn"
                            style={{ fontSize: '11px', padding: '6px 8px', background: '#f1f5f9', color: '#0f3756' }}
                            onClick={() => {
                              setFilters((prev) => ({ ...prev, monthNo: mCode }));
                              setActiveTab('detailed');
                            }}
                            title="View all records for this month in Detailed View"
                          >
                            👀 View
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Financial Year Bulk Upload Card */}
              <div style={{ marginTop: '28px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f3756' }}>
                      🗓️ Financial Year (FY) Wise Bulk Upload
                    </h3>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                      Upload complete year dumps (April to March). Existing monthly uploads are protected against duplicate counting.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="sales-report-btn"
                    style={{ background: '#8b5cf6', color: '#ffffff' }}
                    onClick={() => openImportModal('fyWise', uploadYear, '09')}
                  >
                    📁 Upload FY-wise Spreadsheet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 6: IMPORT HISTORY                      */}
          {/* ========================================== */}
          {activeTab === 'history' && (
            <div className="sales-card">
              <div className="sales-card-header">
                <div>
                  <h2>🗃️ Import Batches History</h2>
                  <p>Audit trail of all uploaded files with imported rows, duplicate counts, and rollback options</p>
                </div>
              </div>

              <div className="sales-data-table-wrap">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Sr</th>
                      <th>File Name</th>
                      <th>Upload Type</th>
                      <th>Period</th>
                      <th>Uploaded Date</th>
                      <th style={{ textAlign: 'center' }}>Total Rows</th>
                      <th style={{ textAlign: 'center' }}>Imported</th>
                      <th style={{ textAlign: 'center' }}>Duplicates</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      {isAdmin && <th style={{ textAlign: 'center' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {batches.length > 0 ? (
                      batches.map((b, idx) => (
                        <tr key={b.batchId || idx}>
                          <td>{idx + 1}</td>
                          <td><strong>{b.fileName}</strong></td>
                          <td>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: b.uploadType === 'fyWise' ? '#f3e8ff' : '#e0f2fe',
                              color: b.uploadType === 'fyWise' ? '#7e22ce' : '#0369a1',
                            }}>
                              {b.uploadType === 'fyWise' ? 'Financial Year' : 'Month Wise'}
                            </span>
                          </td>
                          <td>{b.fy ? `FY ${b.fy}` : ''} {b.month ? `(${MONTH_NAMES[parseInt(b.month, 10) - 1]})` : ''}</td>
                          <td>{new Date(b.uploadedAt || Date.now()).toLocaleString('en-IN')}</td>
                          <td style={{ textAlign: 'center' }}>{b.totalRows}</td>
                          <td style={{ textAlign: 'center', color: '#15803d', fontWeight: '700' }}>{b.importedRows}</td>
                          <td style={{ textAlign: 'center', color: '#b45309' }}>{b.duplicateRows || 0}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="month-badge month-badge--confirmed">
                              {b.status || 'Completed'}
                            </span>
                          </td>
                          {isAdmin && (
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="sales-report-btn sales-report-btn--danger"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => handleRollbackBatch(b.batchId)}
                              >
                                🗑️ Rollback
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: '30px' }}>
                          No import history recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 7: DETAILED SALES DATA                 */}
          {/* ========================================== */}
          {activeTab === 'detailed' && (
            <div className="sales-card modern-report-card modern-report-card--detailed detailed-sales-card">
              <div className="sales-card-header">
                <div>
                  <h2>📋 Detailed Sales Data ({detailedFiltered.length} records)</h2>
                  <p>Complete 31-column normalized LPG sales transaction ledger with multi-column search</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="sales-report-btn"
                    style={{ background: '#10b981', color: '#ffffff' }}
                    onClick={exportDetailedToExcel}
                  >
                    📥 Export Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    className="sales-report-btn"
                    style={{ background: '#0284c7', color: '#ffffff' }}
                    onClick={() => {
                      if (!detailedFiltered.length) return;
                      const headers = Object.keys(detailedFiltered[0]).filter((k) => typeof detailedFiltered[0][k] !== 'object');
                      const rows = detailedFiltered.map((row) => headers.map((h) => row[h]));
                      exportTableToCsv(headers, rows, `Sales_Export_${new Date().toISOString().slice(0, 10)}`);
                    }}
                  >
                    📥 Export CSV
                  </button>
                </div>
              </div>

              {/* Section Filter Toolbar: Month, Multi-Product & Reset */}
              <SectionFilterToolbar
                monthNo={filters.monthNo}
                selectedProducts={filters.selectedProducts || []}
                availableProducts={allAvailableProducts}
                onMonthChange={(m) => {
                  setFilters((prev) => ({ ...prev, monthNo: m }));
                  setDetailPage(1);
                }}
                onProductsChange={(prods) => {
                  setFilters((prev) => ({ ...prev, selectedProducts: prods }));
                  setDetailPage(1);
                }}
                onReset={() => {
                  setFilters((prev) => ({
                    ...prev,
                    monthNo: String(new Date().getMonth() + 1).padStart(2, '0'),
                    packageCode: 'ALL',
                    selectedProducts: [],
                  }));
                  setDetailSearch('');
                  setDetailPage(1);
                }}
                extraBadge={detailSearch ? `Search: "${detailSearch.slice(0, 16)}"` : ''}
              />

              {/* Live Search Input */}
              <div className="detailed-sales-search">
                <span className="detailed-sales-search__icon" aria-hidden="true">⌕</span>
                <div className="detailed-sales-search__field">
                  <input
                    type="search"
                    aria-label="Search detailed sales data"
                    autoComplete="off"
                    placeholder="Name, consumer no, cash memo, mobile, staff, area..."
                    value={detailSearch}
                    onChange={(e) => {
                      setDetailSearch(e.target.value);
                      setDetailPage(1);
                    }}
                  />
                  <small>Name, number aur area ko saath mein bhi search kar sakte hain</small>
                </div>
                {detailSearch && (
                  <button
                    type="button"
                    className="detailed-sales-search__clear"
                    onClick={() => {
                      setDetailSearch('');
                      setDetailPage(1);
                    }}
                    aria-label="Clear detailed sales search"
                  >
                    Clear
                  </button>
                )}
                <span className="detailed-sales-search__count" role="status" aria-live="polite">
                  {deferredDetailSearch !== detailSearch ? 'Searching…' : `${detailedFiltered.length} result${detailedFiltered.length === 1 ? '' : 's'}`}
                </span>
              </div>

              {/* Data Table */}
              <div className="sales-data-table-wrap">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Sr</th>
                      <th>Order No</th>
                      <th>CashMemo No</th>
                      <th>Consumer No</th>
                      <th>Consumer Name</th>
                      <th>Sales Date</th>
                      <th>Package Code / Product</th>
                      <th>Nature of Consumer</th>
                      <th>Delivery Man</th>
                      <th>Delivery Area</th>
                      <th style={{ textAlign: 'center' }}>DAC TYPE</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>RSP (₹)</th>
                      <th style={{ textAlign: 'right' }}>Sales Value (₹)</th>
                      <th>Payment</th>
                      <th>Mobile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDetailRows.length > 0 ? (
                      paginatedDetailRows.map((r, i) => (
                        <tr key={r.id || r.uniqueKey || i}>
                          <td>{(detailPage - 1) * detailRowsPerPage + i + 1}</td>
                          <td>{r.orderNo}</td>
                          <td><strong>{r.cashMemoNo}</strong></td>
                          <td>{r.consumerNo}</td>
                          <td><strong>{r.consumerName}</strong></td>
                          <td>{r.salesDate || r.actualDeliveryDate}</td>
                          <td>
                            <span style={{ fontSize: '11.5px', color: '#1e293b' }}>
                              {r.packageCode}
                            </span>
                          </td>
                          <td><small>{r.natureOfConsumer}</small></td>
                          <td>{r.deliveryStaff}</td>
                          <td><small>{r.deliveryArea}</small></td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: r.dacVerified ? '#dcfce7' : '#fef3c7',
                              color: r.dacVerified ? '#15803d' : '#b45309',
                            }}>
                              {r.dacType || (r.dacVerified ? 'OTP/DAC' : 'CDCMS')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}><strong>{r.orderQuantity}</strong></td>
                          <td style={{ textAlign: 'right' }}>₹{r.rsp}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>₹{r.salesValue?.toFixed(2)}</td>
                          <td>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              color: r.paymentMode === 'Online Paid' ? '#059669' : '#d97706',
                            }}>
                              {r.paymentMode}
                            </span>
                          </td>
                          <td><small>{r.mobileNo}</small></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={16} style={{ textAlign: 'center', padding: '30px' }}>
                          No records match current filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="sales-pagination-wrap">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Rows per page:</label>
                  <select
                    value={detailRowsPerPage}
                    onChange={(e) => {
                      setDetailRowsPerPage(Number(e.target.value));
                      setDetailPage(1);
                    }}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={0}>All</option>
                  </select>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Showing {detailedFiltered.length ? (detailPage - 1) * (detailRowsPerPage || detailedFiltered.length) + 1 : 0} to {Math.min(detailPage * detailRowsPerPage || detailedFiltered.length, detailedFiltered.length)} of {detailedFiltered.length} records
                  </span>
                </div>

                {detailRowsPerPage > 0 && totalDetailPages > 1 && (
                  <div className="sales-pagination-controls">
                    <button
                      type="button"
                      className="sales-page-btn"
                      disabled={detailPage <= 1}
                      onClick={() => setDetailPage(1)}
                    >
                      « First
                    </button>
                    <button
                      type="button"
                      className="sales-page-btn"
                      disabled={detailPage <= 1}
                      onClick={() => setDetailPage((p) => Math.max(p - 1, 1))}
                    >
                      ‹ Prev
                    </button>
                    <span style={{ fontSize: '12px', padding: '0 8px', fontWeight: '700' }}>
                      Page {detailPage} of {totalDetailPages}
                    </span>
                    <button
                      type="button"
                      className="sales-page-btn"
                      disabled={detailPage >= totalDetailPages}
                      onClick={() => setDetailPage((p) => Math.min(p + 1, totalDetailPages))}
                    >
                      Next ›
                    </button>
                    <button
                      type="button"
                      className="sales-page-btn"
                      disabled={detailPage >= totalDetailPages}
                      onClick={() => setDetailPage(totalDetailPages)}
                    >
                      Last »
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB: SETTINGS                              */}
          {/* ========================================== */}
          {activeTab === 'settings' && (
            <div className="sales-card">
              <div className="sales-card-header">
                <div>
                  <h2>⚙️ Sales Report Settings &amp; Access Controls</h2>
                  <p>Manage upload permissions, configure product types, and control month confirmation locks</p>
                </div>
              </div>

              {/* Setting 1: Upload Enable/Disable & Date Preference */}
              <div className="settings-section-card">
                <h3>📤 Upload Permissions &amp; Calculation Rules</h3>
                <p>Configure whether operators can import sales data and specify default calculation dates.</p>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <strong>Enable Sales Data Upload</strong>
                    <span>When disabled, staff cannot upload new spreadsheets.</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={uploadEnabled}
                      disabled={savingUploadToggle}
                      onChange={(e) => handleToggleUpload(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <strong>Default Sales Date Basis</strong>
                    <span>Transaction grouping date preference for reports and charts.</span>
                  </div>
                  <select
                    value={salesDateBasis}
                    onChange={(e) => handleSalesDateBasisChange(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700' }}
                  >
                    <option value="actualDeliveryDate">Actual Delivery Date (Recommended)</option>
                    <option value="cashMemoDate">CashMemo Date</option>
                    <option value="orderDate">Order Date</option>
                  </select>
                </div>
              </div>

              {/* Setting 2: Product Types Enable / Disable */}
              <div className="settings-section-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>📦 Package &amp; Product Type Enable / Disable</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Product Name aur Default Rate (₹) uploaded current month data se dynamically fetch hote hain (<strong>Default Rate = Sales Value / Refill Quantity</strong>). Kisi bhi cylinder type ko enable/disable karein ya default rate customize karein.
                    </p>
                  </div>

                  {/* Month Data Source Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#0f3756', whiteSpace: 'nowrap' }}>
                      📅 Data Source Month:
                    </label>
                    <select
                      value={productSettingYm}
                      onChange={(e) => setProductSettingYm(e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '600' }}
                    >
                      <option value="CURRENT">
                        🌟 Current Month ({MONTH_NAMES[parseInt(advanceDacMonth, 10) - 1]} {advanceDacYear})
                      </option>
                      {availableUploadedMonths
                        .filter((m) => m.ym !== `${advanceDacYear}-${String(advanceDacMonth).padStart(2, '0')}`)
                        .map((m) => (
                          <option key={m.ym} value={m.ym}>
                            {m.label} ({m.totalCylinders} Cylinders)
                          </option>
                        ))}
                      <option value="ALL">All Uploaded Months (Combined)</option>
                    </select>
                  </div>
                </div>

                {/* Auto-fetch banner */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginBottom: '14px',
                  fontSize: '12.5px',
                  color: '#166534',
                }}>
                  <span>⚡</span>
                  <span>
                    Showing <strong>{fetchedMonthProducts.length} Products</strong> auto-fetched from <strong>{
                      productSettingYm === 'CURRENT'
                        ? `Current Month (${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })})`
                        : productSettingYm === 'ALL'
                          ? 'All Uploaded Months'
                          : availableUploadedMonths.find((m) => m.ym === productSettingYm)?.label || 'Uploaded Data'
                    }</strong>. Default Selling Rate (₹) har product ke liye <strong>Sales Value / Refill Quantity</strong> se calculate ho raha hai.
                  </span>
                </div>

                <div className="sales-data-table-wrap" style={{ marginBottom: '16px' }}>
                  <table className="sales-table">
                    <thead>
                      <tr>
                        <th>Package Code / Product Name</th>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }} title="Default Rate = Sales Value / Refill Quantity">
                          Default Rate (₹)<br/>
                          <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#0369a1', textTransform: 'none' }}>(Sales Value / Qty)</span>
                        </th>
                        <th style={{ textAlign: 'center' }}>Month Cylinders</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fetchedMonthProducts.map((prod) => {
                        const isEditingThis = editingRateProd === prod.name;
                        return (
                          <tr key={prod.id} style={{ opacity: prod.enabled ? 1 : 0.6 }}>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <strong style={{ color: '#0f3756', fontSize: '13px' }}>{prod.name}</strong>
                                <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                  {prod.isAutoFetched ? (
                                    <span style={{ fontSize: '10.5px', color: '#15803d', fontWeight: '600' }}>
                                      ⚡ Auto-fetched: Sales Value / Qty ({prod.txCount} orders)
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>
                                      Manual / Custom entry
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: '700',
                                background: prod.category === 'Commercial' ? '#fef3c7' : '#e0f2fe',
                                color: prod.category === 'Commercial' ? '#92400e' : '#0369a1',
                              }}>
                                {prod.category}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isEditingThis ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700' }}>₹</span>
                                  <input
                                    type="number"
                                    value={editingRateVal}
                                    onChange={(e) => setEditingRateVal(e.target.value)}
                                    style={{ width: '80px', padding: '2px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #0284c7' }}
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    className="sales-report-btn sales-report-btn--primary"
                                    style={{ padding: '2px 6px', fontSize: '11px' }}
                                    onClick={() => handleSaveProductRate(prod.name, editingRateVal)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer' }}
                                    onClick={() => { setEditingRateProd(null); setEditingRateVal(''); }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                  <strong style={{ fontSize: '13px', color: '#0f3756' }}>
                                    ₹{prod.defaultRate ? prod.defaultRate.toFixed(2) : '0.00'}
                                  </strong>
                                  {prod.isRateOverridden && (
                                    <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '1px 4px', borderRadius: '3px', fontWeight: '600' }} title="Custom override applied">
                                      Custom
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRateProd(prod.name);
                                      setEditingRateVal(String(prod.defaultRate || ''));
                                    }}
                                    title="Edit rate override"
                                    style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '11px', padding: '1px 3px' }}
                                  >
                                    ✏️
                                  </button>
                                  {prod.isRateOverridden && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetProductRate(prod.name)}
                                      title="Reset to auto-fetched month rate"
                                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '1px 3px' }}
                                    >
                                      🔄
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: '700', color: prod.totalQty > 0 ? '#0f3756' : '#94a3b8', fontSize: '12.5px' }}>
                                {prod.totalQty > 0 ? `${prod.totalQty} Cylinders` : '—'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                fontWeight: '700',
                                color: prod.enabled ? '#15803d' : '#94a3b8',
                              }}>
                                {prod.enabled ? '✅ Active' : '🚫 Disabled'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  checked={prod.enabled}
                                  onChange={(e) => handleToggleProductByName(prod.name, e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add Custom Product Type Form */}
                <form onSubmit={handleAddProduct} style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}>
                  <strong style={{ fontSize: '13px', color: '#0f3756' }}>+ Add Custom Product / Rate:</strong>
                  <input
                    type="text"
                    placeholder="Product Name (e.g. 19 KG Nanocut)"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    style={{ flex: 1, minWidth: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                  <select
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  >
                    <option value="Domestic">Domestic</option>
                    <option value="Commercial">Commercial</option>
                    <option value="FTL">FTL</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Rate ₹"
                    value={newProductRate}
                    onChange={(e) => setNewProductRate(e.target.value)}
                    style={{ width: '90px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                  <button
                    type="submit"
                    className="sales-report-btn sales-report-btn--primary"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    Add Product
                  </button>
                </form>
              </div>

              {/* Setting 3: Month-wise Upload Confirmation & Re-upload Protection */}
              <div className="settings-section-card">
                <h3>🔒 Month-wise Upload Confirmation &amp; Re-upload Protection</h3>
                <p>
                  Confirming a monthly upload locks its transactions. Once confirmed, staff cannot re-upload or overwrite data without Admin approval.
                </p>

                {/* Uploaded data Reset - Enable/Disable Option */}
                <div
                  style={{
                    margin: '18px 0 16px',
                    background: (storeData.settings?.allowDataReset ?? false) ? '#fef2f2' : '#f8fafc',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: (storeData.settings?.allowDataReset ?? false) ? '1px solid #fecaca' : '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '13.5px', color: (storeData.settings?.allowDataReset ?? false) ? '#b91c1c' : '#0f3756' }}>
                        {(storeData.settings?.allowDataReset ?? false) ? '⚠️ Uploaded Data Reset: ENABLED' : '🛡️ Uploaded Data Reset: DISABLED'}
                      </strong>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: (storeData.settings?.allowDataReset ?? false) ? '#fee2e2' : '#e2e8f0',
                          color: (storeData.settings?.allowDataReset ?? false) ? '#b91c1c' : '#475569',
                        }}
                      >
                        {(storeData.settings?.allowDataReset ?? false) ? 'Reset Active' : 'Protected'}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                      {(storeData.settings?.allowDataReset ?? false)
                        ? 'Accidental reset protection is OFF. You can now reset or delete uploaded sales data for specific months or all months.'
                        : 'Accidental reset protection is ON. Enable this switch to allow resetting or clearing uploaded sales data.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: (storeData.settings?.allowDataReset ?? false) ? '#b91c1c' : '#64748b' }}>
                      {savingResetToggle ? 'Saving…' : ((storeData.settings?.allowDataReset ?? false) ? 'Enabled' : 'Disabled')}
                    </span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={storeData.settings?.allowDataReset ?? false}
                        disabled={savingResetToggle}
                        onChange={(e) => handleToggleAllowDataReset(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="sales-data-table-wrap">
                  <table className="sales-table">
                    <thead>
                      <tr>
                        <th>Month Period</th>
                        <th>File Name</th>
                        <th style={{ textAlign: 'center' }}>Total Records</th>
                        <th style={{ textAlign: 'center' }}>Confirmation Status</th>
                        <th>Confirmed / Locked By</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                        <th style={{ textAlign: 'center' }}>Reset Uploaded Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(storeData.monthlyUploads || {}).length > 0 ? (
                        Object.entries(storeData.monthlyUploads).map(([ym, mData]) => {
                          const now = new Date();
                          const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                          const isCurrentMonth = ym === currentYm;
                          const isLocked = !isCurrentMonth && !!(lockedMonths[ym]?.confirmed || mData.confirmed);
                          const isResetAllowed = storeData.settings?.allowDataReset ?? false;
                          return (
                            <tr key={ym}>
                              <td><strong>{ym}</strong></td>
                              <td><small>{mData.fileName || 'Uploaded Batch'}</small></td>
                              <td style={{ textAlign: 'center' }}>{mData.summary?.totalRows || mData.rows?.length || 0}</td>
                              <td style={{ textAlign: 'center' }}>
                                {isLocked ? (
                                  <span className="month-badge month-badge--confirmed">
                                    🔒 Confirmed &amp; Locked
                                  </span>
                                ) : (
                                  <span className="month-badge month-badge--uploaded">
                                    🔓 Unlocked
                                  </span>
                                )}
                              </td>
                              <td>
                                <small>
                                  {isLocked
                                    ? lockedMonths[ym]?.confirmedBy || mData.confirmedBy || 'User'
                                    : '—'}
                                </small>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isCurrentMonth ? (
                                  <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: '700' }}>
                                    Current Month — Always Unlocked
                                  </span>
                                ) : !isLocked ? (
                                  <button
                                    type="button"
                                    className="sales-report-btn sales-report-btn--primary"
                                    style={{ padding: '4px 10px', fontSize: '11px' }}
                                    onClick={() => handleConfirmMonth(ym)}
                                  >
                                    🔒 Confirmed &amp; Locked
                                  </button>
                                ) : (isAdmin || loggedInUser?.userAccess?.allowSalesReupload === true) ? (
                                  <button
                                    type="button"
                                    className="sales-report-btn sales-report-btn--danger"
                                    style={{ padding: '4px 10px', fontSize: '11px', background: '#d97706', borderColor: '#d97706' }}
                                    onClick={() => handleUnlockMonth(ym)}
                                  >
                                    🔓 Unlock for Re-upload
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>
                                    Locked (Admin Required)
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="sales-report-btn"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    background: isResetAllowed ? '#fee2e2' : '#f1f5f9',
                                    color: isResetAllowed ? '#b91c1c' : '#94a3b8',
                                    border: isResetAllowed ? '1px solid #fecaca' : '1px solid #cbd5e1',
                                    cursor: isResetAllowed ? 'pointer' : 'not-allowed',
                                    opacity: isResetAllowed ? 1 : 0.6,
                                  }}
                                  onClick={() => handleResetMonthData(ym)}
                                  disabled={!isResetAllowed}
                                  title={
                                    isResetAllowed
                                      ? `Delete all uploaded records for ${ym}`
                                      : 'Enable "Uploaded Data Reset" above to allow deleting'
                                  }
                                >
                                  🗑️ Reset Data
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                            No monthly sales records currently uploaded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Reset All Uploaded Data Footer */}
                {Object.keys(storeData.monthlyUploads || {}).length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <small style={{ color: '#64748b' }}>
                      {(storeData.settings?.allowDataReset ?? false)
                        ? '⚠️ Resetting data will permanently purge records from the analytical database.'
                        : '🔒 Data reset buttons are protected. Switch ON the toggle above if you need to reset uploaded data.'}
                    </small>
                    {(storeData.settings?.allowDataReset ?? false) && (
                      <button
                        type="button"
                        className="sales-report-btn"
                        style={{ background: '#b91c1c', color: '#ffffff', fontSize: '12px', padding: '6px 14px', fontWeight: '700' }}
                        onClick={handleResetAllData}
                        title="Permanently delete all uploaded records across all months"
                      >
                        🚨 Reset All Uploaded Data
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {deliveryDrilldown && (
        <div className="dac-consumer-modal" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDeliveryDrilldown(null);
        }}>
          <section className="dac-consumer-book" role="dialog" aria-modal="true" aria-labelledby="dac-consumer-title">
            <header className="dac-consumer-book__header">
              <div>
                <span>📖 CONSUMER DELIVERY REGISTER</span>
                <h3 id="dac-consumer-title">{deliveryDrilldown.deliveryman}</h3>
                <p>{deliveryDrilldown.scope} · {deliveryDrilldown.label} · {deliveryDrilldown.count.toLocaleString()} deliveries</p>
              </div>
              <button type="button" onClick={() => setDeliveryDrilldown(null)} aria-label="Close consumer details">✕</button>
            </header>
            <div className="dac-consumer-book__body">
              {deliveryDrilldown.rows.length ? (
                <table>
                  <thead><tr><th>#</th><th>Consumer No.</th><th>Consumer</th><th>Mobile</th><th>Area</th><th>Order / Cash Memo</th><th>Booking Date</th><th>Delivery Date</th><th>Qty</th><th>DAC</th></tr></thead>
                  <tbody>{[...deliveryDrilldown.rows].sort((a, b) => String(a.consumerNo || '').localeCompare(String(b.consumerNo || ''), undefined, { numeric: true, sensitivity: 'base' })).map((row, index) => (
                    <tr key={row.id || row.uniqueKey || `${row.consumerNo}-${index}`}>
                      <td>{index + 1}</td><td><strong>{row.consumerNo || '—'}</strong></td><td>{row.consumerName || '—'}</td>
                      <td>{row.mobileNo || '—'}</td><td>{row.deliveryArea || '—'}</td><td>{row.orderNo || '—'}<small>{row.cashMemoNo || ''}</small></td>
                      <td>{row.orderDateKey || row.orderDate || '—'}</td><td>{row.actualDeliveryDate || row.salesDate || '—'}</td><td>{row.orderQuantity || 1}</td><td>{row.dacType || (row.dacVerified ? 'OTP/DAC' : '—')}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <div className="dac-consumer-book__empty">Consumer-level details reference/sample data mein available nahi hain.</div>}
            </div>
            <footer><span>{deliveryDrilldown.rows.length} consumer record{deliveryDrilldown.rows.length === 1 ? '' : 's'}</span><button type="button" onClick={() => window.print()}>🖨️ Print List</button></footer>
          </section>
        </div>
      )}

      {/* Excel Upload & Schema Validation Modal */}
      <SalesImportModal
        isOpen={importModalConfig.isOpen}
        onClose={() => setImportModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirmImport={handleConfirmImport}
        existingTransactions={transactions}
        initialUploadType={importModalConfig.uploadType}
        initialYear={importModalConfig.year}
        initialMonthCode={importModalConfig.monthCode}
        lockedMonths={lockedMonths}
        isAdmin={isAdmin}
        allowSalesReupload={loggedInUser?.userAccess?.allowSalesReupload === true}
        uploading={Boolean(cloudOperation?.label?.startsWith('Uploading'))}
        uploadProgress={cloudOperation?.label?.startsWith('Uploading') ? cloudOperation.percent : 0}
      />
    </main>
  );
}
