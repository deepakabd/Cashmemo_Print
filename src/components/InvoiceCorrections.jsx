import { useRef, useState } from 'react';
import { indiaDate, invoiceNetTotal, invoicePaid, invoiceRefunded, outstandingAgeing } from '../utils/invoiceAccounting';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
export default function InvoiceCorrections({ view, records, disabled, mutate, onSaved }) {
  const [draft, setDraft] = useState({ invoiceId: '', type: 'Credit', amount: '', date: indiaDate(), reason: '' });
  const id = useRef(crypto.randomUUID());
  const pending = useRef(false);
  const selected = records.find((record) => record.id === draft.invoiceId);
  const update = (field, value) => setDraft((previous) => ({ ...previous, [field]: value }));
  if (view === 'Outstanding Ageing') {
    const rows = outstandingAgeing(records);
    return <section className="invoice-workspace__card"><h3>Outstanding Ageing</h3><p>Ageing uses the due date, or invoice date when no due date is set.</p><div className="invoice-workspace__form-grid invoice-ageing-summary">{['Not due', '0–30 days', '31–60 days', '61–90 days', '90+ days'].map((bucket) => <div key={bucket}><h4>{bucket}</h4><strong>{money(rows.filter((row) => row.bucket === bucket).reduce((sum, row) => sum + row.due, 0))}</strong></div>)}</div><div className="invoice-workspace__table-scroll"><table className="data-table"><thead><tr><th>Invoice</th><th>Consumer</th><th>Days overdue</th><th>Ageing</th><th>Outstanding</th></tr></thead><tbody>{rows.map(({ record, days, bucket, due }) => <tr key={record.id}><td>{record.invoiceNumber}</td><td>{record.header?.name}</td><td>{days}</td><td>{bucket}</td><td>{money(due)}</td></tr>)}</tbody></table></div></section>;
  }
  return <section className="invoice-workspace__card"><h3>Invoice Notes / Refunds</h3><p>Credit reduces the invoice amount; debit increases it. Refunds return excess payments after a credit note. All entries remain in transaction history.</p><form onSubmit={async (event) => {
    event.preventDefault();
    if (disabled || pending.current) return;
    pending.current = true;
    try {
      const record = await mutate({ mode: draft.type === 'Refund' ? 'refund' : 'note', id: draft.invoiceId, entry: { ...draft, id: id.current, amount: Number(draft.amount) } });
      if (record) { onSaved(record); id.current = crypto.randomUUID(); setDraft((previous) => ({ ...previous, amount: '', reason: '' })); }
    } finally { pending.current = false; }
  }}><fieldset disabled={disabled}><div className="invoice-workspace__form-grid"><label>Invoice<select required value={draft.invoiceId} onChange={(event) => update('invoiceId', event.target.value)}><option value="">Choose invoice</option>{records.filter((record) => !record.trashed && record.status !== 'Cancelled').map((record) => <option key={record.id} value={record.id}>{record.invoiceNumber} · {record.header?.name}</option>)}</select></label><label>Type<select value={draft.type} onChange={(event) => update('type', event.target.value)}>{['Credit', 'Debit', 'Refund'].map((type) => <option key={type}>{type}</option>)}</select></label><label>Amount<input required type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => update('amount', event.target.value)} /></label><label>Date<input required type="date" min={selected?.header?.date} max={indiaDate()} value={draft.date} onChange={(event) => update('date', event.target.value)} /></label><label>Reason<input required minLength={3} maxLength={500} value={draft.reason} onChange={(event) => update('reason', event.target.value)} /></label></div><button type="submit">Save Note / Refund</button></fieldset></form>{selected && <div><p>Adjusted total: {money(invoiceNetTotal(selected))} · Refund available: {money(Math.max(0, invoicePaid(selected) - invoiceRefunded(selected) - invoiceNetTotal(selected)))}</p>{[...(selected.notes || []), ...(selected.refunds || []).map((entry) => ({ ...entry, type: 'Refund' }))].map((entry) => <p key={entry.id}>{entry.date} · {entry.type} · {money(entry.amount)} · {entry.reason}</p>)}</div>}</section>;
}
