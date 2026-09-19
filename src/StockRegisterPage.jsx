import { useState, useEffect, useMemo } from 'react';
import { loadAttendanceData, loadAttendanceDataFromFirebase } from './attendanceStore';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import './StockRegisterPage.css';
import './GodownRegisterSheet.css';
import './GodownRegisterLogo.css';
import './StockRegisterEntryForm.css';

const GODOWN_IN_OUT_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'vehicleNumber', label: 'Vehicle Number' },
  { key: 'driverName', label: 'Driver Name' },
  { key: 'filledOut', label: '14.2KG Filled Out' },
  { key: 'filledIn', label: '14.2 KG Filled In' },
  { key: 'emptyIn', label: '14.2KG Empty In' },
  { key: 'totalSales', label: 'Total Sales' },
];

const STOCK_REGISTER_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'openingFilled', label: '14.2KG Opening Filled' },
  { key: 'receiveFilled', label: 'Receive Filled' },
  { key: 'totalFilled', label: 'Total Filled', calculated: true },
  { key: 'openingEmpty', label: 'Opening Empty' },
  { key: 'totalStockEF', label: 'Total Stock (E+F)', calculated: true },
  { key: 'refillSales', label: 'Refill Sales' },
  { key: 'connection', label: 'Connection' },
  { key: 'returnedEmpty', label: 'Returned Empty' },
  { key: 'surrender', label: 'Surrender' },
  { key: 'closingFilled', label: 'Closing Filled', calculated: true },
  { key: 'closingEmpty', label: 'Closing Empty', calculated: true },
  { key: 'totalStockClosing', label: 'Total Stock Closing', calculated: true },
  { key: 'difference', label: 'Any Difference', calculated: true },
];

const STOCK_PRODUCTS = [
  { key: 'kg14', label: '14.2KG' },
  { key: 'kg19', label: '19KG' },
  { key: 'kg5dom', label: '5KG DOM' },
  { key: 'kg5appu', label: '5KG APPU' },
  { key: 'regulator', label: 'REGULATOR' },
];

const DEFAULT_STOCK_PRODUCT_SETTINGS = Object.fromEntries(STOCK_PRODUCTS.map((product) => [product.key, product.key === 'kg14']));
const DEFAULT_STOCK_MAINTENANCE = {
  editLockDays: 7,
  resetAdminOnly: true,
  approvalRequired: false,
  products: Object.fromEntries(STOCK_PRODUCTS.map((product, index) => [product.key, {
    displayName: product.label,
    unit: product.key === 'regulator' ? 'Piece' : 'Cylinder',
    order: index + 1,
    openingFilled: '',
    openingEmpty: '',
    openingEffectiveDate: '',
    minimumStock: '',
    blockNegative: true,
    dailyRequired: false,
    autoCarryForward: true,
    differenceTolerance: 0,
    notes: '',
    archived: false,
  }]))
};

const mergeMaintenanceSettings = (saved = {}) => ({
  ...DEFAULT_STOCK_MAINTENANCE,
  ...saved,
  products: Object.fromEntries(STOCK_PRODUCTS.map((product) => [product.key, {
    ...DEFAULT_STOCK_MAINTENANCE.products[product.key],
    ...(saved.products?.[product.key] || {}),
  }])),
});
const numberValue = (value) => Number(value) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const newGodownRow = () => ({ id: crypto.randomUUID(), date: today(), vehicleNumber: '', driverName: '', filledOut: '', filledIn: '', emptyIn: '' });
const newStockRow = () => ({ id: crypto.randomUUID(), date: today(), openingFilled: '', receiveFilled: '', openingEmpty: '', refillSales: '', connection: '', returnedEmpty: '', surrender: '' });

const calculateGodownRow = (row) => {
  const totalSales = numberValue(row.filledOut) - numberValue(row.filledIn);
  return { ...row, totalSales, difference: numberValue(row.filledOut) - numberValue(row.filledIn) - numberValue(row.emptyIn) };
};
const calculateStockRow = (row) => {
  const totalFilled = numberValue(row.openingFilled) + numberValue(row.receiveFilled);
  const closingFilled = totalFilled - numberValue(row.refillSales) - numberValue(row.connection);
  const closingEmpty = numberValue(row.openingEmpty) + numberValue(row.refillSales) + numberValue(row.connection) - numberValue(row.returnedEmpty) + numberValue(row.surrender);
  const totalStockEF = totalFilled + numberValue(row.openingEmpty);
  const totalStockClosing = closingFilled + closingEmpty;
  return { ...row, totalFilled, totalStockEF, closingFilled, closingEmpty, totalStockClosing, difference: totalStockEF - totalStockClosing - numberValue(row.returnedEmpty) };
};

const readProductStock = (row, productKey) => {
  if (productKey === 'kg14') return row || {};
  return row?.productStocks?.[productKey] || {};
};

const calculateProductStock = (row, productKey) => calculateStockRow(readProductStock(row, productKey));

function GodownRegisterSheet({ rows, vehicleNumbers, deliverymen, updateRow, deleteRow, onAddRow, selectedDate, setSelectedDate, dailyStock, onDailyStockChange, onSave, onEdit, onReset, agencyName, editable }) {
  const total = (key) => rows.reduce((sum, row) => sum + numberValue(row[key]), 0);
  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN');
  const totalFilled = numberValue(dailyStock.filled) + numberValue(dailyStock.receive);
  const totalStock = totalFilled + numberValue(dailyStock.empty);
  const remainingFilled = totalFilled - total('filledOut');
  const remainingEmpty = numberValue(dailyStock.empty) + total('emptyIn');
  return <section className={`godown-sheet${editable ? '' : ' godown-sheet--locked'}`}>
    <header className="godown-sheet__header"><img className="godown-sheet__logo" src="/idlogo.jpg" alt="Agency logo" /><div><h1>गोदाम आगमन - निर्गमन पंजिका</h1><p>{agencyName}</p><small>Godown In-Out Register</small></div><img className="godown-sheet__logo" src="/idlogo.jpg" alt="Agency logo" /></header>
    <div className="godown-sheet__meta"><strong>दिनांक: {dateLabel}</strong><label className="no-print">दिनांक चुनें <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label></div>
    <table className="godown-sheet__summary"><caption>गोदाम के अंदर सिलेंडर का स्टॉक</caption><thead><tr><th>सिलेंडर का प्रकार</th><th>भरा (Filled)</th><th>रिसीव (Receive)</th><th>कुल भरा (Total Filled)</th><th>खाली (Empty)</th><th>कुल स्टॉक (Total Stock)</th></tr></thead><tbody><tr><th>14.2Kg</th><td><input className="godown-sheet__stock-input" type="number" min="0" value={dailyStock.filled} onChange={(event) => onDailyStockChange('filled', event.target.value)} placeholder="0" /></td><td><input className="godown-sheet__stock-input" type="number" min="0" value={dailyStock.receive} onChange={(event) => onDailyStockChange('receive', event.target.value)} placeholder="0" /></td><td><strong>{totalFilled}</strong></td><td><input className="godown-sheet__stock-input" type="number" min="0" value={dailyStock.empty} onChange={(event) => onDailyStockChange('empty', event.target.value)} placeholder="0" /></td><td><strong>{totalStock}</strong></td></tr></tbody></table>
    <div className="godown-sheet__table-title">सुबह को डिलीवरी गाड़ी पर निकली हुई सिलिंडर की संख्या (गाड़ी क्रमांक के साथ)</div>
    <div className="godown-sheet__table-wrap"><table className="godown-sheet__entries"><thead><tr><th>क्र.</th><th>वाहन क्रमांक</th><th>डिलीवरीमैन का नाम</th><th>14.2Kg भरा आउट</th><th>14.2Kg भरा इन</th><th>14.2Kg खाली इन</th><th>कुल बिक्री</th><th>अंतर (Difference)</th><th className="no-print">Action</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><input list="godown-sheet-vehicles" value={row.vehicleNumber} onChange={(event) => updateRow(row.id, 'vehicleNumber', event.target.value)} placeholder="वाहन संख्या" /><datalist id="godown-sheet-vehicles">{vehicleNumbers.map((number) => <option key={number} value={number} />)}</datalist></td><td><input list="godown-sheet-deliverymen" value={row.driverName} onChange={(event) => updateRow(row.id, 'driverName', event.target.value)} placeholder="नाम दर्ज करें" /><datalist id="godown-sheet-deliverymen">{deliverymen.map((name) => <option key={name} value={name} />)}</datalist></td>{['filledOut', 'filledIn', 'emptyIn'].map((key) => <td key={key}><input type="number" min="0" value={row[key]} onChange={(event) => updateRow(row.id, key, event.target.value)} placeholder="0" /></td>)}<td><strong>{numberValue(row.totalSales)}</strong></td><td><strong>{numberValue(row.difference)}</strong></td><td className="no-print"><button type="button" onClick={() => deleteRow(row.id)}>हटाएं</button></td></tr>) : <tr><td colSpan="9" className="godown-sheet__empty">इस दिन के लिए कोई entry नहीं है। “Add Entry” से शुरू करें।</td></tr>}</tbody>{rows.length > 0 && <tfoot><tr><th colSpan="3">कुल</th><th>{total('filledOut')}</th><th>{total('filledIn')}</th><th>{total('emptyIn')}</th><th>{total('totalSales')}</th><th>{total('difference')}</th><th className="no-print" /></tr></tfoot>}</table></div>
    <div className="godown-sheet__footer"><div><strong>शेष बचे भरे सिलिंडर </strong><span>{remainingFilled}</span></div><div><strong>खाली कुल सिलेंडर</strong><span>{remainingEmpty}</span></div><div><strong>कुल बिक्री</strong><span>{total('totalSales')}</span></div><div><strong>गोदाम कीपर का हस्ताक्षर</strong><span></span></div></div>
    <div className="godown-sheet__actions no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}><button type="button" className="stock-register-add" onClick={onAddRow} disabled={!editable}>+ Add Entry</button><button type="button" className="stock-register-print" onClick={onSave} disabled={!editable}>Save Entry</button><button type="button" className="stock-register-print" onClick={onEdit} disabled={editable}>Edit</button><button type="button" className="godown-sheet__reset" onClick={onReset} disabled={!editable}>Reset</button><button type="button" className="stock-register-print" onClick={() => window.print()}>Print</button></div>
  </section>;
}

function GodownInOutReport({ rows, reportDate, setReportDate, agencyName, dailyStock }) {
  const total = (key) => rows.reduce((sum, row) => sum + numberValue(row[key]), 0);
  const filled = numberValue(dailyStock?.filled);
  const receive = numberValue(dailyStock?.receive);
  const empty = numberValue(dailyStock?.empty);
  const totalFilled = filled + receive;
  const totalStock = totalFilled + empty;
  return <section className="godown-sheet godown-sheet--report"><header className="godown-sheet__header"><img className="godown-sheet__logo" src="/idlogo.jpg" alt="Agency logo" /><div><h1>गोदाम आगमन - निर्गमन रिपोर्ट</h1><p>{agencyName}</p><small>Godown In-Out Report</small></div><img className="godown-sheet__logo" src="/idlogo.jpg" alt="Agency logo" /></header><div className="godown-sheet__meta"><strong>दिनांक: {new Date(`${reportDate}T12:00:00`).toLocaleDateString('en-IN')}</strong><label className="no-print">रिपोर्ट दिनांक <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label><button type="button" className="stock-register-print no-print" onClick={() => window.print()}>Print</button><button type="button" className="stock-register-delete no-print" onClick={() => setReportDate(today())}>Reset</button></div><table className="godown-sheet__summary"><caption>गोदाम के अंदर सिलेंडर का स्टॉक</caption><thead><tr><th>सिलेंडर का प्रकार</th><th>भरा (Filled)</th><th>रिसीव (Receive)</th><th>कुल भरा (Total Filled)</th><th>खाली (Empty)</th><th>कुल स्टॉक (Total Stock)</th></tr></thead><tbody><tr><th>14.2Kg</th><td>{filled}</td><td>{receive}</td><td><strong>{totalFilled}</strong></td><td>{empty}</td><td><strong>{totalStock}</strong></td></tr></tbody></table><div className="godown-sheet__table-title">वाहन एवं डिलीवरीमैन अनुसार दैनिक सिलेंडर विवरण</div><div className="godown-sheet__table-wrap"><table className="godown-sheet__entries"><thead><tr><th>क्र.</th><th>वाहन क्रमांक</th><th>डिलीवरीमैन का नाम</th><th>भरा आउट</th><th>भरा इन</th><th>खाली इन</th><th>कुल बिक्री</th><th>अंतर</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.vehicleNumber || '—'}</td><td>{row.driverName || '—'}</td><td>{numberValue(row.filledOut)}</td><td>{numberValue(row.filledIn)}</td><td>{numberValue(row.emptyIn)}</td><td>{numberValue(row.totalSales)}</td><td>{numberValue(row.difference)}</td></tr>) : <tr><td colSpan="8" className="godown-sheet__empty">चुनी हुई तारीख के लिए कोई entry नहीं है।</td></tr>}</tbody>{rows.length > 0 && <tfoot><tr><th colSpan="3">कुल</th><th>{total('filledOut')}</th><th>{total('filledIn')}</th><th>{total('emptyIn')}</th><th>{total('totalSales')}</th><th>{total('difference')}</th></tr></tfoot>}</table></div></section>;
}

function GodownReportClosingSummary({ rows, dailyStock }) {
  const total = (key) => rows.reduce((sum, row) => sum + numberValue(row[key]), 0);
  const totalFilled = numberValue(dailyStock?.filled) + numberValue(dailyStock?.receive);
  const remainingFilled = totalFilled - total('filledOut');
  const remainingEmpty = numberValue(dailyStock?.empty) + total('emptyIn');
  return <div className="godown-sheet__footer godown-report-closing-summary"><div><strong>शेष बचे भरे सिलिंडर</strong><span>{remainingFilled}</span></div><div><strong>खाली कुल सिलेंडर</strong><span>{remainingEmpty}</span></div><div><strong>कुल बिक्री</strong><span>{total('totalSales')}</span></div><div><strong>गोदाम कीपर का हस्ताक्षर</strong><span /></div></div>;
}

function StockReport({ rows, reportMonth, setReportMonth, agencyName, enabledProducts }) {
  const [selectedProduct, setSelectedProduct] = useState(() => enabledProducts[0]?.key || '');
  useEffect(() => {
    if (!enabledProducts.some((product) => product.key === selectedProduct)) {
      setSelectedProduct(enabledProducts[0]?.key || '');
    }
  }, [enabledProducts, selectedProduct]);
  const reportProducts = enabledProducts.filter((product) => product.key === selectedProduct);
  const [reportYear, reportMonthNumber] = reportMonth.split('-').map(Number);
  const daysInReportMonth = new Date(reportYear, reportMonthNumber, 0).getDate();
  const reportDates = Array.from({ length: daysInReportMonth }, (_, index) => `${reportMonth}-${String(index + 1).padStart(2, '0')}`);
  const rowsByDate = new Map(rows.map((row) => [row.date, row]));
  const reportLines = reportDates.flatMap((date) => reportProducts.map((product) => ({
    date,
    product,
    stock: calculateProductStock(rowsByDate.get(date) || {}, product.key),
  })));
  const reportTotals = Object.fromEntries(STOCK_REGISTER_COLUMNS.slice(1).map((column) => [
    column.key,
    reportLines.reduce((sum, line) => sum + numberValue(line.stock[column.key]), 0),
  ]));
  const resetFilters = () => {
    setReportMonth(today().slice(0, 7));
    setSelectedProduct(enabledProducts[0]?.key || '');
  };
  return <section className="godown-sheet godown-sheet--report"><header className="godown-sheet__header"><img className="godown-sheet__logo" src="/idlogo.jpg" alt="Agency logo" /><div><h1>स्टॉक रिपोर्ट</h1><p>{agencyName}</p><small>Day-wise Multi-product Stock Report</small></div><img className="godown-sheet__logo" src="/idlogo.jpg" alt="Agency logo" /></header><div className="godown-sheet__meta"><strong>रिपोर्ट माह: {new Date(`${reportMonth}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong><label className="no-print">रिपोर्ट माह <input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></label><label className="no-print">Product<select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} disabled={!enabledProducts.length}>{enabledProducts.map((product) => <option key={product.key} value={product.key}>{product.label}</option>)}</select></label><button type="button" className="stock-register-print no-print" onClick={() => window.print()}>Print</button><button type="button" className="stock-register-delete no-print" onClick={resetFilters}>Reset</button></div><div className="godown-sheet__table-title">दिनवार उत्पाद स्टॉक विवरण</div><div className="godown-sheet__table-wrap"><table className="godown-sheet__entries stock-report-table"><thead><tr><th>Sr No.</th><th>Date</th>{STOCK_REGISTER_COLUMNS.slice(1).map((column) => <th key={column.key}>{column.label.replace('14.2KG ', '')}</th>)}</tr></thead><tbody>{reportLines.length ? reportLines.map(({ date, product, stock }, index) => <tr key={`${date}-${product.key}`}><td>{index + 1}</td><td>{new Date(`${date}T12:00:00`).toLocaleDateString('en-IN')}</td>{STOCK_REGISTER_COLUMNS.slice(1).map((column) => <td key={column.key}>{numberValue(stock[column.key])}</td>)}</tr>) : <tr><td colSpan={STOCK_REGISTER_COLUMNS.length + 1} className="godown-sheet__empty">चुने हुए महीने और product के लिए कोई stock entry नहीं है।</td></tr>}</tbody>{reportLines.length > 0 && <tfoot><tr><th colSpan="2">TOTAL</th>{STOCK_REGISTER_COLUMNS.slice(1).map((column) => <th key={column.key}>{reportTotals[column.key]}</th>)}</tr></tfoot>}</table></div></section>;
}

function StockDailyEntryForm({ row, selectedDate, setSelectedDate, updateRow, updateProductRow, onSave, onEdit, onReset, onApproval, editable, enabledProducts, maintenance, isAdmin }) {
  const fields = STOCK_REGISTER_COLUMNS.filter((column) => column.key !== 'date');
  const [selectedProduct, setSelectedProduct] = useState(() => enabledProducts[0]?.key || '');
  useEffect(() => {
    if (!enabledProducts.some((product) => product.key === selectedProduct)) {
      setSelectedProduct(enabledProducts[0]?.key || '');
    }
  }, [enabledProducts, selectedProduct]);
  const visibleProducts = enabledProducts.filter((product) => product.key === selectedProduct);
  return <section className={`daily-stock-form${editable ? '' : ' daily-stock-form--locked'}`}>
    <header className="daily-stock-form__header"><div><span>DAILY INVENTORY</span><h2>Daily Stock Entry Form</h2><p>Enabled products ka day-wise stock entry form</p></div><div className="daily-stock-form__filters"><label>Product<select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} disabled={!enabledProducts.length}>{enabledProducts.map((product) => <option key={product.key} value={product.key}>{product.label}</option>)}</select></label><div className="daily-stock-form__date"><label>Entry Date<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label></div></div></header>
    {row?.openingCarriedFrom && <p className="daily-stock-form__carry-note">Opening stock automatically carried forward from {new Date(`${row.openingCarriedFrom}T12:00:00`).toLocaleDateString('en-IN')} closing stock.</p>}
    {(row?.updatedBy || row?.approvedBy) && <div className="daily-stock-form__audit">{row.updatedBy && <span>Updated by <strong>{row.updatedBy}</strong>{row.updatedAt ? ` • ${new Date(row.updatedAt).toLocaleString('en-IN')}` : ''}</span>}{row.approvedBy && <span>Approved by <strong>{row.approvedBy}</strong>{row.approvedAt ? ` • ${new Date(row.approvedAt).toLocaleString('en-IN')}` : ''}</span>}</div>}
    <div className="daily-stock-form__products">{visibleProducts.map((product) => { const productStock = calculateProductStock(row, product.key); const config = maintenance.products[product.key]; const isLow = config.minimumStock !== '' && productStock.closingFilled < numberValue(config.minimumStock); const differenceAlert = Math.abs(productStock.difference) > numberValue(config.differenceTolerance); return <section key={product.key} className="daily-stock-form__product"><h3>{product.label} <small>({config.unit})</small></h3>{config.notes && <p className="daily-stock-form__product-note">{config.notes}</p>}{isLow && <p className="daily-stock-form__warning">Low stock: Closing Filled minimum {config.minimumStock} से कम है।</p>}{differenceAlert && <p className="daily-stock-form__warning">Stock difference configured tolerance से अधिक है।</p>}<div className="daily-stock-form__grid">{fields.map((field) => <label key={field.key} className={field.calculated ? 'daily-stock-form__field daily-stock-form__field--calculated' : 'daily-stock-form__field'}><span>{field.label.replace('14.2KG ', '')}</span>{field.calculated ? <strong>{numberValue(productStock[field.key])}</strong> : <input type="number" min="0" value={readProductStock(row, product.key)?.[field.key] || ''} onChange={(event) => product.key === 'kg14' ? updateRow(row.id, field.key, event.target.value) : updateProductRow(row.id, product.key, field.key, event.target.value)} disabled={!editable} placeholder="0" />}</label>)}</div></section>; })}</div>
    <footer className="daily-stock-form__actions"><span className={`daily-stock-form__status status-${String(row?.approvalStatus || 'Draft').toLowerCase()}`}>{row?.approvalStatus || 'Draft'}</span>{isAdmin && row?.approvalStatus === 'Pending' && <><button type="button" className="daily-stock-form__edit" onClick={() => onApproval('Rejected')}>Reject</button><button type="button" className="daily-stock-form__save" onClick={() => onApproval('Approved')}>Approve</button></>}<button type="button" className="daily-stock-form__reset" onClick={onReset} disabled={!editable}>Reset</button><button type="button" className="daily-stock-form__edit" onClick={onEdit} disabled={editable}>Edit</button><button type="button" className="daily-stock-form__save" onClick={onSave} disabled={!editable}>Save Entry</button></footer>
  </section>;
}

function StockSettings({ settings, onChange, maintenance, onMaintenanceChange }) {
  const updateProduct = (productKey, field, value) => onMaintenanceChange({
    ...maintenance,
    products: { ...maintenance.products, [productKey]: { ...maintenance.products[productKey], [field]: value } },
  });
  return <section className="stock-settings"><header><span>INVENTORY CONFIGURATION</span><h2>Stock Maintenance Settings</h2><p>Product-wise stock rules, alerts, permissions aur workflow configure karein.</p></header>
    <div className="stock-settings__global">
      <label>Edit Lock Period (Days)<input type="number" min="0" value={maintenance.editLockDays} onChange={(event) => onMaintenanceChange({ ...maintenance, editLockDays: event.target.value })} /></label>
      <label className="stock-settings__check"><input type="checkbox" checked={maintenance.resetAdminOnly} onChange={(event) => onMaintenanceChange({ ...maintenance, resetAdminOnly: event.target.checked })} />Reset केवल Admin</label>
      <label className="stock-settings__check"><input type="checkbox" checked={maintenance.approvalRequired} onChange={(event) => onMaintenanceChange({ ...maintenance, approvalRequired: event.target.checked })} />Entry Approval Required</label>
    </div>
    <div className="stock-settings__products">{STOCK_PRODUCTS.map((product) => { const config = maintenance.products[product.key]; return <article key={product.key} className={`stock-settings__product${settings[product.key] ? ' is-enabled' : ''}`}>
      <div className="stock-settings__product-head"><div><strong>{config.displayName || product.label}</strong><small>{settings[product.key] ? 'Enabled' : 'Disabled'}</small></div><label className="stock-settings__toggle"><input type="checkbox" checked={Boolean(settings[product.key])} onChange={(event) => onChange(product.key, event.target.checked)} /><span className="stock-settings__switch" /></label></div>
      <div className="stock-settings__fields">
        <label>Display Name<input value={config.displayName} onChange={(event) => updateProduct(product.key, 'displayName', event.target.value)} /></label>
        <label>Unit<select value={config.unit} onChange={(event) => updateProduct(product.key, 'unit', event.target.value)}><option>Cylinder</option><option>Piece</option><option>Set</option></select></label>
        <label>Display Order<input type="number" min="1" value={config.order} onChange={(event) => updateProduct(product.key, 'order', event.target.value)} /></label>
        <label>Opening Filled<input type="number" min="0" value={config.openingFilled} onChange={(event) => updateProduct(product.key, 'openingFilled', event.target.value)} /></label>
        <label>Opening Empty<input type="number" min="0" value={config.openingEmpty} onChange={(event) => updateProduct(product.key, 'openingEmpty', event.target.value)} /></label>
        <label>Opening Effective Date<input type="date" value={config.openingEffectiveDate} onChange={(event) => updateProduct(product.key, 'openingEffectiveDate', event.target.value)} /></label>
        <label>Minimum Stock Alert<input type="number" min="0" value={config.minimumStock} onChange={(event) => updateProduct(product.key, 'minimumStock', event.target.value)} /></label>
        <label>Difference Tolerance<input type="number" min="0" value={config.differenceTolerance} onChange={(event) => updateProduct(product.key, 'differenceTolerance', event.target.value)} /></label>
        <label className="stock-settings__wide">Product Notes<textarea rows="2" value={config.notes} onChange={(event) => updateProduct(product.key, 'notes', event.target.value)} /></label>
      </div>
      <div className="stock-settings__rules">
        <label><input type="checkbox" checked={config.blockNegative} onChange={(event) => updateProduct(product.key, 'blockNegative', event.target.checked)} />Block Negative Stock</label>
        <label><input type="checkbox" checked={config.dailyRequired} onChange={(event) => updateProduct(product.key, 'dailyRequired', event.target.checked)} />Daily Entry Required</label>
        <label><input type="checkbox" checked={config.autoCarryForward} onChange={(event) => updateProduct(product.key, 'autoCarryForward', event.target.checked)} />Auto Carry-Forward</label>
        <label><input type="checkbox" checked={config.archived} onChange={(event) => updateProduct(product.key, 'archived', event.target.checked)} />Archive Product</label>
      </div>
    </article>; })}</div>
    <p className="stock-settings__note">Disable ya archive karne se पुराना data delete नहीं होगा। Product दोबारा enable करने पर history उपलब्ध रहेगी।</p>
  </section>;
}

export default function StockRegisterPage({ loggedInUser, onClose }) {
  const storageKey = `stock-register-${loggedInUser?.dealerCode || loggedInUser?.id || 'default'}`;
  const [activeReport, setActiveReport] = useState('godown');
  const [godownRows, setGodownRows] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [deliverymen, setDeliverymen] = useState([]);
  const [deliverymanVehicles, setDeliverymanVehicles] = useState({});
  const [dayFilter, setDayFilter] = useState(today);
  const [deliverymanFilter, setDeliverymanFilter] = useState('');
  const [reportDate, setReportDate] = useState(today);
  const [stockReportMonth, setStockReportMonth] = useState(() => today().slice(0, 7));
  const [stockEntryDate, setStockEntryDate] = useState(today);
  const [dailyStocks, setDailyStocks] = useState({});
  const [savedGodownDates, setSavedGodownDates] = useState([]);
  const [editingGodownDate, setEditingGodownDate] = useState('');
  const [savedStockDates, setSavedStockDates] = useState([]);
  const [editingStockDate, setEditingStockDate] = useState('');
  const [stockCloudReady, setStockCloudReady] = useState(false);
  const [stockProductSettings, setStockProductSettings] = useState(DEFAULT_STOCK_PRODUCT_SETTINGS);
  const [stockMaintenance, setStockMaintenance] = useState(() => mergeMaintenanceSettings());
  const enabledStockProducts = useMemo(
    () => STOCK_PRODUCTS
      .filter((product) => stockProductSettings[product.key] && !stockMaintenance.products[product.key]?.archived)
      .map((product) => ({ ...product, label: stockMaintenance.products[product.key]?.displayName || product.label }))
      .sort((a, b) => numberValue(stockMaintenance.products[a.key]?.order) - numberValue(stockMaintenance.products[b.key]?.order)),
    [stockProductSettings, stockMaintenance],
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      setGodownRows(Array.isArray(saved.godownRows) ? saved.godownRows : []);
      setStockRows(Array.isArray(saved.stockRows) ? saved.stockRows : []);
      setDailyStocks(saved.dailyStocks && typeof saved.dailyStocks === 'object' ? saved.dailyStocks : {});
      setSavedGodownDates(Array.isArray(saved.savedGodownDates) ? saved.savedGodownDates : []);
      setSavedStockDates(Array.isArray(saved.savedStockDates) ? saved.savedStockDates : []);
      setStockProductSettings({ ...DEFAULT_STOCK_PRODUCT_SETTINGS, ...(saved.stockProductSettings || {}) });
      setStockMaintenance(mergeMaintenanceSettings(saved.stockMaintenance));
    } catch { setGodownRows([]); setStockRows([]); }
  }, [storageKey]);

  useEffect(() => {
    let active = true;
    const userId = String(loggedInUser?.id || loggedInUser?.dealerCode || loggedInUser?.dealerName || 'default').trim().replace(/\s+/g, '_');
    getDoc(doc(db, 'users', userId)).then((snapshot) => {
      const remote = snapshot.data()?.stockRegisterData;
      if (!active || !remote || typeof remote !== 'object') return;
      setGodownRows(Array.isArray(remote.godownRows) ? remote.godownRows : []);
      setStockRows(Array.isArray(remote.stockRows) ? remote.stockRows : []);
      setDailyStocks(remote.dailyStocks && typeof remote.dailyStocks === 'object' ? remote.dailyStocks : {});
      setSavedGodownDates(Array.isArray(remote.savedGodownDates) ? remote.savedGodownDates : []);
      setSavedStockDates(Array.isArray(remote.savedStockDates) ? remote.savedStockDates : []);
      setStockProductSettings({ ...DEFAULT_STOCK_PRODUCT_SETTINGS, ...(remote.stockProductSettings || {}) });
      setStockMaintenance(mergeMaintenanceSettings(remote.stockMaintenance));
    }).catch(() => {}).finally(() => { if (active) setStockCloudReady(true); });
    return () => { active = false; };
  }, [loggedInUser?.id, loggedInUser?.dealerCode, loggedInUser?.dealerName]);

  useEffect(() => {
    let active = true;
    const setDeliverymenFrom = (attendance) => {
      const deliveryStaff = (attendance?.employees || []).filter((employee) => String(employee?.designation || '').toLowerCase().replace(/[-\s]/g, '') === 'deliveryman');
      const vehicles = deliveryStaff.reduce((result, employee) => {
        const name = String(employee.name || '').trim();
        if (name) result[name] = String(employee.vehicleNumber || employee.profile?.vehicleNumber || '').trim();
        return result;
      }, {});
      if (active) {
        setDeliverymen(Object.keys(vehicles).sort((a, b) => a.localeCompare(b)));
        setDeliverymanVehicles(vehicles);
      }
    };
    setDeliverymenFrom(loadAttendanceData(loggedInUser));
    loadAttendanceDataFromFirebase(loggedInUser).then(setDeliverymenFrom);
    return () => { active = false; };
  }, [loggedInUser]);

  useEffect(() => {
    if (!deliverymen.length) return;
    const entryDate = dayFilter || today();
    setGodownRows((current) => {
      const existingNames = new Set(current.filter((row) => row.date === entryDate).map((row) => String(row.driverName || '').trim()).filter(Boolean));
      const missingRows = deliverymen.filter((name) => !existingNames.has(name)).map((name) => ({ ...newGodownRow(), date: entryDate, driverName: name, vehicleNumber: deliverymanVehicles[name] || '' }));
      return missingRows.length ? [...current, ...missingRows] : current;
    });
  }, [deliverymen, deliverymanVehicles, dayFilter]);

  useEffect(() => {
    if (activeReport !== 'stock') return;
    setStockRows((current) => {
      if (current.some((row) => row.date === stockEntryDate)) return current;
      const previousRow = current
        .filter((row) => row.date < stockEntryDate)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const previousClosing = previousRow ? calculateStockRow(previousRow) : null;
      const carriedProducts = Object.fromEntries(enabledStockProducts.filter((product) => product.key !== 'kg14').map((product) => {
        const config = stockMaintenance.products[product.key];
        const closing = previousRow && config.autoCarryForward ? calculateProductStock(previousRow, product.key) : null;
        const useInitial = !previousRow && (!config.openingEffectiveDate || stockEntryDate >= config.openingEffectiveDate);
        return [product.key, { openingFilled: closing?.closingFilled ?? (useInitial ? config.openingFilled : ''), openingEmpty: closing?.closingEmpty ?? (useInitial ? config.openingEmpty : ''), receiveFilled: '', refillSales: '', connection: '', returnedEmpty: '', surrender: '' }];
      }));
      const kg14Config = stockMaintenance.products.kg14;
      const carryKg14 = previousClosing && kg14Config.autoCarryForward;
      const useKg14Initial = !previousRow && (!kg14Config.openingEffectiveDate || stockEntryDate >= kg14Config.openingEffectiveDate);
      return [...current, {
        ...newStockRow(),
        date: stockEntryDate,
        openingFilled: carryKg14 ? previousClosing.closingFilled : (useKg14Initial ? kg14Config.openingFilled : ''),
        openingEmpty: carryKg14 ? previousClosing.closingEmpty : (useKg14Initial ? kg14Config.openingEmpty : ''),
        openingCarriedFrom: carryKg14 ? previousRow.date : '',
        productStocks: carriedProducts,
      }];
    });
  }, [activeReport, stockEntryDate, enabledStockProducts, stockMaintenance]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ godownRows, stockRows, dailyStocks, savedGodownDates, savedStockDates, stockProductSettings, stockMaintenance }));
  }, [storageKey, godownRows, stockRows, dailyStocks, savedGodownDates, savedStockDates, stockProductSettings, stockMaintenance]);

  useEffect(() => {
    if (!stockCloudReady) return;
    const userId = String(loggedInUser?.id || loggedInUser?.dealerCode || loggedInUser?.dealerName || 'default').trim().replace(/\s+/g, '_');
    const timer = window.setTimeout(() => {
      setDoc(doc(db, 'users', userId), {
        stockRegisterData: { godownRows, stockRows, dailyStocks, savedGodownDates, savedStockDates, stockProductSettings, stockMaintenance, updatedAt: serverTimestamp() },
      }, { merge: true }).catch((error) => console.warn('Stock Register cloud save failed; local copy retained.', error));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [stockCloudReady, loggedInUser?.id, loggedInUser?.dealerCode, loggedInUser?.dealerName, godownRows, stockRows, dailyStocks, savedGodownDates, savedStockDates, stockProductSettings, stockMaintenance]);

  const isGodown = activeReport === 'godown';
  const isGodownReport = activeReport === 'godownReport';
  const isStockReport = activeReport === 'stockReport';
  const isStockSettings = activeReport === 'stockSettings';
  const userRole = String(loggedInUser?.role || loggedInUser?.userType || loggedInUser?.designation || '').toLowerCase();
  const isAdmin = !userRole || userRole.includes('admin') || userRole.includes('dealer') || userRole.includes('owner');
  const columns = isGodown ? GODOWN_IN_OUT_COLUMNS : STOCK_REGISTER_COLUMNS;
  const sourceRows = (isGodown || isGodownReport) ? godownRows : stockRows;
  const rows = useMemo(() => sourceRows.map((isGodown || isGodownReport) ? calculateGodownRow : calculateStockRow), [sourceRows, isGodown, isGodownReport]);
  const vehicleNumbers = useMemo(() => [...new Set([...godownRows.map((row) => String(row.vehicleNumber || '').trim()), ...Object.values(deliverymanVehicles)].filter(Boolean))].sort(), [godownRows, deliverymanVehicles]);
  const visibleRows = useMemo(() => rows.filter((row) => {
    if (isGodown) return (!dayFilter || row.date === dayFilter) && (!deliverymanFilter || row.driverName === deliverymanFilter);
    if (activeReport === 'stock') return row.date === stockEntryDate;
    return true;
  }), [rows, isGodown, dayFilter, deliverymanFilter, activeReport, stockEntryDate]);
  const reportRows = useMemo(() => godownRows.map(calculateGodownRow).filter((row) => row.date === reportDate), [godownRows, reportDate]);
  const stockReportRows = useMemo(() => stockRows.filter((row) => row.date.startsWith(stockReportMonth)).sort((a, b) => a.date.localeCompare(b.date)), [stockRows, stockReportMonth]);
  const isGodownEditable = !savedGodownDates.includes(dayFilter || today()) || editingGodownDate === (dayFilter || today());
  const stockAgeDays = Math.max(0, Math.floor((new Date(`${today()}T12:00:00`) - new Date(`${stockEntryDate}T12:00:00`)) / 86400000));
  const withinEditWindow = stockAgeDays <= numberValue(stockMaintenance.editLockDays);
  const isStockEditable = !savedStockDates.includes(stockEntryDate) || (editingStockDate === stockEntryDate && (withinEditWindow || isAdmin));
  const updateRow = (id, key, value) => {
    if (isGodown && !isGodownEditable) return;
    if (activeReport === 'stock' && !isStockEditable) return;
    const setter = isGodown ? setGodownRows : setStockRows;
    setter((current) => current.map((row) => {
      if (row.id !== id) return row;
      if (isGodown && key === 'driverName') return { ...row, driverName: value, vehicleNumber: deliverymanVehicles[value] || row.vehicleNumber };
      return { ...row, [key]: value };
    }));
  };
  const addRow = () => (isGodown ? setGodownRows : setStockRows)((current) => {
    const godownRow = { ...newGodownRow(), date: dayFilter || today() };
    return [...current, isGodown ? godownRow : { ...newStockRow(), date: stockEntryDate }];
  });
  const deleteRow = (id) => {
    if (isGodown && !isGodownEditable) return;
    (isGodown ? setGodownRows : setStockRows)((current) => current.filter((row) => row.id !== id));
  };
  const totalFor = (key) => visibleRows.reduce((sum, row) => sum + numberValue(row[key]), 0);
  const activeStockDate = dayFilter || today();
  const dailyStock = dailyStocks[activeStockDate] || { filled: '', receive: '', empty: '' };
  const updateDailyStock = (key, value) => { if (isGodownEditable) setDailyStocks((current) => ({ ...current, [activeStockDate]: { ...(current[activeStockDate] || {}), [key]: value } })); };
  const saveGodownEntries = () => { setSavedGodownDates((current) => [...new Set([...current, activeStockDate])]); setEditingGodownDate(''); };
  const editGodownEntries = () => setEditingGodownDate(activeStockDate);
  const stockEntryRow = visibleRows[0] || { ...newStockRow(), date: stockEntryDate };
  const saveStockEntry = () => {
    const invalidProduct = enabledStockProducts.find((product) => {
      const config = stockMaintenance.products[product.key];
      const calculated = calculateProductStock(stockEntryRow, product.key);
      return config.blockNegative && (calculated.closingFilled < 0 || calculated.closingEmpty < 0);
    });
    if (invalidProduct) {
      window.alert(`${invalidProduct.label}: Negative closing stock allowed नहीं है। Entry check करें।`);
      return;
    }
    const closing = calculateStockRow(stockEntryRow);
    const productClosings = Object.fromEntries(enabledStockProducts
      .filter((product) => product.key !== 'kg14')
      .map((product) => [product.key, calculateProductStock(stockEntryRow, product.key)]));
    const nextDate = new Date(`${stockEntryDate}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateKey = nextDate.toISOString().slice(0, 10);
    setSavedStockDates((current) => [...new Set([...current, stockEntryDate])]);
    setStockRows((current) => {
      const approvalStatus = stockMaintenance.approvalRequired ? 'Pending' : 'Approved';
      const updated = current.map((row) => row.date === stockEntryDate ? {
        ...row,
        approvalStatus,
        updatedBy: loggedInUser?.name || loggedInUser?.dealerName || loggedInUser?.email || 'User',
        updatedAt: new Date().toISOString(),
      } : row);
      const nextIndex = updated.findIndex((row) => row.date === nextDateKey);
      const nextRow = nextIndex >= 0 ? updated[nextIndex] : { ...newStockRow(), date: nextDateKey };
      const productStocks = { ...(nextRow.productStocks || {}) };
      Object.entries(productClosings).forEach(([productKey, productClosing]) => {
        if (!stockMaintenance.products[productKey]?.autoCarryForward) return;
        productStocks[productKey] = {
          ...(productStocks[productKey] || {}),
          openingFilled: productClosing.closingFilled,
          openingEmpty: productClosing.closingEmpty,
        };
      });
      const carriedNextRow = {
        ...nextRow,
        openingFilled: stockMaintenance.products.kg14.autoCarryForward ? closing.closingFilled : nextRow.openingFilled,
        openingEmpty: stockMaintenance.products.kg14.autoCarryForward ? closing.closingEmpty : nextRow.openingEmpty,
        openingCarriedFrom: stockMaintenance.products.kg14.autoCarryForward ? stockEntryDate : nextRow.openingCarriedFrom,
        productStocks,
      };
      if (nextIndex >= 0) updated[nextIndex] = carriedNextRow;
      else updated.push(carriedNextRow);
      return updated;
    });
    setEditingStockDate('');
  };
  const updateProductRow = (id, productKey, key, value) => {
    if (activeReport !== 'stock' || !isStockEditable) return;
    setStockRows((current) => current.map((row) => row.id === id ? { ...row, productStocks: { ...(row.productStocks || {}), [productKey]: { ...(row.productStocks?.[productKey] || {}), [key]: value } } } : row));
  };
  const editStockEntry = () => {
    if (!withinEditWindow && !isAdmin) {
      window.alert(`यह entry ${stockMaintenance.editLockDays} दिन की edit limit के बाद lock हो चुकी है।`);
      return;
    }
    setEditingStockDate(stockEntryDate);
  };
  const updateStockApproval = (approvalStatus) => setStockRows((current) => current.map((row) => row.date === stockEntryDate ? {
    ...row,
    approvalStatus,
    approvedBy: loggedInUser?.name || loggedInUser?.dealerName || loggedInUser?.email || 'Admin',
    approvedAt: new Date().toISOString(),
  } : row));
  const resetStockEntry = () => {
    if (stockMaintenance.resetAdminOnly && !isAdmin) {
      window.alert('Stock reset केवल Admin कर सकता है।');
      return;
    }
    if (!window.confirm(`Reset stock entry for ${stockEntryDate}?`)) return;
    setStockRows((current) => current.filter((row) => row.date !== stockEntryDate));
    setSavedStockDates((current) => current.filter((date) => date !== stockEntryDate));
  };
  const resetGodownEntries = () => {
    if (!window.confirm(`Reset all Godown entries for ${activeStockDate}?`)) return;
    setGodownRows((current) => current.filter((row) => row.date !== activeStockDate));
    setDailyStocks((current) => { const { [activeStockDate]: removed, ...remaining } = current; return remaining; });
    setSavedGodownDates((current) => current.filter((date) => date !== activeStockDate));
  };

  return (
    <main className="stock-register-page">
      <div className="stock-register-hero">
        <div><p>Inventory Reports</p><h1>Stock Register</h1><span>Daily LPG cylinder movement and stock balance</span></div>
        <button type="button" className="stock-register-close" onClick={onClose}>← Back to Home</button>
      </div>
      <div className="stock-register-workspace">
        <aside className="stock-register-sidebar">
          <div className="stock-register-sidebar__title"><span>Inventory</span><strong>Reports Menu</strong></div>
          <div className="stock-register-tabs" role="tablist" aria-label="Stock register sections">
            <button type="button" className={isGodown ? 'active' : ''} aria-selected={isGodown} onClick={() => setActiveReport('godown')}><span>⇄</span>Godown In-Out Register</button>
            <button type="button" className={isGodownReport ? 'active' : ''} aria-selected={isGodownReport} onClick={() => setActiveReport('godownReport')}><span>▤</span>Godown In-Out Report</button>
            <button type="button" className={activeReport === 'stock' ? 'active' : ''} aria-selected={activeReport === 'stock'} onClick={() => setActiveReport('stock')}><span>▦</span>Stock Register</button>
            <button type="button" className={isStockReport ? 'active' : ''} aria-selected={isStockReport} onClick={() => setActiveReport('stockReport')}><span>▥</span>Stock Report</button>
            <button type="button" className={isStockSettings ? 'active' : ''} aria-selected={isStockSettings} onClick={() => setActiveReport('stockSettings')}><span>⚙</span>Settings</button>
          </div>
        </aside>
        <section className="stock-register-content">
          {isGodown ? <GodownRegisterSheet rows={visibleRows} vehicleNumbers={vehicleNumbers} deliverymen={deliverymen} updateRow={updateRow} deleteRow={deleteRow} onAddRow={addRow} selectedDate={activeStockDate} setSelectedDate={setDayFilter} dailyStock={dailyStock} onDailyStockChange={updateDailyStock} onSave={saveGodownEntries} onEdit={editGodownEntries} onReset={resetGodownEntries} editable={isGodownEditable} agencyName={loggedInUser?.dealerName || loggedInUser?.agencyName || 'Agency Name'} /> : isGodownReport ? <><GodownInOutReport rows={reportRows} reportDate={reportDate} setReportDate={setReportDate} dailyStock={dailyStocks[reportDate] || {}} agencyName={loggedInUser?.dealerName || loggedInUser?.agencyName || 'Agency Name'} /><GodownReportClosingSummary rows={reportRows} dailyStock={dailyStocks[reportDate] || {}} /></> : isStockSettings ? <StockSettings settings={stockProductSettings} onChange={(productKey, enabled) => setStockProductSettings((current) => ({ ...current, [productKey]: enabled }))} maintenance={stockMaintenance} onMaintenanceChange={setStockMaintenance} /> : isStockReport ? <StockReport rows={stockReportRows} reportMonth={stockReportMonth} setReportMonth={setStockReportMonth} agencyName={loggedInUser?.dealerName || loggedInUser?.agencyName || 'Agency Name'} enabledProducts={enabledStockProducts} /> : <StockDailyEntryForm row={stockEntryRow} selectedDate={stockEntryDate} setSelectedDate={setStockEntryDate} updateRow={updateRow} updateProductRow={updateProductRow} onSave={saveStockEntry} onEdit={editStockEntry} onReset={resetStockEntry} onApproval={updateStockApproval} editable={isStockEditable} enabledProducts={enabledStockProducts} maintenance={stockMaintenance} isAdmin={isAdmin} />}
        </section>
      </div>
    </main>
  );
}
