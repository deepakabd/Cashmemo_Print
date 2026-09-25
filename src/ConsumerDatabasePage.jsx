import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { loadConsumerDatabase, saveConsumerDatabase } from './services/consumerDatabaseRepository';
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
const isEkycCompleted = (row) => isYes(row['EKYC Status']) || /completed|success/i.test(String(row['EKYC Status'] || ''));
const comparable = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const equalsValue = (field, expected) => (row) => comparable(row[field]) === comparable(expected);
const hasRegisteredMobile = (row) => {
  const mobile = String(row['Mobile No'] || '').trim();
  return Boolean(mobile && !/^[—–-]+$/.test(mobile));
};

const MENU_GROUPS = [
  { label: '', items: [{ key: 'dashboard', label: 'Dashboard', test: () => true }, { key: 'ekyc-dashboard', label: 'Pending eKYC Dashboard', test: () => true }, { key: 'refill-recency', label: 'Refill Recency Bucket', test: () => true }, { key: 'all', label: 'All Consumers', test: () => true }] },
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
    { key: 'ekyc-completed', label: 'eKYC Completed', test: (row) => isYes(row['EKYC Status']) || /completed|success/i.test(String(row['EKYC Status'] || '')) },
    { key: 'ekyc-pending', label: 'eKYC Pending', test: (row) => !(isYes(row['EKYC Status']) || /completed|success/i.test(String(row['EKYC Status'] || ''))) },
  ] },
];
const MENU_ITEMS = MENU_GROUPS.flatMap((group) => group.items);
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

const DistributionChart = ({ title, items, total }) => <article className="consumer-db__chart">
  <header><strong>{title}</strong><span>{total} consumers</span></header>
  <div>{items.map((item) => {
    const percent = total ? Math.round((item.count / total) * 100) : 0;
    return <div className="consumer-db__chart-row" key={item.label}><div><span>{item.label}</span><b>{item.count} <small>{percent}%</small></b></div><div className="consumer-db__chart-track"><i style={{ width: `${percent}%` }} /></div></div>;
  })}</div>
</article>;

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
  return date ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}` : '—';
};

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
  const [rows, setRows] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, percent: 0 });
  const [refillBucketFilter, setRefillBucketFilter] = useState('');
  const fileRef = useRef(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadConsumerDatabase(loggedInUser?.id).then((snapshot) => {
      if (!cancelled && snapshot) { setRows(snapshot.rows || []); setMetadata(snapshot.metadata || null); }
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

  const dashboardCharts = useMemo(() => TOP_FILTER_GROUPS.map((group) => ({
    title: group.label,
    items: group.items.map((item) => ({ label: item.label, count: filteredRows.filter(item.test).length })),
  })), [filteredRows]);
  const filteredPendingEkycRows = useMemo(() => filteredRows.filter((row) => !isEkycCompleted(row)), [filteredRows]);
  const ekycDashboardCharts = useMemo(() => [
    { title: 'Consumer Nature', items: valueDistribution(filteredPendingEkycRows, 'Consumer Nature') },
    { title: 'Mobile Availability', items: [{ label: 'Registered Mobile', count: filteredPendingEkycRows.filter(hasRegisteredMobile).length }, { label: 'Unregistered Mobile', count: filteredPendingEkycRows.filter((row) => !hasRegisteredMobile(row)).length }] },
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
    setSaving(true); setMessage('Excel process ho raha hai…');
    setUploadProgress({ done: 0, total: 0, percent: 5 });
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const source = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
      const normalized = normalizeRows(source);
      if (!normalized.length) throw new Error('Excel me valid consumer records nahi mile. Column headers check karein.');
      const nextMetadata = { fileName: file.name, uploadedAt: new Date().toISOString(), totalRows: normalized.length };
      setUploadProgress({ done: 0, total: 0, percent: 10 });
      await saveConsumerDatabase(loggedInUser.id, normalized, nextMetadata, (done, total) => {
        setUploadProgress({ done, total, percent: Math.min(95, 10 + Math.round((done / total) * 85)) });
        setMessage(`Cloudflare upload: ${done}/${total} parts…`);
      });
      setUploadProgress((current) => ({ ...current, percent: 100 }));
      setRows(normalized); setMetadata(nextMetadata); setActiveMenu('all'); setColumnFilters(DEFAULT_COLUMN_FILTERS); setMessage(`${normalized.length} consumers Cloudflare me save ho gaye.`);
    } catch (error) { setUploadProgress((current) => ({ ...current, percent: 0 })); setMessage(error.message || 'Consumer Excel upload failed.'); }
    finally { setSaving(false); }
  };

  const refillExportRows = () => refillDetailRows.map((row) => {
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

  const exportRefillData = async () => {
    if (!refillDetailRows.length) return;
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(refillExportRows());
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Refill Recency');
    XLSX.writeFile(workbook, `Refill_Recency_${refillBucketFilter || 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const printRefillData = () => {
    if (!refillDetailRows.length) return;
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const exportRows = refillExportRows();
    const columns = Object.keys(exportRows[0] || {});
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) { setMessage('Print popup blocked hai. Browser me popups allow karein.'); return; }
    printWindow.document.write(`<!doctype html><html><head><title>Refill Recency Data</title><style>body{font-family:Arial,sans-serif;margin:18px;color:#172033}h1{font-size:20px;margin:0 0 5px}p{font-size:11px;margin:0 0 14px;color:#52647a}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #aebdca;padding:5px;text-align:left}th{background:#dfeaf4}tr:nth-child(even){background:#f6f8fa}@page{size:landscape;margin:10mm}</style></head><body><h1>Refill Recency Consumer Data</h1><p>${escapeHtml(refillBucketFilter || 'All Recency Buckets')} • ${exportRows.length} records</p><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${exportRows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };

  const dashboardMenuKeys = ['dashboard', 'ekyc-dashboard', 'refill-recency'];
  const isDashboardView = dashboardMenuKeys.includes(activeMenu);
  const menuCount = (item) => ['all', ...dashboardMenuKeys].includes(item.key) ? rows.length : rows.filter(item.test).length;
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
      <nav>{MENU_GROUPS.map((group) => <section key={group.label || 'all'}>{group.label && <h3>{group.label}</h3>}{group.items.map((item) => <button key={item.key} className={activeMenu === item.key ? 'active' : ''} onClick={() => { setActiveMenu(item.key); setSearch(''); if (item.key === 'all' || item.key === 'refill-recency') setColumnFilters(DEFAULT_COLUMN_FILTERS); else if (item.key === 'ekyc-dashboard') setColumnFilters(PENDING_EKYC_DEFAULT_FILTERS); else setColumnFilters({}); if (item.key === 'refill-recency') { setRefillBucketFilter(''); setPage(1); } }}><span>{item.label}</span><b>{menuCount(item)}</b></button>)}</section>)}</nav>
      <button className="consumer-db__upload" onClick={() => fileRef.current?.click()} disabled={saving}>＋ {saving ? 'Uploading…' : 'Upload Total Consumer Excel'}</button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleUpload} />
      <button className="consumer-db__close" onClick={onClose}>← Close</button>
    </aside>
    <main className="consumer-db__main">
      {!isDashboardView && <header><div><span>TOTAL CONSUMER MASTER</span><h1>Consumer Database</h1><p>{metadata ? `${metadata.fileName} • ${new Date(metadata.uploadedAt).toLocaleString('en-IN')}` : 'Total Consumer Excel upload karke database banayein.'}</p></div><button onClick={() => fileRef.current?.click()} disabled={saving}>Upload Excel</button></header>}
      {message && <div className="consumer-db__message">{message}</div>}
      {(saving || uploadProgress.percent === 100) && <section className={`consumer-db__progress${uploadProgress.percent === 100 ? ' consumer-db__progress--complete' : ''}`} aria-live="polite">
        <div><strong>{uploadProgress.percent === 100 ? 'Cloud Sync complete — 100% synced successfully' : `Cloud Sync ${uploadProgress.percent}% complete`}</strong><span>{uploadProgress.total > 0 ? `${uploadProgress.done}/${uploadProgress.total} parts synced` : 'Excel prepare ho raha hai'}</span></div>
        <div className="consumer-db__progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress.percent}><i style={{ width: `${uploadProgress.percent}%` }} /></div>
      </section>}
      {!isDashboardView && <><section className="consumer-db__stats">{[['Total', stats.total], ['Active', stats.active], ['Registered Mobile', stats.registeredMobile], ['eKYC Completed', stats.ekycCompleted], ['Ujjwala', stats.ujjwala]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="consumer-db__filters">
        <div className="consumer-db__filters-title"><div><strong>Database Filters</strong><span>एक से अधिक filters साथ में लगा सकते हैं</span></div><button onClick={() => { setColumnFilters(DEFAULT_COLUMN_FILTERS); setSearch(''); setActiveMenu('all'); }}>Reset Default</button></div>
        <div className="consumer-db__filters-grid">{TOP_FILTER_GROUPS.map(renderFilterGroup)}</div>
      </section>
      <div className="consumer-db__toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search in all 34 consumer parameters…"/><span>{filteredRows.length} records</span></div>
      </>}
      {activeMenu === 'dashboard' ? <section className="consumer-db__dashboard">
        <div className="consumer-db__dashboard-heading"><div><span>LIVE CONSUMER ANALYTICS</span><h2>Consumer Database Dashboard</h2></div><strong>{filteredRows.length}<small>Filtered Consumers</small></strong></div>
        <div className="consumer-db__charts">{dashboardCharts.map((chart) => <DistributionChart key={chart.title} title={chart.title} items={chart.items} total={filteredRows.length} />)}</div>
        {!loading && !filteredRows.length && <div className="consumer-db__empty">Dashboard के लिए consumer data उपलब्ध नहीं है।</div>}
      </section> : activeMenu === 'ekyc-dashboard' ? <section className="consumer-db__dashboard">
        <div className="consumer-db__dashboard-heading"><div><span>IDENTITY &amp; COMPLIANCE</span><h2>Pending eKYC Dashboard</h2></div><strong>{filteredPendingEkycRows.length}<small>Pending eKYC Consumers</small></strong></div>
        <div className="consumer-db__charts">{ekycDashboardCharts.map((chart) => <DistributionChart key={chart.title} title={chart.title} items={chart.items} total={filteredPendingEkycRows.length} />)}</div>
        <section className="consumer-db__filters consumer-db__filters--recency consumer-db__filters--ekyc"><div className="consumer-db__filters-title"><div><strong>Pending eKYC Filters</strong><span>नीचे के pending consumer records filter करें</span></div><button onClick={() => { setColumnFilters(PENDING_EKYC_DEFAULT_FILTERS); setSearch(''); setPage(1); }}>Reset Default</button></div><div className="consumer-db__filters-grid">{PENDING_EKYC_FILTER_GROUPS.map(renderFilterGroup)}</div></section>
        <div className="consumer-db__toolbar consumer-db__toolbar--recency"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pending eKYC data in all 34 parameters…"/><span>{filteredPendingEkycRows.length} records</span></div>
        <div className="consumer-db__recency-details consumer-db__pending-ekyc-details"><header><div><strong>Pending eKYC Consumer Data</strong><span>{filteredPendingEkycRows.length} consumer records</span></div></header><div><table><thead><tr><th>Consumer No</th><th>Consumer Name</th><th>Mobile No</th><th>Delivery Area</th><th>eKYC Status</th><th>Consumer Nature</th></tr></thead><tbody>{visiblePendingEkycRows.map((row, index) => <tr key={`${row['Consumer No']}-${index}`}><td>{row['Consumer No'] || '—'}</td><td>{row['Consumer Name'] || '—'}</td><td>{row['Mobile No'] || '—'}</td><td>{row['Delivery Area'] || '—'}</td><td>{row['EKYC Status'] || 'Pending'}</td><td>{row['Consumer Nature'] || '—'}</td></tr>)}</tbody></table></div><footer><span>Page {page} of {pendingEkycTotalPages}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page >= pendingEkycTotalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer></div>
      </section> : activeMenu === 'refill-recency' ? <section className="consumer-db__dashboard">
        <div className="consumer-db__dashboard-heading"><div><span>REFILL BEHAVIOUR</span><h2>Refill Recency Bucket</h2></div><strong>{filteredRows.length}<small>Filtered Consumers</small></strong></div>
        <div className="consumer-db__charts consumer-db__charts--single"><DistributionChart title="Last Refill Recency" items={refillBuckets} total={filteredRows.length} /><DistributionChart title="Last Refill Booking Source" items={valueDistribution(filteredRows, 'Last Refill BookingSource')} total={filteredRows.length} /></div>
        <div className="consumer-db__recency-summary"><header><div><strong>Bucket-wise Data</strong><span>किसी bucket button पर click करके consumer details filter करें</span></div><button onClick={() => { setRefillBucketFilter(''); setPage(1); }}>Show All</button></header><div className="consumer-db__bucket-buttons">{refillBuckets.map((bucket) => <button type="button" key={bucket.label} className={refillBucketFilter === bucket.label ? 'active' : ''} onClick={() => { setRefillBucketFilter(bucket.label); setPage(1); }}><span>{bucket.label}</span><strong>{bucket.count}</strong><small>{filteredRows.length ? ((bucket.count / filteredRows.length) * 100).toFixed(1) : '0.0'}%</small></button>)}</div></div>
        <section className="consumer-db__filters consumer-db__filters--recency">
          <div className="consumer-db__filters-title"><div><strong>Consumer Data Filters</strong><span>नीचे दिखाई देने वाले consumer records को filter करें</span></div><button onClick={() => { setColumnFilters(DEFAULT_COLUMN_FILTERS); setSearch(''); setRefillBucketFilter(''); setPage(1); }}>Reset Default</button></div>
          <div className="consumer-db__filters-grid">{TOP_FILTER_GROUPS.map(renderFilterGroup)}</div>
        </section><div className="consumer-db__toolbar consumer-db__toolbar--recency"><input value={search} onChange={(event) => { setSearch(event.target.value); setRefillBucketFilter(''); }} placeholder="Search refill data in all 34 parameters…"/><span>{filteredRows.length} records</span></div>
        <div className="consumer-db__recency-details"><header><div><strong>{refillBucketFilter || 'All Recency Buckets'}</strong><span>{refillDetailRows.length} consumer records</span></div><div className="consumer-db__data-actions"><button type="button" onClick={() => { void exportRefillData(); }} disabled={!refillDetailRows.length}>Export Excel</button><button type="button" onClick={printRefillData} disabled={!refillDetailRows.length}>Print Data</button></div></header><div><table><thead><tr><th>Consumer No</th><th>Consumer Name</th><th>Mobile No</th><th>Delivery Area</th><th>Last Refill Date</th><th>Days Since Refill</th><th>Booking Source</th></tr></thead><tbody>{visibleRefillRows.map((row, index) => { const bucket = refillBucketForRow(row); return <tr key={`${row['Consumer No']}-${index}`}><td>{row['Consumer No'] || '—'}</td><td>{row['Consumer Name'] || '—'}</td><td>{row['Mobile No'] || '—'}</td><td>{row['Delivery Area'] || '—'}</td><td>{formatConsumerDate(row.LastRefillDate)}</td><td>{bucket.days ?? '—'}</td><td>{row['Last Refill BookingSource'] || '—'}</td></tr>; })}</tbody></table></div><footer><span>Page {page} of {refillTotalPages}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page >= refillTotalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer></div>
      </section> : <>
        <div className="consumer-db__table-wrap"><table><thead><tr>{CONSUMER_COLUMNS.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{visibleRows.map((row, index) => <tr key={`${row['Consumer No']}-${index}`}>{CONSUMER_COLUMNS.map((column) => <td key={column}>{row[column] || '—'}</td>)}</tr>)}</tbody></table>{!loading && !visibleRows.length && <div className="consumer-db__empty">Consumer data उपलब्ध नहीं है। Total Consumer Excel upload करें।</div>}{loading && <div className="consumer-db__empty">Cloud database load हो रहा है…</div>}</div>
        <footer><span>Page {page} of {totalPages}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer>
      </>}
    </main>
  </div>;
};

export default ConsumerDatabasePage;
