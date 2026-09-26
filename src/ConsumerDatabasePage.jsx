import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { loadConsumerDatabase, loadConsumerDatabaseMetadata, saveConsumerDatabase } from './services/consumerDatabaseRepository';
import './ConsumerDatabasePage.css';

const CONSUMER_COLUMNS = ['SL No.', 'Consumer No', 'LPG ID', 'Consumer Name', 'Consumer Status', 'Mobile No', 'IVRS No.2', 'IVRS No.3', 'IVRS No.4', 'Is KYC Completed', 'Eligible For Subsidy', 'CTC Flag', 'CTC Date', 'PFMSBeneficiaryId', 'PFMSBeneficiaryType', 'BankAccountNo', 'BankIFSCCode', 'EKYC Date', 'EKYC Status', 'EKYC Mode', 'EKYC From', 'Safety Inspection Status', 'Safety Inspection Date', 'Hose Validity Date', 'MI Date', 'MaskedAadhar', 'Connection Type', 'Consumer Nature', 'SubNature Code', 'Delivery Area', 'SV Date', 'Consumer Address', 'LastRefillDate', 'Last Refill BookingSource'];

const cleanHeader = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizedColumns = new Map(CONSUMER_COLUMNS.map((column) => [cleanHeader(column), column]));
const normalizeRows = (rows) => rows.map((source, index) => {
  const row = Object.fromEntries(CONSUMER_COLUMNS.map((column) => [column, '']));
  Object.entries(source || {}).forEach(([key, value]) => {
    const column = normalizedColumns.get(cleanHeader(key));
    if (column) row[column] = value == null ? '' : String(value).trim();
  });
  if (!row['SL No.']) row['SL No.'] = String(index + 1);
  return row;
}).filter((row) => row['Consumer No'] || row['Consumer Name'] || row['LPG ID']);

const isYes = (value) => /^(y|yes|done|completed|eligible|active)$/i.test(String(value || '').trim());
const isEkycCompleted = (row) => (
  isYes(row['EKYC Status'])
  || /completed|success/i.test(String(row['EKYC Status'] || ''))
);
const comparable = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const equalsValue = (field, expected) => (row) => comparable(row[field]) === comparable(expected);
const hasRegisteredMobile = (row) => {
  const mobile = String(row['Mobile No'] || '').trim();
  return Boolean(mobile && !/^[—–-]+$/.test(mobile));
};

const MENU_GROUPS = [
  { label: '', items: [{ key: 'dashboard', label: 'Dashboard', test: () => true }, { key: 'all', label: 'All Consumers', test: () => true }, { key: 'ekyc-dashboard', label: 'Pending eKYC Dashboard', test: () => true }, { key: 'refill-recency', label: 'Refill Recency Bucket', test: () => true }] },
  { label: 'Consumer Status', items: [
    { key: 'status-active', label: 'Active', test: equalsValue('Consumer Status', 'Active') },
    { key: 'status-distributor-blocked', label: 'Blocked by Distributor', test: equalsValue('Consumer Status', 'Blocked by Distributor') },
    { key: 'status-so-blocked', label: 'Blocked by SO', test: equalsValue('Consumer Status', 'Blocked by SO') },
    { key: 'status-in-transit', label: 'In-Transit', test: equalsValue('Consumer Status', 'In-Transit') },
  ] },
  { label: 'Mobile No', items: [
    { key: 'mobile-registered', label: 'Registered Mobile No', test: hasRegisteredMobile },
    { key: 'mobile-unregistered', label: 'Unregistered Mobile No', test: (row) => !hasRegisteredMobile(row) },
  ] },
  { label: 'PFMS Beneficiary Type', items: ['NCTC', 'BCTC', 'ACTC'].map((value) => ({ key: `pfms-${value.toLowerCase()}`, label: value, test: equalsValue('PFMSBeneficiaryType', value) })) },
  { label: 'Last Refill Booking Source', items: ['Chatbot', 'CSC', 'Customer Connect', 'Distributor', 'E Comm App', 'HP Pay', 'IVRS', 'Portal', 'Vitran'].map((value) => ({ key: `source-${comparable(value)}`, label: value, test: equalsValue('Last Refill BookingSource', value) })) },
  { label: 'Connection Type', items: ['DBC', 'Mixed DBC', 'Multiple', 'SBC'].map((value) => ({ key: `connection-${comparable(value)}`, label: value, test: equalsValue('Connection Type', value) })) },
  { label: 'Consumer Nature', items: ['1 - Domestic', '11 - Scheme-BPL', '16-Scheme Ujjwala', '2 - Non Domestic Exempted'].map((value) => ({ key: `nature-${comparable(value)}`, label: value, test: equalsValue('Consumer Nature', value) })) },
  { label: 'eKYC Status', items: [
    { key: 'ekyc-completed', label: 'eKYC Completed', test: isEkycCompleted },
    { key: 'ekyc-pending', label: 'eKYC Pending', test: (row) => !isEkycCompleted(row) },
  ] },
];
const MENU_ITEMS = MENU_GROUPS.flatMap((group) => group.items);
const SIDEBAR_MENU_GROUPS = MENU_GROUPS.map((group) => ({
  ...group,
  label: group.label || 'Overview & Reports',
}));
const SEARCH_MENU_ITEM = { key: 'search-consumer', label: 'Search Consumer' };
const SETTINGS_MENU_GROUPS = [{ label: 'Quick Tools', items: [SEARCH_MENU_ITEM] }, ...SIDEBAR_MENU_GROUPS];
const CONSUMER_SEARCH_FIELDS = ['Consumer No', 'Mobile No', 'Consumer Name', 'MaskedAadhar', 'BankAccountNo', 'LPG ID', 'PFMSBeneficiaryId', 'IVRS No.2', 'IVRS No.3', 'IVRS No.4'];
const CONSUMER_SEARCH_RESULT_COLUMNS = ['Consumer No', 'Consumer Name', 'Mobile No', 'MaskedAadhar', 'BankAccountNo', 'LPG ID', 'Consumer Status', 'Consumer Nature', 'EKYC Status', 'EKYC Date', 'Delivery Area', 'LastRefillDate'];
const TOP_FILTER_GROUPS = MENU_GROUPS.filter((group) => group.label);
const PENDING_EKYC_FILTER_GROUPS = TOP_FILTER_GROUPS.filter((group) => group.label !== 'eKYC Status');
const DEFAULT_COLUMN_FILTERS = {
  'Consumer Status': 'status-active',
  'Mobile No': 'mobile-registered',
  'Consumer Nature': ['nature-1domestic', 'nature-11schemebpl', 'nature-16schemeujjwala'],
  'eKYC Status': 'ekyc-completed',
};
const PENDING_EKYC_DEFAULT_FILTERS = {
  'Consumer Nature': ['nature-1domestic', 'nature-11schemebpl', 'nature-16schemeujjwala'],
};

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b', '#ec4899', '#84cc16'];
const formatCount = (value) => Number(value || 0).toLocaleString('en-IN');
const formatUploadTimestamp = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Date/time unavailable';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
};

const DistributionChart = ({ title, items, total, type = 'bar', subtitle = 'Consumer distribution' }) => {
  const safeItems = items.filter((item) => item.count > 0);
  const chartItems = safeItems.length ? safeItems : items;
  const maxCount = Math.max(1, ...chartItems.map((item) => item.count));
  const donutBackground = chartItems.length && total
    ? `conic-gradient(${chartItems.map((item, index) => {
      const before = chartItems.slice(0, index).reduce((sum, entry) => sum + entry.count, 0) / total * 100;
      const after = (before + (item.count / total * 100));
      return `${CHART_COLORS[index % CHART_COLORS.length]} ${before}% ${after}%`;
    }).join(', ')})`
    : '#e2e8f0';

  return <article className={`consumer-db__chart consumer-db__chart--${type}`}>
    <header><div><strong>{title}</strong><small>{subtitle}</small></div><span>{formatCount(total)} total</span></header>
    {type === 'donut' ? <div className="consumer-db__donut-layout">
      <div className="consumer-db__donut" style={{ background: donutBackground }}><div><strong>{formatCount(total)}</strong><small>Consumers</small></div></div>
      <div className="consumer-db__legend">{chartItems.map((item, index) => <div key={item.label}><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} /><span title={item.label}>{item.label}</span><b>{formatCount(item.count)} <small>{total ? Math.round((item.count / total) * 100) : 0}%</small></b></div>)}</div>
    </div> : type === 'column' ? <div className="consumer-db__columns">{chartItems.map((item, index) => {
      const percent = total ? Math.round((item.count / total) * 100) : 0;
      return <div className="consumer-db__column" key={item.label}><b>{formatCount(item.count)}</b><div><i style={{ height: `${Math.max(3, (item.count / maxCount) * 100)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} /></div><span title={item.label}>{item.label}</span><small>{percent}%</small></div>;
    })}</div> : <div>{chartItems.map((item, index) => {
      const percent = total ? Math.round((item.count / total) * 100) : 0;
      return <div className="consumer-db__chart-row" key={item.label}><div><span>{item.label}</span><b>{formatCount(item.count)} <small>{percent}%</small></b></div><div className="consumer-db__chart-track"><i style={{ width: `${(item.count / maxCount) * 100}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} /></div></div>;
    })}</div>}
  </article>;
};

const valueDistribution = (rows, field, emptyLabel = 'Not Available') => {
  const counts = new Map();
  rows.forEach((row) => {
    const label = String(row[field] || '').trim() || emptyLabel;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
};

const parseConsumerDate = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const validLocalDate = (year, month, day) => {
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  };
  const excelSerial = Number(text);
  if (/^\d{5}(?:\.\d+)?$/.test(text) && excelSerial >= 20000 && excelSerial <= 100000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.floor(excelSerial) * 86400000);
    return validLocalDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (iso) return validLocalDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const indian = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[ T].*)?$/);
  if (indian) {
    const yearNumber = Number(indian[3]);
    const year = indian[3].length === 2 ? (yearNumber >= 70 ? 1900 + yearNumber : 2000 + yearNumber) : yearNumber;
    return validLocalDate(year, Number(indian[2]), Number(indian[1]));
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return validLocalDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
};

const formatConsumerDate = (value) => {
  const date = parseConsumerDate(value);
  return date ? `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}` : '—';
};

const CONSUMER_DATE_COLUMNS = new Set([
  'CTC Date', 'EKYC Date', 'Safety Inspection Date', 'Hose Validity Date',
  'MI Date', 'SV Date', 'LastRefillDate',
]);
const consumerCellValue = (row, column) => {
  if (CONSUMER_DATE_COLUMNS.has(column)) return formatConsumerDate(row[column]);
  return row[column] || '—';
};
const normalizeConsumerDateValues = (rows) => rows.map((row) => {
  const normalized = { ...row };
  CONSUMER_DATE_COLUMNS.forEach((column) => {
    if (String(row[column] || '').trim()) normalized[column] = formatConsumerDate(row[column]);
  });
  return normalized;
});

const refillBucketForRow = (row) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = parseConsumerDate(row.LastRefillDate);
  if (!date) return { label: 'Date Missing', days: null };
  const days = Math.max(0, Math.floor((today - date) / 86400000));
  const label = days <= 30 ? '0–30 Days' : days <= 60 ? '31–60 Days' : days <= 90 ? '61–90 Days' : days <= 180 ? '91–180 Days' : days <= 365 ? '181–365 Days' : '365+ Days';
  return { label, days };
};

const refillRecencyDistribution = (rows) => {
  const labels = ['0–30 Days', '31–60 Days', '61–90 Days', '91–180 Days', '181–365 Days', '365+ Days', 'Date Missing'];
  return labels.map((label) => ({ label, count: rows.filter((row) => refillBucketForRow(row).label === label).length }));
};

const ConsumerDatabasePage = ({ loggedInUser, onClose }) => {
  const menuVisibilityStorageKey = `consumer-db-menu-visibility:${loggedInUser?.id || loggedInUser?.dealerCode || 'default'}`;
  const [rows, setRows] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, percent: 0 });
  const [refillBucketFilter, setRefillBucketFilter] = useState('');
  const [openSidebarGroup, setOpenSidebarGroup] = useState('Overview & Reports');
  const [customColumns, setCustomColumns] = useState(null);
  const [consumerLookupInput, setConsumerLookupInput] = useState('');
  const [consumerLookupTerm, setConsumerLookupTerm] = useState('');
  const [showLookupSuggestions, setShowLookupSuggestions] = useState(false);
  const [hiddenMenuKeys, setHiddenMenuKeys] = useState(() => {
    try { return JSON.parse(localStorage.getItem(menuVisibilityStorageKey) || '[]'); } catch { return []; }
  });
  const fileRef = useRef(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadConsumerDatabase(loggedInUser?.id).then((snapshot) => {
      if (!cancelled && snapshot) { setRows(normalizeConsumerDateValues(snapshot.rows || [])); setMetadata(snapshot.metadata || null); }
    }).catch((error) => { if (!cancelled) setMessage(error.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loggedInUser?.id]);

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter(equalsValue('Consumer Status', 'Active')).length,
    registeredMobile: rows.filter(hasRegisteredMobile).length,
    ekycCompleted: rows.filter(isEkycCompleted).length,
    ujjwala: rows.filter(equalsValue('Consumer Nature', '16-Scheme Ujjwala')).length,
  }), [rows]);
  const dataValidTill = useMemo(() => {
    let latest = null;
    rows.forEach((row) => {
      ['LastRefillDate', 'EKYC Date'].forEach((field) => {
        const date = parseConsumerDate(row[field]);
        if (date && (!latest || date > latest)) latest = date;
      });
    });
    return latest ? formatConsumerDate(latest) : '';
  }, [rows]);
  const consumerLookupResults = useMemo(() => {
    const term = consumerLookupTerm.trim().toLowerCase();
    if (!term) return [];
    const compactTerm = term.replace(/[^a-z0-9]/g, '');
    return rows.filter((row) => CONSUMER_SEARCH_FIELDS.some((field) => {
      const value = String(row[field] || '').toLowerCase();
      return value.includes(term) || (compactTerm && value.replace(/[^a-z0-9]/g, '').includes(compactTerm));
    }));
  }, [consumerLookupTerm, rows]);
  const consumerLookupSuggestions = useMemo(() => {
    const term = consumerLookupInput.trim().toLowerCase();
    if (term.length < 2) return [];
    const compactTerm = term.replace(/[^a-z0-9]/g, '');
    return rows.filter((row) => CONSUMER_SEARCH_FIELDS.some((field) => {
      const value = String(row[field] || '').toLowerCase();
      return value.includes(term) || (compactTerm && value.replace(/[^a-z0-9]/g, '').includes(compactTerm));
    })).slice(0, 8);
  }, [consumerLookupInput, rows]);

  const searchIndex = useMemo(() => new Map(rows.map((row) => [row, CONSUMER_COLUMNS.map((key) => String(row[key] || '')).join('\u0000').toLowerCase()])), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const selectedMenu = MENU_ITEMS.find((item) => item.key === activeMenu);
    if (selectedMenu && !selectedMenu.test(row)) return false;
    for (const value of Object.values(columnFilters)) {
      const keys = Array.isArray(value) ? value : [value];
      const selectedFilters = keys.map((key) => MENU_ITEMS.find((item) => item.key === key)).filter(Boolean);
      if (selectedFilters.length && !selectedFilters.some((item) => item.test(row))) return false;
    }
    const needle = deferredSearch.trim().toLowerCase();
    return !needle || searchIndex.get(row)?.includes(needle);
  }), [activeMenu, columnFilters, deferredSearch, rows, searchIndex]);

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    setPage(1);
    if (activeMenu === 'refill-recency') setRefillBucketFilter('');
  }, [activeMenu, columnFilters, search]);
  useEffect(() => {
    setCustomColumns(null);
  }, [activeMenu]);
  useEffect(() => {
    localStorage.setItem(menuVisibilityStorageKey, JSON.stringify(hiddenMenuKeys));
  }, [hiddenMenuKeys, menuVisibilityStorageKey]);
  useEffect(() => {
    if (syncing || uploadProgress.percent !== 100 || !/Cloudflare se sync ho gaye/i.test(message)) return undefined;
    const timer = window.setTimeout(() => {
      setMessage('');
      setUploadProgress({ done: 0, total: 0, percent: 0 });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [message, syncing, uploadProgress.percent]);

  const dashboardCharts = useMemo(() => {
    const groupChart = (label, type = 'bar') => {
      const group = TOP_FILTER_GROUPS.find((entry) => entry.label === label);
      return { title: label, type, items: group.items.map((item) => ({ label: item.label, count: filteredRows.filter(item.test).length })) };
    };
    return [
      groupChart('Consumer Status', 'donut'),
      { title: 'eKYC Completion', type: 'donut', items: [{ label: 'Completed', count: filteredRows.filter(isEkycCompleted).length }, { label: 'Pending', count: filteredRows.filter((row) => !isEkycCompleted(row)).length }] },
      groupChart('Consumer Nature'),
      groupChart('Connection Type'),
      { title: 'Refill Recency', type: 'column', items: refillRecencyDistribution(filteredRows) },
      { title: 'Booking Source', type: 'column', items: valueDistribution(filteredRows, 'Last Refill BookingSource').slice(0, 9) },
    ];
  }, [filteredRows]);
  const filteredPendingEkycRows = useMemo(() => filteredRows.filter((row) => !isEkycCompleted(row)), [filteredRows]);
  const ekycDashboardCharts = useMemo(() => [
    { title: 'Consumer Nature', type: 'bar', items: valueDistribution(filteredPendingEkycRows, 'Consumer Nature') },
    { title: 'Mobile Availability', type: 'donut', items: [{ label: 'Registered Mobile', count: filteredPendingEkycRows.filter(hasRegisteredMobile).length }, { label: 'Unregistered Mobile', count: filteredPendingEkycRows.filter((row) => !hasRegisteredMobile(row)).length }] },
  ], [filteredPendingEkycRows]);
  const visiblePendingEkycRows = filteredPendingEkycRows.slice((page - 1) * pageSize, page * pageSize);
  const pendingEkycTotalPages = Math.max(1, Math.ceil(filteredPendingEkycRows.length / pageSize));
  const refillBuckets = useMemo(() => refillRecencyDistribution(filteredRows), [filteredRows]);
  const refillDetailRows = useMemo(() => filteredRows.filter((row) => !refillBucketFilter || refillBucketForRow(row).label === refillBucketFilter), [filteredRows, refillBucketFilter]);
  const visibleRefillRows = refillDetailRows.slice((page - 1) * pageSize, page * pageSize);
  const refillTotalPages = Math.max(1, Math.ceil(refillDetailRows.length / pageSize));

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { setMessage('Excel (.xlsx/.xls) ya CSV (.csv) file select karein.'); return; }
    setSaving(true); setMessage('Excel / CSV process ho raha hai…');
    setUploadProgress({ done: 0, total: 0, percent: 5 });
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const source = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
      const normalized = normalizeRows(source);
      if (!normalized.length) throw new Error('Excel / CSV me valid consumer records nahi mile. Column headers check karein.');
      const nextMetadata = { fileName: file.name, uploadedAt: new Date().toISOString(), totalRows: normalized.length };
      setUploadProgress({ done: 0, total: 0, percent: 10 });
      const saved = await saveConsumerDatabase(loggedInUser.id, normalized, nextMetadata, (done, total) => {
        setUploadProgress({ done, total, percent: Math.min(95, 10 + Math.round((done / total) * 85)) });
        setMessage(`Cloudflare upload: ${done}/${total} parts…`);
      });
      setUploadProgress((current) => ({ ...current, percent: 100 }));
      setRows(normalizeConsumerDateValues(normalized)); setMetadata({ ...nextMetadata, ...saved }); setActiveMenu('all'); setColumnFilters(DEFAULT_COLUMN_FILTERS); setMessage(`${normalized.length} consumers Cloudflare me save ho gaye.`);
    } catch (error) { setUploadProgress((current) => ({ ...current, percent: 0 })); setMessage(error.message || 'Consumer Excel / CSV upload failed.'); }
    finally { setSaving(false); }
  };

  const handleSync = async () => {
    if (syncing || saving) return;
    setSyncing(true);
    setMessage('Cloudflare se consumer data sync ho raha hai…');
    setUploadProgress({ done: 0, total: 3, percent: 10 });
    try {
      const latestMetadata = await loadConsumerDatabaseMetadata(loggedInUser?.id);
      if (latestMetadata?.uploadId && latestMetadata.uploadId === metadata?.uploadId) {
        setMetadata(latestMetadata);
        setUploadProgress({ done: 1, total: 1, percent: 100 });
        setMessage(`${rows.length} consumers quick sync ho gaye — cloud data unchanged hai.`);
        return;
      }
      const snapshot = await loadConsumerDatabase(loggedInUser?.id);
      setUploadProgress({ done: 2, total: 3, percent: 75 });
      const syncedRows = normalizeConsumerDateValues(snapshot?.rows || []);
      setRows(syncedRows);
      setMetadata(snapshot?.metadata || null);
      setUploadProgress({ done: 3, total: 3, percent: 100 });
      setMessage(`${syncedRows.length} consumers Cloudflare se sync ho gaye.`);
    } catch (error) {
      setUploadProgress({ done: 0, total: 0, percent: 0 });
      setMessage(error.message || 'Consumer data sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const REFILL_EXPORT_ROWS = () => refillDetailRows.map((row) => {
    const recency = refillBucketForRow(row);
    return {
      'Consumer No': row['Consumer No'] || '',
      'Consumer Name': row['Consumer Name'] || '',
      'Mobile No': row['Mobile No'] || '',
      'Delivery Area': row['Delivery Area'] || '',
      'Last Refill Date': formatConsumerDate(row.LastRefillDate),
      'Days Since Refill': recency.days ?? '',
      'Recency Bucket': recency.label,
      'Booking Source': row['Last Refill BookingSource'] || '',
    };
  });

  const EXPORT_REFILL_DATA = async () => {
    if (!refillDetailRows.length) return;
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(REFILL_EXPORT_ROWS());
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Refill Recency');
    XLSX.writeFile(workbook, `Refill_Recency_${refillBucketFilter || 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const PRINT_REFILL_DATA = () => {
    if (!refillDetailRows.length) return;
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const exportRows = REFILL_EXPORT_ROWS();
    const columns = Object.keys(exportRows[0] || {});
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) { setMessage('Print popup blocked hai. Browser me popups allow karein.'); return; }
    printWindow.document.write(`<!doctype html><html><head><title>Refill Recency Data</title><style>body{font-family:Arial,sans-serif;margin:18px;color:#172033}h1{font-size:20px;margin:0 0 5px}p{font-size:11px;margin:0 0 14px;color:#52647a}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #aebdca;padding:5px;text-align:left}th{background:#dfeaf4}tr:nth-child(even){background:#f6f8fa}@page{size:landscape;margin:10mm}</style></head><body><h1>Refill Recency Consumer Data</h1><p>${escapeHtml(refillBucketFilter || 'All Recency Buckets')} • ${exportRows.length} records</p><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${exportRows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };

  const dashboardMenuKeys = ['dashboard', 'ekyc-dashboard', 'refill-recency', 'settings', 'search-consumer'];
  const isDashboardView = dashboardMenuKeys.includes(activeMenu);
  const activeMenuItem = MENU_ITEMS.find((item) => item.key === activeMenu);
  const focusedColumns = (() => {
    const allConsumerColumns = [
      'Consumer No',
      'Consumer Name',
      'Mobile No',
      'Consumer Nature',
      'EKYC Status',
      'Delivery Area',
      'LastRefillDate',
      'EKYC Date',
    ];
    if (activeMenu === 'all' || activeMenu === 'dashboard') return allConsumerColumns;
    if (activeMenu === 'ekyc-dashboard') return ['Consumer No', 'Consumer Name', 'Mobile No', 'Consumer Nature', 'EKYC Status', 'Delivery Area', 'EKYC Date'];
    if (activeMenu === 'refill-recency') return ['Consumer No', 'Consumer Name', 'Mobile No', 'Consumer Nature', 'Delivery Area', 'LastRefillDate', 'Last Refill BookingSource'];
    const identity = ['Consumer No', 'Consumer Name', 'Mobile No', 'Delivery Area'];
    if (activeMenu.startsWith('status-')) return [...identity, 'Consumer Status', 'Consumer Nature', 'Connection Type'];
    if (activeMenu.startsWith('mobile-')) return [...identity, 'IVRS No.2', 'IVRS No.3', 'IVRS No.4', 'Consumer Status'];
    if (activeMenu.startsWith('pfms-')) return [...identity, 'PFMSBeneficiaryType', 'PFMSBeneficiaryId', 'BankAccountNo', 'BankIFSCCode'];
    if (activeMenu.startsWith('source-')) return [...identity, 'Last Refill BookingSource', 'LastRefillDate', 'Consumer Status'];
    if (activeMenu.startsWith('connection-')) return [...identity, 'Connection Type', 'Consumer Nature', 'Consumer Status', 'SV Date'];
    if (activeMenu.startsWith('nature-')) return [...identity, 'Consumer Nature', 'SubNature Code', 'Connection Type', 'Consumer Status'];
    if (activeMenu.startsWith('ekyc-')) return [...identity, 'EKYC Status', 'EKYC Date', 'EKYC Mode', 'EKYC From'];
    return CONSUMER_COLUMNS;
  })();
  const displayColumns = customColumns || focusedColumns;
  const activeDataRows = activeMenu === 'ekyc-dashboard'
    ? filteredPendingEkycRows
    : activeMenu === 'refill-recency' ? refillDetailRows : filteredRows;
  const activeDataLabel = activeMenuItem?.label || 'Consumer Database';
  const exportConsumerRows = async (dataRows, columns, label) => {
    if (!dataRows.length) return;
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const exportRows = dataRows.map((row) => Object.fromEntries(columns.map((column) => [column, consumerCellValue(row, column)])));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), 'Consumer Data');
    XLSX.writeFile(workbook, `${String(label || 'Consumer_Data').replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const printConsumerRows = (dataRows, columns, label) => {
    if (!dataRows.length) return;
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) { setMessage('Print popup blocked hai. Browser me popups allow karein.'); return; }
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(label)}</title><style>body{font-family:Arial,sans-serif;margin:18px;color:#172033}h1{font-size:20px;margin:0 0 5px}p{font-size:11px;color:#52647a}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #aebdca;padding:5px;text-align:left}th{background:#dfeaf4}@page{size:landscape;margin:8mm}</style></head><body><h1>${escapeHtml(label)}</h1><p>${dataRows.length} consumer records</p><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${dataRows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(consumerCellValue(row, column))}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
    printWindow.document.close(); printWindow.focus(); printWindow.onload = () => printWindow.print();
  };
  const dataToolbar = <section className="consumer-db__data-toolbar">
    <div className="consumer-db__data-toolbar-left">
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="डेटा के भीतर खोजें..." />
      <select aria-label="Add column" value="" onChange={(event) => { const column = event.target.value; if (column) setCustomColumns([...displayColumns, column]); }}>
        <option value="">Add column</option>
        {CONSUMER_COLUMNS.filter((column) => !displayColumns.includes(column)).map((column) => <option key={column} value={column}>{column}</option>)}
      </select>
      <select aria-label="Remove column" value="" disabled={displayColumns.length <= 1} onChange={(event) => { const column = event.target.value; if (column) setCustomColumns(displayColumns.filter((item) => item !== column)); }}>
        <option value="">Remove column</option>
        {displayColumns.map((column) => <option key={column} value={column}>{column}</option>)}
      </select>
    </div>
    <div className="consumer-db__data-toolbar-actions">
      <span>{activeDataRows.length} records</span>
      <button type="button" onClick={() => printConsumerRows(activeDataRows, displayColumns, activeDataLabel)} disabled={!activeDataRows.length}>Print</button>
      <button type="button" onClick={() => { void exportConsumerRows(activeDataRows, displayColumns, activeDataLabel); }} disabled={!activeDataRows.length}>Excel</button>
    </div>
  </section>;
  const menuCount = (item) => {
    if (item.key === 'ekyc-dashboard') return rows.filter((row) => !isEkycCompleted(row)).length;
    if (['all', 'dashboard', 'refill-recency'].includes(item.key)) return rows.length;
    return rows.filter(item.test).length;
  };
  const renderFilterGroup = (group) => {
    if (group.label === 'Consumer Nature') {
      const selected = Array.isArray(columnFilters[group.label]) ? columnFilters[group.label] : [];
      return <label className="consumer-db__multi-filter" key={group.label}><span>{group.label}</span><details><summary>{selected.length ? `${selected.length} selected` : 'All'}</summary><div>{group.items.map((item) => <label key={item.key}><input type="checkbox" checked={selected.includes(item.key)} onChange={(event) => setColumnFilters((current) => ({ ...current, [group.label]: event.target.checked ? [...selected, item.key] : selected.filter((key) => key !== item.key) }))}/><span>{item.label}</span></label>)}</div></details></label>;
    }
    return <label key={group.label}><span>{group.label}</span><select value={columnFilters[group.label] || ''} onChange={(event) => setColumnFilters((current) => ({ ...current, [group.label]: event.target.value }))}><option value="">All</option>{group.items.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>;
  };

  return <div className="consumer-db">
    <aside className="consumer-db__sidebar">
      <div className="consumer-db__brand"><span>CONSUMER MASTER</span><strong>Consumer Database</strong><small>{loggedInUser?.dealerCode || ''}</small></div>
      {!hiddenMenuKeys.includes(SEARCH_MENU_ITEM.key) && <button type="button" className={`consumer-db__search-link${activeMenu === SEARCH_MENU_ITEM.key ? ' active' : ''}`} onClick={() => { setActiveMenu(SEARCH_MENU_ITEM.key); setSearch(''); }}>⌕ Search Consumer</button>}
      <nav>{SIDEBAR_MENU_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => !hiddenMenuKeys.includes(item.key));
        if (!visibleItems.length) return null;
        const isOpen = openSidebarGroup === group.label;
        return <section key={group.label} className={isOpen ? 'is-open' : ''}>
          <button type="button" className="consumer-db__menu-group-toggle" aria-expanded={isOpen} onClick={() => setOpenSidebarGroup((current) => current === group.label ? '' : group.label)}>
            <span>{group.label}</span><i aria-hidden="true">{isOpen ? '▾' : '▸'}</i>
          </button>
          {isOpen && <div className="consumer-db__menu-group-items">{visibleItems.map((item) => <button key={item.key} className={activeMenu === item.key ? 'active' : ''} onClick={() => { setActiveMenu(item.key); setSearch(''); if (item.key === 'all' || item.key === 'refill-recency') setColumnFilters(DEFAULT_COLUMN_FILTERS); else if (item.key === 'ekyc-dashboard') setColumnFilters(PENDING_EKYC_DEFAULT_FILTERS); else setColumnFilters({}); if (item.key === 'refill-recency') { setRefillBucketFilter(''); setPage(1); } }}><span>{item.label}</span><b>{menuCount(item)}</b></button>)}</div>}
        </section>;
      })}</nav>
      <button type="button" className={`consumer-db__settings-link${activeMenu === 'settings' ? ' active' : ''}`} onClick={() => { setActiveMenu('settings'); setSearch(''); }}>⚙ Settings</button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleUpload} />
      <button className="consumer-db__close" onClick={onClose}>← Close</button>
    </aside>
    <main className="consumer-db__main">
      {!isDashboardView && <header><div><span>{activeMenu === 'all' ? 'TOTAL CONSUMER MASTER' : 'FILTERED CONSUMER DATA'}</span><h1>{activeMenuItem?.label || 'Consumer Database'}</h1><p>{`${filteredRows.length} consumer record${filteredRows.length === 1 ? '' : 's'}`}</p></div></header>}
      {message && <div className="consumer-db__message">{message}</div>}
      {(saving || syncing || uploadProgress.percent === 100) && <section className={`consumer-db__progress${uploadProgress.percent === 100 ? ' consumer-db__progress--complete' : ''}`} aria-live="polite">
        <div><strong>{uploadProgress.percent === 100 ? 'Cloud Sync complete — 100% synced successfully' : `Cloud Sync ${uploadProgress.percent}% complete`}</strong><span>{syncing ? 'Cloudflare quick check ho raha hai' : uploadProgress.total > 0 ? `${uploadProgress.done}/${uploadProgress.total} parts synced` : 'Excel / CSV prepare ho raha hai'}</span></div>
        <div className="consumer-db__progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress.percent}><i style={{ width: `${uploadProgress.percent}%` }} /></div>
      </section>}
      {!isDashboardView && <><section className="consumer-db__stats">{[['Total', stats.total], ['Active', stats.active], ['Registered Mobile', stats.registeredMobile], ['eKYC Completed', stats.ekycCompleted], ['Ujjwala', stats.ujjwala]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="consumer-db__filters">
        <div className="consumer-db__filters-title"><div><strong>Database Filters</strong><span>एक से अधिक filters साथ में लगा सकते हैं</span></div><button onClick={() => { setColumnFilters(DEFAULT_COLUMN_FILTERS); setSearch(''); setActiveMenu('all'); }}>Reset Default</button></div>
        <div className="consumer-db__filters-grid">{TOP_FILTER_GROUPS.map(renderFilterGroup)}</div>
      </section>
      </>}
      {activeMenu === 'search-consumer' ? <section className="consumer-db__consumer-search-page">
        <header><div><span>QUICK CONSUMER LOOKUP</span><h2>Search Consumer</h2><p>Consumer number, mobile, name, Aadhaar, account number, LPG ID ya PFMS ID se search karein.</p></div></header>
        <form className="consumer-db__consumer-search-form" onSubmit={(event) => { event.preventDefault(); setConsumerLookupTerm(consumerLookupInput.trim()); setShowLookupSuggestions(false); }}>
          <div className="consumer-db__consumer-search-input">
            <input autoFocus value={consumerLookupInput} onFocus={() => setShowLookupSuggestions(true)} onBlur={() => window.setTimeout(() => setShowLookupSuggestions(false), 120)} onChange={(event) => { setConsumerLookupInput(event.target.value); setShowLookupSuggestions(true); }} placeholder="Consumer No, Mobile No, Name, Aadhaar, Account No…" autoComplete="off" />
            {showLookupSuggestions && consumerLookupInput.trim().length >= 2 && <div className="consumer-db__consumer-suggestions">
              {consumerLookupSuggestions.map((row, index) => <button type="button" key={`${row['Consumer No']}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { const selected = row['Consumer No'] || row['Mobile No'] || row['Consumer Name']; setConsumerLookupInput(selected); setConsumerLookupTerm(selected); setShowLookupSuggestions(false); }}><span><strong>{row['Consumer Name'] || 'Name unavailable'}</strong><small>Consumer No: {row['Consumer No'] || '—'}</small></span><b>{row['Mobile No'] || 'No mobile'}</b></button>)}
              {!consumerLookupSuggestions.length && <div className="consumer-db__consumer-suggestion-empty">Koi matching suggestion nahi mila</div>}
            </div>}
          </div>
          <button type="submit" disabled={!consumerLookupInput.trim()}><span>Search</span><i aria-hidden="true">⌕</i></button>
          {(consumerLookupInput || consumerLookupTerm) && <button type="button" className="consumer-db__consumer-search-clear" onClick={() => { setConsumerLookupInput(''); setConsumerLookupTerm(''); setShowLookupSuggestions(false); }}>Clear</button>}
        </form>
        {consumerLookupTerm && <div className="consumer-db__consumer-search-summary"><strong>{formatCount(consumerLookupResults.length)} result{consumerLookupResults.length === 1 ? '' : 's'}</strong><span>“{consumerLookupTerm}” ke liye matching consumers</span></div>}
        <div className="consumer-db__consumer-search-results">{consumerLookupResults.slice(0, 100).map((row, index) => <article key={`${row['Consumer No']}-${index}`}>
          <header><div><span>Consumer No.</span><strong>{row['Consumer No'] || '—'}</strong></div><b>{row['Consumer Status'] || 'Status unavailable'}</b></header>
          <div>{CONSUMER_SEARCH_RESULT_COLUMNS.filter((column) => column !== 'Consumer No').map((column) => <dl key={column}><dt>{column}</dt><dd>{consumerCellValue(row, column)}</dd></dl>)}</div>
        </article>)}</div>
        {consumerLookupTerm && !consumerLookupResults.length && <div className="consumer-db__empty">Is search ke liye koi consumer nahi mila.</div>}
        {consumerLookupResults.length > 100 && <div className="consumer-db__consumer-search-limit">First 100 results dikhaye gaye hain. Search ko aur specific karein.</div>}
      </section> : activeMenu === 'settings' ? <section className="consumer-db__settings-page">
        <header><div><span>SIDEBAR PREFERENCES</span><h2>Menu Visibility Settings</h2><p>Select karein ki sidebar me kaun se menus dikhne chahiye.</p></div><button type="button" onClick={() => setHiddenMenuKeys([])}>Show All Menus</button></header>
        <div className="consumer-db__settings-data-status">
          <div className={`consumer-db__validity-info${dataValidTill ? ' has-data' : ''}`}><span>Data valid till</span><strong>{dataValidTill || 'Valid date unavailable'}</strong><small>Latest Refill / eKYC date</small></div>
          <div className={`consumer-db__upload-info${metadata?.uploadedAt ? ' has-data' : ''}`}><span>{metadata?.uploadedAt ? 'Last uploaded' : 'Upload status'}</span><strong>{metadata?.uploadedAt ? formatUploadTimestamp(metadata.uploadedAt) : 'No data uploaded yet'}</strong>{metadata?.totalRows > 0 && <small>{formatCount(metadata.totalRows)} consumer records</small>}</div>
        </div>
        <div className="consumer-db__settings-upload-controls">
          {rows.length ? <div className="consumer-db__upload-actions">
            <button className="consumer-db__upload consumer-db__upload--reupload" onClick={() => fileRef.current?.click()} disabled={saving || syncing}>↻ {saving ? 'Uploading…' : 'Re-Upload Data'}</button>
            <button className="consumer-db__upload consumer-db__upload--sync" onClick={handleSync} disabled={saving || syncing}>⟳ {syncing ? `Syncing ${uploadProgress.percent}%` : 'Sync Data'}</button>
          </div> : <button className="consumer-db__upload" onClick={() => fileRef.current?.click()} disabled={saving || syncing}>＋ {saving ? 'Uploading…' : 'Upload Consumer Excel / CSV'}</button>}
          {(saving || syncing) && <div className="consumer-db__sidebar-progress"><div><i style={{ width: `${uploadProgress.percent}%` }} /></div><span>{uploadProgress.percent}%</span></div>}
        </div>
        <div className="consumer-db__settings-groups">{SETTINGS_MENU_GROUPS.map((group) => {
          const groupKeys = group.items.map((item) => item.key);
          const allGroupMenusVisible = groupKeys.every((key) => !hiddenMenuKeys.includes(key));
          return <section key={group.label}>
            <div className="consumer-db__settings-group-heading"><h3>{group.label}</h3><button type="button" onClick={() => setHiddenMenuKeys((current) => allGroupMenusVisible ? [...new Set([...current, ...groupKeys])] : current.filter((key) => !groupKeys.includes(key)))}>{allGroupMenusVisible ? 'Hide All' : 'Show All'}</button></div>
            {group.items.map((item) => {
              const visible = !hiddenMenuKeys.includes(item.key);
              return <label key={item.key}><span><strong>{item.label}</strong><small>{visible ? 'Sidebar me visible' : 'Sidebar se hidden'}</small></span><input type="checkbox" checked={visible} onChange={() => setHiddenMenuKeys((current) => visible ? [...current, item.key] : current.filter((key) => key !== item.key))} /><i aria-hidden="true" /></label>;
            })}
          </section>;
        })}</div>
      </section> : activeMenu === 'dashboard' ? <section className="consumer-db__dashboard">
        <div className="consumer-db__dashboard-heading"><div><span>LIVE CONSUMER ANALYTICS</span><h2>Consumer Database Dashboard</h2></div><strong>{filteredRows.length}<small>Filtered Consumers</small></strong></div>
        <section className="consumer-db__dashboard-kpis">{[
          ['Total Consumers', filteredRows.length, 'total'],
          ['Active Consumers', filteredRows.filter(equalsValue('Consumer Status', 'Active')).length, 'active'],
          ['eKYC Completed', filteredRows.filter(isEkycCompleted).length, 'ekyc'],
          ['eKYC Pending', filteredRows.filter((row) => !isEkycCompleted(row)).length, 'pending'],
          ['Mobile Registered', filteredRows.filter(hasRegisteredMobile).length, 'mobile'],
        ].map(([label, value, tone]) => <article className={`consumer-db__dashboard-kpi consumer-db__dashboard-kpi--${tone}`} key={label}><span>{label}</span><strong>{formatCount(value)}</strong><small>{filteredRows.length ? ((value / filteredRows.length) * 100).toFixed(1) : '0.0'}% of total</small></article>)}</section>
        <div className="consumer-db__charts">{dashboardCharts.map((chart) => <DistributionChart key={chart.title} {...chart} total={filteredRows.length} />)}</div>
        {!loading && !filteredRows.length && <div className="consumer-db__empty">Dashboard के लिए consumer data उपलब्ध नहीं है।</div>}
      </section> : activeMenu === 'ekyc-dashboard' ? <section className="consumer-db__dashboard">
        <div className="consumer-db__dashboard-heading"><div><span>IDENTITY &amp; COMPLIANCE</span><h2>Pending eKYC Dashboard</h2></div><strong>{filteredPendingEkycRows.length}<small>Pending eKYC Consumers</small></strong></div>
        <div className="consumer-db__charts">{ekycDashboardCharts.map((chart) => <DistributionChart key={chart.title} {...chart} total={filteredPendingEkycRows.length} />)}</div>
        <section className="consumer-db__filters consumer-db__filters--recency consumer-db__filters--ekyc"><div className="consumer-db__filters-title"><div><strong>Pending eKYC Filters</strong><span>नीचे के pending consumer records filter करें</span></div><button onClick={() => { setColumnFilters(PENDING_EKYC_DEFAULT_FILTERS); setSearch(''); setPage(1); }}>Reset Default</button></div><div className="consumer-db__filters-grid">{PENDING_EKYC_FILTER_GROUPS.map(renderFilterGroup)}</div></section>
        {dataToolbar}
        <div className="consumer-db__recency-details consumer-db__pending-ekyc-details"><header><div><strong>Pending eKYC Consumer Data</strong><span>{filteredPendingEkycRows.length} consumer records</span></div></header><div><table><thead><tr>{displayColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{visiblePendingEkycRows.map((row, index) => <tr key={`${row['Consumer No']}-${index}`}>{displayColumns.map((column) => <td key={column}>{row[column] || (column === 'EKYC Status' ? 'Pending' : '—')}</td>)}</tr>)}</tbody></table></div><footer><span>Page {page} of {pendingEkycTotalPages}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page >= pendingEkycTotalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer></div>
      </section> : activeMenu === 'refill-recency' ? <section className="consumer-db__dashboard">
        <div className="consumer-db__dashboard-heading"><div><span>REFILL BEHAVIOUR</span><h2>Refill Recency Bucket</h2></div><strong>{filteredRows.length}<small>Filtered Consumers</small></strong></div>
        <div className="consumer-db__charts consumer-db__charts--single"><DistributionChart title="Last Refill Recency" type="column" items={refillBuckets} total={filteredRows.length} /><DistributionChart title="Last Refill Booking Source" type="column" items={valueDistribution(filteredRows, 'Last Refill BookingSource')} total={filteredRows.length} /></div>
        <div className="consumer-db__recency-summary"><header><div><strong>Bucket-wise Data</strong><span>किसी bucket button पर click करके consumer details filter करें</span></div><button onClick={() => { setRefillBucketFilter(''); setPage(1); }}>Show All</button></header><div className="consumer-db__bucket-buttons">{refillBuckets.map((bucket) => <button type="button" key={bucket.label} className={refillBucketFilter === bucket.label ? 'active' : ''} onClick={() => { setRefillBucketFilter(bucket.label); setPage(1); }}><span>{bucket.label}</span><strong>{bucket.count}</strong><small>{filteredRows.length ? ((bucket.count / filteredRows.length) * 100).toFixed(1) : '0.0'}%</small></button>)}</div></div>
        <section className="consumer-db__filters consumer-db__filters--recency">
          <div className="consumer-db__filters-title"><div><strong>Consumer Data Filters</strong><span>नीचे दिखाई देने वाले consumer records को filter करें</span></div><button onClick={() => { setColumnFilters(DEFAULT_COLUMN_FILTERS); setSearch(''); setRefillBucketFilter(''); setPage(1); }}>Reset Default</button></div>
          <div className="consumer-db__filters-grid">{TOP_FILTER_GROUPS.map(renderFilterGroup)}</div>
        </section>
        {dataToolbar}
        <div className="consumer-db__recency-details"><header><div><strong>{refillBucketFilter || 'All Recency Buckets'}</strong><span>{refillDetailRows.length} consumer records</span></div></header><div><table><thead><tr>{displayColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{visibleRefillRows.map((row, index) => <tr key={`${row['Consumer No']}-${index}`}>{displayColumns.map((column) => <td key={column}>{column === 'LastRefillDate' ? formatConsumerDate(row[column]) : (row[column] || '—')}</td>)}</tr>)}</tbody></table></div><footer><span>Page {page} of {refillTotalPages}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page >= refillTotalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer></div>
      </section> : <>
        {dataToolbar}
        <div className="consumer-db__table-wrap consumer-db__table-wrap--focused"><table><thead><tr>{displayColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{visibleRows.map((row, index) => <tr key={`${row['Consumer No']}-${index}`}>{displayColumns.map((column) => <td key={column}>{row[column] || '—'}</td>)}</tr>)}</tbody></table>{!loading && !visibleRows.length && <div className="consumer-db__empty">Selected menu ke liye matching consumer data nahi mila.</div>}{loading && <div className="consumer-db__empty">Cloud database load ho raha hai…</div>}</div>
        <footer><span>Page {page} of {totalPages}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer>
      </>}
    </main>
  </div>;
};

export default ConsumerDatabasePage;
