import { parseConsumerImport } from '../utils/consumerImport';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';

const headers = ['Consumer Name', 'Consumer Number', 'Mobile Number', 'Address', 'GSTIN'];
const sampleRows = [
  { 'Consumer Name': 'Ravi Kumar', 'Consumer Number': '00101', 'Mobile Number': '9876543210', Address: 'Patna', GSTIN: '' },
  { 'Consumer Name': 'Mohan Singh', 'Consumer Number': '00102', 'Mobile Number': '9876543211', Address: 'Muzaffarpur', GSTIN: '' },
];

export default function BulkConsumerImport({ disabled, mutate, onSaved }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  const pending = useRef(false);
  return <section className="invoice-workspace__card"><h3>Bulk Consumer Import</h3><p>Upload Excel (.xlsx / .xls), preview the consumers, then import. Required columns: Consumer Name, Consumer Number, Mobile Number. Maximum 400 consumers; duplicate numbers are rejected and the complete file saves together.</p><div className="invoice-workspace__import-sample"><h4>Excel Format ? Sample</h4><p>Keep these column names in the first row. Add one consumer per row below them.</p><div className="invoice-workspace__table-scroll"><table className="data-table" aria-label="Excel import sample"><thead><tr>{headers.map((header, index) => <th key={header}>{header}<small style={{ display: 'block' }}>{index < 3 ? 'Required' : 'Optional'}</small></th>)}</tr></thead><tbody>{sampleRows.map((row) => <tr key={row['Consumer Number']}>{headers.map((header) => <td key={header}>{row[header] || '?'}</td>)}</tr>)}</tbody></table></div><p>Mobile Number must contain 10 digits. Set Consumer Number and Mobile Number columns to <strong>Text</strong> in Excel to preserve leading zeros. Address and GSTIN can be left blank. Upload the data in the first worksheet.</p></div><button type="button" onClick={() => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sampleRows, { header: headers }), 'Consumers');
    XLSX.writeFile(workbook, 'consumer-import-template.xlsx');
  }}>Download Excel Template</button><label>Upload consumer Excel<input type="file" accept=".xlsx,.xls" disabled={disabled || reading} onChange={async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setRows([]); setMessage(''); setReading(true);
    try {
      if (!/\.xlsx?$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error('Choose an Excel file up to 5 MB.');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      setRows(parseConsumerImport(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false })));
    } catch (error) { setMessage(error.message); } finally { setReading(false); }
  }} /></label>{message && <p role="status">{message}</p>}{rows.length > 0 && <><p>{rows.length} consumers ready to import.</p><div className="invoice-workspace__table-scroll"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.consumerNo}>{['consumerName', 'consumerNo', 'mobileNo', 'address', 'gstin'].map((key) => <td key={key}>{row[key]}</td>)}</tr>)}</tbody></table></div><button type="button" disabled={disabled || reading} onClick={async () => {
    if (disabled || pending.current) return;
    pending.current = true;
    try { const result = await mutate({ mode: 'bulkConsumers', consumers: rows }); if (result) { onSaved(result.consumers); setMessage(`${result.consumers.length} consumers imported successfully.`); setRows([]); } } finally { pending.current = false; }
  }}>Import Consumers</button></>}</section>;
}
