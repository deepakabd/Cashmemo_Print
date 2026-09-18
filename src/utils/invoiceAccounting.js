export const invoiceTotal = (record) => {
  const value = Number(record.header?.amount ?? record.draft?.summary?.payableTotal ?? 0);
  return Number.isFinite(value) ? Math.round(Math.max(0, value) * 100) / 100 : 0;
};
export const invoicePaid = (record) => {
  if (!Array.isArray(record.payments)) return record.status === 'Paid' ? invoiceTotal(record) : 0;
  return Math.round(record.payments.reduce((sum, payment) => sum + (payment.reversal ? 0 : Number(payment.amount || 0)), 0) * 100) / 100;
};
export const invoiceDue = (record) => record.status === 'Cancelled' ? 0 : Math.round(Math.max(0, invoiceTotal(record) - invoicePaid(record)) * 100) / 100;
export const paymentStatus = (record) => invoiceDue(record) === 0 ? 'Paid' : invoicePaid(record) > 0 ? 'Partial' : 'Unpaid';
export const indiaDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export const financialYear = (date) => {
  const [year, month] = date.split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
};
export const buildInvoiceLedger = (records, adjustments = []) => {
  const rows = records.flatMap((record) => {
    const consumer = record.draft?.billToName || record.header?.name || 'Consumer';
    const consumerKey = record.draft?.billToConsumerNo || record.draft?.billToMobileNo || consumer.toLowerCase();
    const date = record.draft?.billToDate || record.header?.date || String(record.savedAt).slice(0, 10);
    const base = { consumer, consumerKey, invoiceNumber: record.invoiceNumber || record.id };
    return [{ ...base, id: record.id, date, debit: invoiceTotal(record), credit: 0, detail: 'Invoice', order: 0 },
      ...(record.payments || []).flatMap((payment) => [{ ...base, id: payment.id, date: payment.date, debit: 0, credit: payment.amount, detail: `${payment.mode}${payment.reference ? ` · ${payment.reference}` : ''}`, order: 1 }, ...(payment.reversal ? [{ ...base, id: `${payment.id}-reversal`, date: payment.reversal.date, debit: payment.amount, credit: 0, detail: `Payment reversal: ${payment.reversal.reason}`, order: 2 }] : [])]),
      ...(record.cancellation ? [{ ...base, id: `${record.id}-cancel`, date: record.cancellation.date, debit: 0, credit: invoiceTotal(record), detail: `Invoice cancelled: ${record.cancellation.reason}`, order: 3 }] : [])];
  }).concat(adjustments.map((entry) => ({ ...entry, invoiceNumber: 'Adjustment', debit: entry.type.endsWith('Debit') ? entry.amount : 0, credit: entry.type.endsWith('Credit') ? entry.amount : 0, detail: `${entry.type}: ${entry.reason}`, order: entry.type.startsWith('Opening') ? -1 : 2 }))).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.invoiceNumber.localeCompare(b.invoiceNumber));
  const balances = new Map();
  return rows.map((row) => {
    const balance = Math.round(((balances.get(row.consumerKey) || 0) + row.debit - row.credit) * 100) / 100;
    balances.set(row.consumerKey, balance);
    return { ...row, balance };
  });
};
export const consumerStatement = (rows, consumerKey, from = '', to = '') => {
  const own = rows.filter((row) => row.consumerKey === consumerKey);
  const opening = own.filter((row) => from && row.date < from).reduce((sum, row) => sum + row.debit - row.credit, 0);
  const transactions = own.filter((row) => (!from || row.date >= from) && (!to || row.date <= to));
  const debit = transactions.reduce((sum, row) => sum + row.debit, 0);
  const credit = transactions.reduce((sum, row) => sum + row.credit, 0);
  return { opening: Math.round(opening * 100) / 100, debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100, closing: Math.round((opening + debit - credit) * 100) / 100, transactions };
};
