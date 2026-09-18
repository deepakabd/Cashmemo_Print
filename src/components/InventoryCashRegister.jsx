import { useRef, useState } from 'react';
import { indiaDate } from '../utils/invoiceAccounting';
import { printRegisterBill } from '../utils/registerBill';
import { defaultCommands } from '../utils/workspaceCommands';

const quantities = ['filledGoes14', 'emptyIn14', 'filledGoes19', 'emptyIn19'];
const labels = ['Filled Goes', 'Empty In'];
function ActionIcon({ action }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {action === 'modify' && <><path d="m16 3 5 5-12 12-6 1 1-6Z" /><path d="m14 5 5 5" /></>}
    {action === 'delete' && <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>}
    {action === 'paid' && <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>}
    {action === 'unpaid' && <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>}
    {action === 'print' && <><path d="M6 9V3h12v6M6 17H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" /><path d="M6 14h12v7H6zM17 12h1" /></>}
  </svg>;
}
const columns = [
  ['date', 'Date'], ['name', 'Name'], ['village', 'Panchayat / Village'], ['contact', 'Contact'],
  ['filledGoes14', 'Filled Goes', '14.2KG Filled Goes'], ['emptyIn14', 'Empty In', '14.2KG Empty In'],
  ['filledGoes19', 'Filled Goes', '19KG Filled Goes'], ['emptyIn19', 'Empty In', '19KG Empty In'],
  ['totalAmount', 'Total Amount'], ['paidAmount', 'Paid Amount'], ['duesAmount', 'Dues Amount'], ['remark', 'Remark'],
];
const numericColumns = [...quantities, 'totalAmount', 'paidAmount', 'duesAmount'];
const periods = ['All Time', 'Today', 'Yesterday', 'This Week', 'Last 7 Days', 'This Month', 'Last Month', 'This Financial Year', 'Custom'];
const blank = () => ({ date: indiaDate(), name: '', village: '', contact: '', remark: '', ...Object.fromEntries(quantities.map((key) => [key, ''])), rate14: '', rate19: '', paidAmount: '' });
const money = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const cylinderRate = (rates, size) => {
  const matching = rates.filter((row) => new RegExp(`^${size.replace('.', '\\.')}\\s*KG\\b`, 'i').test(String(row.Item || '').trim()) && /CYLINDER/i.test(row.Item));
  const product = matching.find((row) => size === '14.2' ? /NON-SUBSIDIZED CYLINDER$/i.test(row.Item.trim()) : /FILLED LPG CYLINDER$/i.test(row.Item.trim())) || matching[0];
  const value = Number(product?.RSP);
  return product && Number.isFinite(value) && value >= 0 ? value : '';
};

export default function InventoryCashRegister({ records, disabled, mutate, onSaved, rates = [], dealer, bank, commands = defaultCommands, view = 'entry' }) {
  const showActions = commands.registerActions;
  const showPrintBill = commands.registerPrintBill;
  const showRemark = commands.registerRemark;
  const visibleColumns = columns.filter(([key]) => key !== 'remark' || showRemark);
  const columnCount = visibleColumns.length + Number(showActions) + Number(showPrintBill);
  const [draft, setDraft] = useState(blank);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [period, setPeriod] = useState('All Time');
  const changePeriod = (value) => {
    setPeriod(value);
    if (value === 'Custom') return;
    if (value === 'All Time') { setFrom(''); setTo(''); return; }
    const today = indiaDate();
    const [year, month, day] = today.split('-').map(Number);
    const date = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
    let start = today;
    let end = today;
    if (value === 'Yesterday') start = end = date(year, month, day - 1);
    if (value === 'Last 7 Days') start = date(year, month, day - 6);
    if (value === 'This Week') start = date(year, month, day - (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7);
    if (value === 'This Month') start = date(year, month, 1);
    if (value === 'Last Month') { start = date(year, month - 1, 1); end = date(year, month, 0); }
    if (value === 'This Financial Year') start = date(month >= 4 ? year : year - 1, 4, 1);
    setFrom(start); setTo(end);
  };
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [sort, setSort] = useState(null);
  const [filters, setFilters] = useState({});
  const [filterColumn, setFilterColumn] = useState('name');
  const setFilter = (key, field, value) => setFilters((previous) => ({ ...previous, [key]: { ...previous[key], [field]: value } }));
  const id = useRef(crypto.randomUUID());
  const reportTable = useRef(null);
  const reportSummary = useRef(null);
  const change = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  const rate14 = cylinderRate(rates, '14.2');
  const rate19 = cylinderRate(rates, '19');
  const missingRate = (Number(draft.filledGoes14) > 0 && rate14 === '') || (Number(draft.filledGoes19) > 0 && rate19 === '');
  const totalAmount = Math.round((Number(draft.filledGoes14 || 0) * Number(rate14 || 0) + Number(draft.filledGoes19 || 0) * Number(rate19 || 0)) * 100) / 100;
  const rows = records.filter((row) => !row.deleted && (!from || row.date >= from) && (!to || row.date <= to) && [row.name, row.village, row.contact, row.remark].join(' ').toLowerCase().includes(search.trim().toLowerCase()) && Object.entries(filters).every(([key, filter]) => numericColumns.includes(key)
    ? ((filter.min === '' || filter.min === undefined || Number(row[key] || 0) >= Number(filter.min)) && (filter.max === '' || filter.max === undefined || Number(row[key] || 0) <= Number(filter.max)))
    : String(row[key] || '').toLowerCase().includes(String(filter.text || '').trim().toLowerCase())))
    .sort((a, b) => {
      const fallback = b.date.localeCompare(a.date) || String(b.recordedAt).localeCompare(String(a.recordedAt));
      if (!sort) return fallback;
      const comparison = numericColumns.includes(sort.key) ? Number(a[sort.key] || 0) - Number(b[sort.key] || 0) : String(a[sort.key] || '').localeCompare(String(b[sort.key] || ''), 'en', { numeric: true, sensitivity: 'base' });
      return comparison * (sort.direction === 'asc' ? 1 : -1) || fallback;
    });
  const totals = rows.reduce((sum, row) => { [...quantities, 'totalAmount', 'paidAmount', 'duesAmount'].forEach((key) => { sum[key] += Number(row[key] || 0); }); return sum; }, Object.fromEntries([...quantities, 'totalAmount', 'paidAmount', 'duesAmount'].map((key) => [key, 0])));
  const printReport = () => {
    setError('');
    const popup = window.open('', '_blank');
    if (!popup) { setError('Allow pop-ups to print the report.'); return; }
    const table = reportTable.current.cloneNode(true);
    table.querySelectorAll('tr').forEach((row) => {
      if (row.cells.length === 1) { row.cells[0].colSpan = visibleColumns.length; return; }
      if (showPrintBill) row.deleteCell(-1);
      if (showActions) row.deleteCell(-1);
    });
    const heading = document.createElement('header');
    const title = document.createElement('h1'); title.textContent = 'Inventory & Cash Register Report'; heading.append(title);
    const details = document.createElement('p'); details.textContent = `${dealer?.name || 'LPG CashMemo'} | Period: ${period} | ${from || 'All dates'}${to ? ` to ${to}` : ''} | ${rows.length} entries`; heading.append(details);
    if (search.trim()) { const note = document.createElement('p'); note.textContent = `Search: ${search.trim()}`; heading.append(note); }
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Inventory &amp; Cash Register Report</title><style>
      @page { size: A4 landscape; margin: 8mm; }
      body { margin: 0; font: 11px Arial, sans-serif; color: #303241; }
      h1 { font-size: 20px; margin: 0 0 8px; } header { margin-bottom: 16px; } p { margin: 6px 0; }
      .inventory-register__summary { display: flex; gap: 14px; margin-bottom: 18px; }
      .inventory-register__summary > div { flex: 1; padding: 12px; border: 1px solid #ccc; border-radius: 6px; }
      .inventory-register__summary span, .inventory-register__summary strong, .inventory-register__summary small { display: block; }
      .inventory-register__summary strong { font-size: 20px; margin: 6px 0; } .inventory-register__summary small { font-size: 10px; color: #666; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
      th, td { border: 1px solid #bbb; padding: 7px 5px; text-align: center; overflow-wrap: anywhere; }
      th { background: #fff5bd; } tfoot { font-weight: bold; background: #edf6e7; } thead { display: table-header-group; } tfoot { display: table-row-group; }
      tbody td:nth-child(2), tbody td:nth-child(3), tbody td:nth-child(12) { text-align: left; }
      tbody td:nth-child(9), tbody td:nth-child(10), tbody td:nth-child(11) { text-align: right; }
      tr { break-inside: avoid; } * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    </style></head><body>${heading.outerHTML}${reportSummary.current.outerHTML}${table.outerHTML}</body></html>`);
    popup.document.close();
    let printed = false;
    const print = async () => { if (printed) return; printed = true; await popup.document.fonts?.ready; popup.focus(); popup.print(); };
    popup.addEventListener('load', print, { once: true });
    if (popup.document.readyState === 'complete') void print();
  };
  const save = async (event) => {
    event.preventDefault(); setError('');
    if (missingRate) { setError('Save the cylinder rates in Rate Update before saving this entry.'); return; }
    if (Number(draft.paidAmount) > totalAmount) { setError('Paid amount cannot exceed total amount.'); return; }
    const entry = { ...draft, id: id.current, totalAmount, rate14: Number(rate14 || 0), rate19: Number(rate19 || 0), ...Object.fromEntries([...quantities, 'paidAmount'].map((key) => [key, Number(draft[key] || 0)])) };
    const saved = await mutate({ mode: editing ? 'inventoryEdit' : 'inventoryEntry', version: editing?.version || 0, entry });
    if (saved) { onSaved(saved); id.current = crypto.randomUUID(); setDraft(blank()); setEditing(null); }
  };
  const act = async (row, mode) => {
    const saved = await mutate({ mode, id: row.id, version: row.version || 0 });
    if (saved) { onSaved(saved); setDeleting(null); }
  };
  const modify = (row) => { setEditing(row); setDraft({ ...blank(), ...row }); id.current = row.id; setError(''); setDeleting(null); };
  return <div className="inventory-register">
    {(view === 'entry' || editing) && <section className="invoice-workspace__card inventory-register__entry-card">
      <h3>{editing ? 'Modify Register Entry' : 'Entry Form'}</h3>
      <form onSubmit={save}>
        <fieldset disabled={disabled} className="inventory-register__fieldset">
          <div className="invoice-workspace__form-grid inventory-register__customer-fields">
            <label>Entry Date<input required type="date" max={indiaDate()} value={draft.date} onChange={(event) => change('date', event.target.value)} /></label>
            { [['name', 'Name'], ['village', 'Panchayat / Village'], ['contact', 'Contact'], ['remark', 'Remark']].map(([key, label]) => <label key={key}>{label}<input required={key === 'name'} type={key === 'contact' ? 'tel' : 'text'} maxLength={key === 'contact' ? 10 : 500} pattern={key === 'contact' ? '[0-9]{10}' : undefined} value={draft[key]} onChange={(event) => change(key, event.target.value)} /></label>) }
          </div>
          <div className="inventory-register__groups">{['14.2KG', '19KG'].map((size, index) => <fieldset key={size}><legend>{size}</legend><div className="invoice-workspace__form-grid">{quantities.slice(index * 2, index * 2 + 2).map((key, column) => <label key={key}>{size} {labels[column]}<input type="number" min="0" max="1000000" step="1" value={draft[key]} onChange={(event) => change(key, event.target.value)} /></label>)}<label>{size} Rate<input aria-label={`${size} Rate`} type="number" readOnly value={index === 0 ? rate14 : rate19} placeholder="Set in Rate Update" /><small>Fetched from Rate Update (RSP)</small></label></div></fieldset>)}</div>
          <div className="invoice-workspace__form-grid inventory-register__amount-fields">
            <label>Total Amount<input type="number" readOnly value={totalAmount} /></label>
            <label>Paid Amount<input type="number" min="0" max={totalAmount} step="0.01" value={draft.paidAmount} onChange={(event) => change('paidAmount', event.target.value)} /></label>
            <label>Dues Amount<output className="inventory-register__dues">{money(Math.round((totalAmount - Number(draft.paidAmount || 0)) * 100) / 100)}</output></label>
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="inventory-register__form-actions">
          <button type="submit" className="invoice-workspace__primary">{editing ? 'Save Changes' : 'Save Register Entry'}</button>
          <button type="button" onClick={() => { setEditing(null); setDraft(blank()); id.current = crypto.randomUUID(); setError(''); }}>{editing ? 'Cancel Modify' : 'Cancel'}</button>
          </div>
        </fieldset>
      </form>
    </section>}
    {view === 'report' && <section className="invoice-workspace__card">
      <h3>Inventory & Cash Register Report</h3>
      {error && <p role="alert">{error}</p>}
      <div ref={reportSummary} className="inventory-register__summary" aria-label="Register dues summary">
        <div><span>14.2KG Due</span><strong>{money(Math.max(0, totals.filledGoes14 - totals.emptyIn14))}</strong><small>Filled Goes − Empty In</small></div>
        <div><span>19KG Due</span><strong>{money(Math.max(0, totals.filledGoes19 - totals.emptyIn19))}</strong><small>Filled Goes − Empty In</small></div>
        <div><span>Amount Due</span><strong>₹{money(totals.duesAmount)}</strong><small>Total Amount − Paid Amount</small></div>
      </div>
      {deleting && <div role="alert" className="invoice-billing-error">Move entry for {deleting.name} to Bin? <button type="button" disabled={disabled} onClick={() => void act(deleting, 'inventoryDelete')}>Confirm Delete</button> <button type="button" disabled={disabled} onClick={() => setDeleting(null)}>Cancel Delete</button></div>}
      <div className="invoice-workspace__filters"><label>Period<select value={period} onChange={(event) => changePeriod(event.target.value)}>{periods.map((value) => <option key={value}>{value}</option>)}</select></label><label>Report From<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPeriod('Custom'); }} /></label><label>Report To<input type="date" min={from} value={to} onChange={(event) => { setTo(event.target.value); setPeriod('Custom'); }} /></label><button type="button" onClick={() => { setSearch(''); setPeriod('All Time'); setFrom(''); setTo(''); setSort(null); setFilters({}); setFilterColumn('name'); }}>Clear</button>{commands.registerPrintReport && <button type="button" disabled={!rows.length} onClick={printReport}>Print Report</button>}</div>
      <div className="inventory-register__report-controls">
      <div className="inventory-register__column-filter" role="group" aria-label="Sorting options">
        <label>Search register<input value={search} placeholder="Name, village, contact or remark" onChange={(event) => setSearch(event.target.value)} /></label><label>Sort column<select value={sort?.key || ''} onChange={(event) => setSort(event.target.value ? { key: event.target.value, direction: sort?.direction || 'asc' } : null)}><option value="">Entry Date (Newest First)</option>{columns.map(([key, label, fullLabel]) => <option key={key} value={key}>{fullLabel || label}</option>)}</select></label>
        <label>Sort order<select disabled={!sort} value={sort?.direction || 'asc'} onChange={(event) => setSort((previous) => ({ ...previous, direction: event.target.value }))}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
        <label>Filter column<select value={filterColumn} onChange={(event) => setFilterColumn(event.target.value)}>{columns.map(([key, label, fullLabel]) => <option key={key} value={key}>{fullLabel || label}</option>)}</select></label>
        {numericColumns.includes(filterColumn) ? <>
          <label>Minimum<input type="number" min="0" step="any" value={filters[filterColumn]?.min || ''} onChange={(event) => setFilter(filterColumn, 'min', event.target.value)} /></label>
          <label>Maximum<input type="number" min="0" step="any" value={filters[filterColumn]?.max || ''} onChange={(event) => setFilter(filterColumn, 'max', event.target.value)} /></label>
        </> : <label>Contains<input type="text" value={filters[filterColumn]?.text || ''} onChange={(event) => setFilter(filterColumn, 'text', event.target.value)} /></label>}
      </div>
      </div>
      <div className="invoice-workspace__table-scroll"><table ref={reportTable} className="inventory-register__table" aria-label="Inventory and cash register report">
        <thead><tr>{visibleColumns.map(([key, label, fullLabel]) => <th key={key} scope="col" aria-sort={sort?.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
          {fullLabel || label}
        </th>)}{showActions && <th scope="col">Actions</th>}{showPrintBill && <th scope="col">Print Bill</th>}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.name}</td><td>{row.village}</td><td>{row.contact}</td>{quantities.map((key) => <td key={key} className={key.includes('Goes') ? 'inventory-register__goes' : ''}>{row[key] || ''}</td>)}{['totalAmount', 'paidAmount', 'duesAmount'].map((key) => <td key={key}>{money(row[key])}</td>)}{showRemark && <td className="inventory-register__remark">{row.remark}</td>}{showActions && <td className="inventory-register__actions"><div className="inventory-register__action-buttons">{commands.registerModify && <button type="button" disabled={disabled || Boolean(editing)} aria-label="Modify" title="Modify" onClick={() => modify(row)}><ActionIcon action="modify" /></button>}{commands.registerDelete && <button type="button" disabled={disabled || Boolean(editing)} aria-label="Delete" title="Delete" onClick={() => setDeleting(row)}><ActionIcon action="delete" /></button>}{commands.registerPaid && <button type="button" disabled={disabled || Boolean(editing) || row.paidAmount === row.totalAmount} aria-label="Mark Paid" title="Mark Paid" onClick={() => void act(row, 'inventoryPaid')}><ActionIcon action="paid" /></button>}{commands.registerUnpaid && <button type="button" disabled={disabled || Boolean(editing) || !row.paidAmount} aria-label="Mark Unpaid" title="Mark Unpaid" onClick={() => void act(row, 'inventoryUnpaid')}><ActionIcon action="unpaid" /></button>}</div></td>}{showPrintBill && <td><button type="button" className="inventory-register__print-button" aria-label="Print Bill" title="Print Bill" disabled={Boolean(editing) || !(Number(row.filledGoes14) > 0 || Number(row.filledGoes19) > 0)} onClick={() => { setError(''); if (!printRegisterBill(row, dealer, rates, bank)) setError('Allow pop-ups to print the bill.'); }}><ActionIcon action="print" /></button></td>}</tr>)}{!rows.length && <tr><td colSpan={columnCount}>No register entries found.</td></tr>}</tbody>
        <tfoot><tr><th colSpan={4}>TOTAL ({rows.length} entries)</th>{[...quantities, 'totalAmount', 'paidAmount', 'duesAmount'].map((key) => <td key={key}>{money(totals[key])}</td>)}{showRemark && <td />}{showActions && <td />}{showPrintBill && <td />}</tr></tfoot>
      </table></div>
    </section>}
  </div>;
}

















