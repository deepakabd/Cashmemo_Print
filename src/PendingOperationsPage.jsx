import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { loadOperationalData, loadOperationalMetadata, saveOperationalData } from './services/operationalDataRepository';
import './PendingOperationsPage.css';

const PENDING_EKYC_COLUMNS = ['ConsumerType', 'LPGID', 'Consumerno', 'ConsumerName', 'DeliveryArea', 'MobileNo', 'AlternateMobileNo', 'Packagecode', 'No. of Refills in Current FY (equiv to 14.2kg)', 'ConsumerAddress', 'LastRefillDate', 'LastRefillSource', 'Having Aadhaar'];
const PENDING_MI_COLUMNS = ['UniqueConsumerId', 'ConsumerNo', 'ConsumerName', 'MobileNo', 'DistributorId', 'Address', 'AreaName', 'lastInspDate', 'AreaRefNo', 'SelectedDistId'];

const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = { consumernumber: ['Consumerno', 'ConsumerNo'], consumerno: ['Consumerno', 'ConsumerNo'], lpgid: ['LPGID'], mobile: ['MobileNo'], mobileno: ['MobileNo'], consumername: ['ConsumerName'], deliveryarea: ['DeliveryArea', 'AreaName'], areaname: ['AreaName', 'DeliveryArea'], linkeddeliveryman: ['LinkedDeliveryman'] };
const formatRecordDate = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const validDate = (year, month, day) => {
    const candidate = new Date(year, month - 1, day);
    return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day ? candidate : null;
  };
  const serial = Number(text);
  let date = null;
  if (/^\d{5}(?:\.\d+)?$/.test(text) && serial >= 20000 && serial <= 100000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
    date = validDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  } else {
    const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    const indian = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})/);
    if (iso) date = validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    else if (indian) {
      const shortYear = Number(indian[3]);
      const year = indian[3].length === 2 ? (shortYear >= 70 ? 1900 + shortYear : 2000 + shortYear) : shortYear;
      const first = Number(indian[1]);
      const second = Number(indian[2]);
      date = second > 12 && first <= 12 ? validDate(year, first, second) : validDate(year, second, first);
    } else {
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
  }
  if (!date || Number.isNaN(date.getTime())) return text;
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
};
const normalizeRows = (input, columns) => {
  const headerMap = new Map(columns.map((column) => [clean(column), column]));
  Object.entries(aliases).forEach(([key, values]) => {
    const matchingColumn = values.find((value) => columns.includes(value));
    if (matchingColumn) headerMap.set(key, matchingColumn);
  });
  return input.map((source) => {
    const row = Object.fromEntries(columns.map((column) => [column, '']));
    Object.entries(source || {}).forEach(([key, value]) => {
      const column = headerMap.get(clean(key));
      if (column) row[column] = column === 'LastRefillDate' ? formatRecordDate(value) : (value == null ? '' : String(value).trim());
    });
    return row;
  }).filter((row) => row.Consumerno || row.ConsumerNo || row.LPGID || row.UniqueConsumerId || row.ConsumerName);
};
const formatTime = (value) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not uploaded yet';
const hasRegisteredMobile = (value) => String(value || '').replace(/\D/g, '').length >= 10;
const distribution = (rows, field, limit = 7) => {
  const counts = new Map();
  rows.forEach((row) => {
    const label = String(row[field] || '').trim() || 'Not Available';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const sorted = [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  if (sorted.length <= limit) return sorted;
  return [...sorted.slice(0, limit), { label: 'Others', count: sorted.slice(limit).reduce((sum, item) => sum + item.count, 0) }];
};
const PendingChart = ({ title, items, total }) => <article className="pending-ops__chart">
  <header><div><span>ANALYSIS</span><h3>{title}</h3></div><strong>{total.toLocaleString('en-IN')}</strong></header>
  <div className="pending-ops__chart-body">{items.map((item, index) => {
    const percent = total ? Math.round(item.count / total * 100) : 0;
    return <div className="pending-ops__chart-row" key={item.label}><div><span title={item.label}>{item.label}</span><b>{item.count.toLocaleString('en-IN')} <small>{percent}%</small></b></div><div><i style={{ width: `${percent}%`, '--chart-color': ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b', '#ec4899'][index % 8] }} /></div></div>;
  })}{!items.length && <p className="pending-ops__chart-empty">Upload data to view this chart.</p>}</div>
</article>;

export default function PendingOperationsPage({ loggedInUser, onClose, dataType }) {
  const isEkyc = dataType === 'pendingEkyc';
  const title = isEkyc ? 'Pending eKYC' : 'Pending MI';
  const columns = isEkyc ? PENDING_EKYC_COLUMNS : PENDING_MI_COLUMNS;
  const storageKey = `pending-workspace-columns:v3:${dataType}:${loggedInUser?.id || 'default'}`;
  const [rows, setRows] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [view, setView] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!Array.isArray(saved) || saved.some((column) => !columns.includes(column))) return columns;
      return saved.length ? saved : columns;
    } catch { return columns; }
  });
  const fileRef = useRef(null);
  const query = useDeferredValue(search.trim().toLowerCase());

  const applySnapshot = (snapshot) => {
    if (!snapshot) return;
    setRows(normalizeRows(snapshot.rows || [], columns));
    setMetadata(snapshot.metadata || null);
  };
  const sync = async (force = false) => {
    setBusy(true); setMessage('');
    try {
      const remote = await loadOperationalMetadata(loggedInUser?.id, dataType);
      if (!force && remote?.uploadId && remote.uploadId === metadata?.uploadId) setMessage('Already up to date.');
      else if (remote) { applySnapshot(await loadOperationalData(loggedInUser?.id, dataType)); setMessage('Quick sync complete.'); }
      else setMessage('No uploaded data found.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  // A workspace/user switch must fetch its snapshot; sync is intentionally not a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { sync(true); }, [dataType, loggedInUser?.id]);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(visibleColumns)); }, [storageKey, visibleColumns]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setMessage('Reading file...'); setProgress(0);
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const raw = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '', raw: false });
      const normalized = normalizeRows(raw, columns);
      if (!normalized.length) throw new Error('Valid rows nahi mili. Column headings check karein.');
      const uploadedAt = new Date().toISOString();
      await saveOperationalData(loggedInUser?.id, dataType, normalized, { fileName: file.name, uploadedAt }, (done, total) => setProgress(Math.round(done / total * 100)));
      applySnapshot(await loadOperationalData(loggedInUser?.id, dataType));
      setView('records'); setMessage(`${normalized.length.toLocaleString('en-IN')} rows uploaded and synced.`);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  const filtered = useMemo(() => !query ? rows : rows.filter((row) => columns.some((column) => String(row[column] || '').toLowerCase().includes(query))), [rows, query, columns]);
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const areaCount = useMemo(() => new Set(rows.map((r) => isEkyc ? r.DeliveryArea : r.AreaName).filter(Boolean)).size, [rows, isEkyc]);
  const staffCount = useMemo(() => isEkyc ? rows.filter((r) => hasRegisteredMobile(r.MobileNo)).length : new Set(rows.map((r) => r.DistributorId).filter(Boolean)).size, [rows, isEkyc]);
  const aadhaarCount = isEkyc ? rows.filter((r) => /^(yes|y|true|available)$/i.test(r['Having Aadhaar'])).length : 0;
  const ekycCharts = useMemo(() => isEkyc ? [
    { title: 'Last Refill Source', items: distribution(rows, 'LastRefillSource') },
    { title: 'Having Aadhaar', items: distribution(rows, 'Having Aadhaar') },
    { title: 'Mobile Registration', items: [{ label: 'Registered', count: rows.filter((row) => hasRegisteredMobile(row.MobileNo)).length }, { label: 'Unregistered', count: rows.filter((row) => !hasRegisteredMobile(row.MobileNo)).length }] },
    { title: 'Consumer Type', items: distribution(rows, 'ConsumerType') },
  ] : [], [rows, isEkyc]);
  const miAreaChart = useMemo(() => !isEkyc ? distribution(rows, 'AreaName', 10) : [], [rows, isEkyc]);
  const toggleColumn = (column) => setVisibleColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column]);

  return <section className="pending-ops">
    <aside className="pending-ops__nav"><div className="pending-ops__brand"><span>{isEkyc ? '✓' : '⌁'}</span><div><small>Operations</small><strong>{title}</strong></div></div><nav>
      <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>▦ Dashboard</button>
      <button className={view === 'records' ? 'active' : ''} onClick={() => setView('records')}>☷ All Records</button>
      <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>⚙ Settings</button>
    </nav><button className="pending-ops__close" onClick={onClose}>← Close</button></aside>
    <main className="pending-ops__main"><header className="pending-ops__header"><div><small>Consumer Operations Workspace</small><h1>{title}</h1><p>Upload, review and cloud-sync pending consumer records.</p></div><div className="pending-ops__actions"><button onClick={() => sync(false)} disabled={busy}>↻ {busy ? 'Working...' : 'Quick Sync'}</button><button className="primary" onClick={() => fileRef.current?.click()} disabled={busy}>↑ Upload Excel / CSV</button><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={upload} hidden /></div></header>
      {message && <div className="pending-ops__message">{message}{progress > 0 && progress < 100 ? ` · ${progress}%` : ''}</div>}
      {view === 'dashboard' && <><div className="pending-ops__cards"><article><span>Total Pending</span><strong>{rows.length.toLocaleString('en-IN')}</strong><small>Uploaded records</small></article><article><span>Delivery Areas</span><strong>{areaCount}</strong><small>Unique areas</small></article><article><span>{isEkyc ? 'Registered Mobile' : 'Distributors'}</span><strong>{staffCount}</strong><small>{isEkyc ? 'Valid mobile numbers' : 'Unique distributor IDs'}</small></article><article><span>{isEkyc ? 'Having Aadhaar' : 'Inspection Due'}</span><strong>{isEkyc ? aadhaarCount : rows.length}</strong><small>Actionable consumers</small></article></div>{isEkyc && <div className="pending-ops__charts">{ekycCharts.map((chart) => <PendingChart key={chart.title} {...chart} total={rows.length} />)}</div>}{!isEkyc && <div className="pending-ops__charts pending-ops__charts--single"><PendingChart title="Area Name Wise Pending MI" items={miAreaChart} total={rows.length} /></div>}<div className="pending-ops__welcome"><div><span>LIVE DATA</span><h2>{rows.length ? `${title} dashboard is ready` : `Upload ${title} data to begin`}</h2><p>Excel aur CSV dono supported hain. Quick Sync sirf changed cloud snapshot ko download karta hai.</p></div><button onClick={() => setView('records')}>View Records →</button></div></>}
      {view === 'records' && <div className="pending-ops__panel"><div className="pending-ops__toolbar"><div><h2>{title} Records</h2><small>{filtered.length.toLocaleString('en-IN')} of {rows.length.toLocaleString('en-IN')} rows</small></div><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search consumer, ID, mobile..." /></div><div className="pending-ops__table-wrap"><table><thead><tr>{visibleColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{shown.length ? shown.map((row, index) => <tr key={`${row.UniqueConsumerId || row.LPGID}-${row.ConsumerNo || row.Consumerno}-${index}`}>{visibleColumns.map((column) => <td key={column}>{row[column] || '—'}</td>)}</tr>) : <tr><td colSpan={visibleColumns.length || 1} className="empty">No records found.</td></tr>}</tbody></table></div><footer className="pending-ops__pager"><span>Page {page} of {totalPages}</span><div><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button></div></footer></div>}
      {view === 'settings' && <div className="pending-ops__settings"><section><h2>Data & Sync</h2><dl><div><dt>Last uploaded</dt><dd>{formatTime(metadata?.uploadedAt)}</dd></div><div><dt>Source file</dt><dd>{metadata?.fileName || '—'}</dd></div><div><dt>Cloud rows</dt><dd>{rows.length.toLocaleString('en-IN')}</dd></div></dl><div className="pending-ops__setting-actions"><button className="primary" onClick={() => fileRef.current?.click()}>↻ Re-Upload Data</button><button onClick={() => sync(false)}>↻ Quick Sync</button></div></section><section><h2>Column Visibility</h2><p>Table me dikhne wale columns select karein.</p><div className="pending-ops__checks">{columns.map((column) => <label key={column}><input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => toggleColumn(column)} /> <span>{column}</span></label>)}</div></section></div>}
    </main>
  </section>;
}
