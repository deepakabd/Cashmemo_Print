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

function GodownInOutReport({ rows, reportDate, setReportDate, agencyName }) {
  const total = (key) => rows.reduce((sum, row) => sum + numberValue(row[key]), 0);
  return <section className="godown-sheet godown-sheet--report"><header className="godown-sheet__header"><img className="godown-sheet__logo" src="/idlogo.jpg" alt="Agency logo" /><div><h1>गोदाम आगमन - निर्गमन रिपोर्ट</h1><p>{agencyName}</p><small>Godown In-Out Report</small></div><img className="godown-sheet__logo" src="/idlogo.jpg" alt="Agency logo" /></header><div className="godown-sheet__meta"><strong>दिनांक: {new Date(`${reportDate}T12:00:00`).toLocaleDateString('en-IN')}</strong><label className="no-print">रिपोर्ट दिनांक <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label><button type="button" className="stock-register-print no-print" onClick={() => window.print()}>Print</button><button type="button" className="stock-register-delete no-print" onClick={() => setReportDate(today())}>Reset</button></div><div className="godown-sheet__table-title">वाहन एवं डिलीवरीमैन अनुसार दैनिक सिलेंडर विवरण</div><div className="godown-sheet__table-wrap"><table className="godown-sheet__entries"><thead><tr><th>क्र.</th><th>वाहन क्रमांक</th><th>डिलीवरीमैन का नाम</th><th>भरा आउट</th><th>भरा इन</th><th>खाली इन</th><th>कुल बिक्री</th><th>अंतर</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.vehicleNumber || '—'}</td><td>{row.driverName || '—'}</td><td>{numberValue(row.filledOut)}</td><td>{numberValue(row.filledIn)}</td><td>{numberValue(row.emptyIn)}</td><td>{numberValue(row.totalSales)}</td><td>{numberValue(row.difference)}</td></tr>) : <tr><td colSpan="8" className="godown-sheet__empty">चुनी हुई तारीख के लिए कोई entry नहीं है।</td></tr>}</tbody>{rows.length > 0 && <tfoot><tr><th colSpan="3">कुल</th><th>{total('filledOut')}</th><th>{total('filledIn')}</th><th>{total('emptyIn')}</th><th>{total('totalSales')}</th><th>{total('difference')}</th></tr></tfoot>}</table></div></section>;
}

function StockReport({ rows, reportMonth, setReportMonth, agencyName }) {
  const total = (key) => rows.reduce((sum, row) => sum + numberValue(row[key]), 0);
  return <section className="godown-sheet godown-sheet--report"><header className="godown-sheet__header"><img className="godown-sheet__logo" src="/idlogo.jpg" alt="Agency logo" /><div><h1>स्टॉक रिपोर्ट</h1><p>{agencyName}</p><small>Day-wise Stock Report</small></div><img className="godown-sheet__logo" src="/idlogo.jpg" alt="Agency logo" /></header><div className="godown-sheet__meta"><strong>रिपोर्ट माह: {new Date(`${reportMonth}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong><label className="no-print">रिपोर्ट माह <input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></label><button type="button" className="stock-register-print no-print" onClick={() => window.print()}>Print</button><button type="button" className="stock-register-delete no-print" onClick={() => setReportMonth(today().slice(0, 7))}>Reset</button></div><div className="godown-sheet__table-title">दिनवार 14.2Kg स्टॉक विवरण</div><div className="godown-sheet__table-wrap"><table className="godown-sheet__entries stock-report-table"><thead><tr><th>#</th><th>Date</th>{STOCK_REGISTER_COLUMNS.slice(1).map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{new Date(`${row.date}T12:00:00`).toLocaleDateString('en-IN')}</td>{STOCK_REGISTER_COLUMNS.slice(1).map((column) => <td key={column.key}>{numberValue(row[column.key])}</td>)}</tr>) : <tr><td colSpan={STOCK_REGISTER_COLUMNS.length + 1} className="godown-sheet__empty">चुने हुए महीने के लिए कोई स्टॉक entry नहीं है।</td></tr>}</tbody>{rows.length > 0 && <tfoot><tr><th colSpan="2">कुल</th>{STOCK_REGISTER_COLUMNS.slice(1).map((column) => <th key={column.key}>{total(column.key)}</th>)}</tr></tfoot>}</table></div></section>;
}

function StockDailyEntryForm({ row, selectedDate, setSelectedDate, updateRow, onSave, onEdit, onReset, editable }) {
  const fields = STOCK_REGISTER_COLUMNS.filter((column) => column.key !== 'date');
  return <section className={`daily-stock-form${editable ? '' : ' daily-stock-form--locked'}`}>
    <header className="daily-stock-form__header"><div><span>DAILY INVENTORY</span><h2>Daily Stock Entry Form</h2><p>14.2Kg cylinder stock ka day-wise entry form</p></div><div className="daily-stock-form__date"><label>Entry Date<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label></div></header>
    <div className="daily-stock-form__grid">{fields.map((field) => <label key={field.key} className={field.calculated ? 'daily-stock-form__field daily-stock-form__field--calculated' : 'daily-stock-form__field'}><span>{field.label}</span>{field.calculated ? <strong>{numberValue(row?.[field.key])}</strong> : <input type="number" min="0" value={row?.[field.key] || ''} onChange={(event) => updateRow(row.id, field.key, event.target.value)} disabled={!editable} placeholder="0" />}</label>)}</div>
    <footer className="daily-stock-form__actions"><button type="button" className="daily-stock-form__reset" onClick={onReset} disabled={!editable}>Reset</button><button type="button" className="daily-stock-form__edit" onClick={onEdit} disabled={editable}>Edit</button><button type="button" className="daily-stock-form__save" onClick={onSave} disabled={!editable}>Save Entry</button></footer>
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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      setGodownRows(Array.isArray(saved.godownRows) ? saved.godownRows : []);
      setStockRows(Array.isArray(saved.stockRows) ? saved.stockRows : []);
      setDailyStocks(saved.dailyStocks && typeof saved.dailyStocks === 'object' ? saved.dailyStocks : {});
      setSavedGodownDates(Array.isArray(saved.savedGodownDates) ? saved.savedGodownDates : []);
      setSavedStockDates(Array.isArray(saved.savedStockDates) ? saved.savedStockDates : []);
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
    setStockRows((current) => current.some((row) => row.date === stockEntryDate)
      ? current
      : [...current, { ...newStockRow(), date: stockEntryDate }]);
  }, [activeReport, stockEntryDate]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ godownRows, stockRows, dailyStocks, savedGodownDates, savedStockDates }));
  }, [storageKey, godownRows, stockRows, dailyStocks, savedGodownDates, savedStockDates]);

  useEffect(() => {
    if (!stockCloudReady) return;
    const userId = String(loggedInUser?.id || loggedInUser?.dealerCode || loggedInUser?.dealerName || 'default').trim().replace(/\s+/g, '_');
    const timer = window.setTimeout(() => {
      setDoc(doc(db, 'users', userId), {
        stockRegisterData: { godownRows, stockRows, dailyStocks, savedGodownDates, savedStockDates, updatedAt: serverTimestamp() },
      }, { merge: true }).catch((error) => console.warn('Stock Register cloud save failed; local copy retained.', error));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [stockCloudReady, loggedInUser?.id, loggedInUser?.dealerCode, loggedInUser?.dealerName, godownRows, stockRows, dailyStocks, savedGodownDates, savedStockDates]);

  const isGodown = activeReport === 'godown';
  const isGodownReport = activeReport === 'godownReport';
  const isStockReport = activeReport === 'stockReport';
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
  const stockReportRows = useMemo(() => {
    const [year, month] = stockReportMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const editableKeys = ['openingFilled', 'receiveFilled', 'openingEmpty', 'refillSales', 'connection', 'returnedEmpty', 'surrender'];
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = `${stockReportMonth}-${String(index + 1).padStart(2, '0')}`;
      const dailyRows = stockRows.filter((row) => row.date === date);
      const combined = dailyRows.reduce((result, row) => {
        editableKeys.forEach((key) => { result[key] = numberValue(result[key]) + numberValue(row[key]); });
        return result;
      }, { id: date, date });
      return calculateStockRow(combined);
    });
  }, [stockRows, stockReportMonth]);
  const isGodownEditable = !savedGodownDates.includes(dayFilter || today()) || editingGodownDate === (dayFilter || today());
  const isStockEditable = !savedStockDates.includes(stockEntryDate) || editingStockDate === stockEntryDate;
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
  const saveStockEntry = () => { setSavedStockDates((current) => [...new Set([...current, stockEntryDate])]); setEditingStockDate(''); };
  const editStockEntry = () => setEditingStockDate(stockEntryDate);
  const resetStockEntry = () => {
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
      <div className="stock-register-tabs" role="tablist">
        <button type="button" className={isGodown ? 'active' : ''} onClick={() => setActiveReport('godown')}>Godown In-Out Register</button>
        <button type="button" className={isGodownReport ? 'active' : ''} onClick={() => setActiveReport('godownReport')}>Godown In-Out Report</button>
        <button type="button" className={activeReport === 'stock' ? 'active' : ''} onClick={() => setActiveReport('stock')}>Stock Register</button>
        <button type="button" className={isStockReport ? 'active' : ''} onClick={() => setActiveReport('stockReport')}>Stock Report</button>
      </div>
      {isGodown ? <GodownRegisterSheet rows={visibleRows} vehicleNumbers={vehicleNumbers} deliverymen={deliverymen} updateRow={updateRow} deleteRow={deleteRow} onAddRow={addRow} selectedDate={activeStockDate} setSelectedDate={setDayFilter} dailyStock={dailyStock} onDailyStockChange={updateDailyStock} onSave={saveGodownEntries} onEdit={editGodownEntries} onReset={resetGodownEntries} editable={isGodownEditable} agencyName={loggedInUser?.dealerName || loggedInUser?.agencyName || 'Agency Name'} /> : isGodownReport ? <GodownInOutReport rows={reportRows} reportDate={reportDate} setReportDate={setReportDate} agencyName={loggedInUser?.dealerName || loggedInUser?.agencyName || 'Agency Name'} /> : isStockReport ? <StockReport rows={stockReportRows} reportMonth={stockReportMonth} setReportMonth={setStockReportMonth} agencyName={loggedInUser?.dealerName || loggedInUser?.agencyName || 'Agency Name'} /> : <StockDailyEntryForm row={stockEntryRow} selectedDate={stockEntryDate} setSelectedDate={setStockEntryDate} updateRow={updateRow} onSave={saveStockEntry} onEdit={editStockEntry} onReset={resetStockEntry} editable={isStockEditable} />}
    </main>
  );
}
