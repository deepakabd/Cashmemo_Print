import { resolveRatesForDate } from './rateUtils';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const registerBillHtml = (record, dealer = {}, rates = [], bank = {}) => {
  const datedRates = resolveRatesForDate(rates, record.date);
  const products = [
    { name: '14.2KG LPG Cylinder', quantity: Number(record.filledGoes14 || 0), rate: Number(record.rate14 || 0) },
    { name: '19KG LPG Cylinder', quantity: Number(record.filledGoes19 || 0), rate: Number(record.rate19 || 0) },
  ].filter((product) => product.quantity > 0).map((product) => {
    const size = product.name.startsWith('14.2') ? '14.2' : '19';
    const matching = datedRates.filter((row) => new RegExp(`^${size.replace('.', '\\.')}\\s*KG\\b`, 'i').test(String(row.Item || '').trim()) && /CYLINDER/i.test(row.Item));
    const details = matching.find((row) => /CYLINDER$/i.test(row.Item.trim())) || matching[0];
    const sgstPct = Number(details?.SGST || 0);
    const cgstPct = Number(details?.CGST || 0);
    const total = product.quantity * product.rate;
    const taxable = total / (1 + (sgstPct + cgstPct) / 100);
    return { ...product, hsn: details?.HSNCode || '27111900', sgstPct, cgstPct, total, taxable, sgst: taxable * sgstPct / 100, cgst: taxable * cgstPct / 100 };
  });
  const taxable = products.reduce((sum, product) => sum + product.taxable, 0);
  const sgst = products.reduce((sum, product) => sum + product.sgst, 0);
  const cgst = products.reduce((sum, product) => sum + product.cgst, 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bill ${escapeHtml(record.name)}</title><style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; } body { font: 13px Arial, sans-serif; color: #222; margin: 0; }
    .invoice { max-width: 800px; margin: 0 auto; border: 1px solid #333; padding: 24px; }
    h1 { margin: 0 0 20px; text-align: center; font-size: 24px; } h2 { font-size: 18px; margin: 0 0 8px; }
    .header, .details { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .details > div { flex: 1; } p { margin: 5px 0; overflow-wrap: anywhere; } .reference { max-width: 45%; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; } th, td { border: 1px solid #ccc; padding: 12px 8px; text-align: right; }
    th { background: #f3f3f3; } th:nth-child(2), td:nth-child(2) { text-align: left; } .summary { width: 300px; margin-left: auto; }
    .summary p { display: flex; justify-content: space-between; padding: 6px 0; } .total { font-weight: bold; border-top: 1px solid #333; }
    .footer { margin-top: 24px; display: flex; justify-content: space-between; gap: 24px; font-size: 11px; } .remark { white-space: pre-wrap; }
    .header { background: #eaf4ff; padding: 8px 8px 10px; border-bottom: 2px solid #9aa6b8; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .brand { display: grid; grid-template-columns: minmax(0, 31%) minmax(0, 1fr); gap: 12px; align-items: center; width: 100%; }
    .brand img { width: 100%; height: 82px; object-fit: contain; }
    .brand > div { min-width: 0; }
    .brand h2 { font-family: Arial, sans-serif; font-size: 16px; font-weight: 800; color: #1f4fb2; letter-spacing: 0; line-height: 1.2; margin: 0 0 7px; text-transform: uppercase; }
    .brand p { font-size: 12px; line-height: 1.4; margin: 2px 0; color: #000; }
    .details { border: 1px solid #dfe3eb; padding: 14px; background: #f9fbff; }
    .summary-grid { display: flex; gap: 20px; } .summary-grid .summary { flex: 1; width: auto; margin: 0; border: 1px solid #dfe3eb; padding: 12px; }
    .summary h3 { margin: 0 0 10px; background: #eef4ff; padding: 8px; font-size: 12px; }
    .bottom { text-align: center; margin-top: 20px; font-size: 11px; } table { font-size: 11px; } th, td { padding: 10px 5px; }
    tr { break-inside: avoid; }
    @media print { .invoice { max-width: none; } }
  </style></head><body><main class="invoice"><h1>Tax Invoice</h1>
    <div class="header"><div class="brand"><img src="${escapeHtml(new URL('/logo.jpg', document.baseURI).href)}" alt="Distributor Logo"><div><h2>${escapeHtml(dealer.name || 'LPG CashMemo')}</h2><p>${escapeHtml(dealer.address || '')}</p><p>Contact: ${escapeHtml(dealer.contact || '')}</p><p>GSTIN: ${escapeHtml(dealer.gstn || '')}</p></div></div></div>
    <div class="details"><div><strong>Bill To</strong><p>${escapeHtml(record.name)}</p><p>${escapeHtml(record.village)}</p><p>Contact: ${escapeHtml(record.contact)}</p></div><div class="reference"><p><strong>Date:</strong> ${escapeHtml(record.date)}</p></div></div>
    <table><thead><tr><th>Sr.</th><th>Goods &amp; Service Description</th><th>HSN</th><th>Quantity</th><th>Rate (₹)</th><th>Discount</th><th>Taxable</th><th>GST %</th><th>GST Amt</th><th>Total</th></tr></thead><tbody>${products.map((product, index) => `<tr><td>${index + 1}</td><td>${product.name}</td><td>${escapeHtml(product.hsn)}</td><td>${product.quantity}</td><td>${money(product.rate)}</td><td>0.00</td><td>${money(product.taxable)}</td><td>${product.sgstPct + product.cgstPct}%</td><td>${money(product.sgst + product.cgst)}</td><td>${money(product.total)}</td></tr>`).join('')}</tbody></table>
    <div class="summary-grid"><div class="summary"><h3>SUMMARY</h3><p><span>Sub-Total</span><span>₹${money(taxable)}</span></p><p><span>GST</span><span>₹${money(sgst + cgst)}</span></p><p class="total"><span>Total</span><span>₹${money(record.totalAmount)}</span></p></div><div class="summary"><h3>AMOUNT</h3><p><span>CGST Amt</span><span>₹${money(cgst)}</span></p><p><span>SGST Amt</span><span>₹${money(sgst)}</span></p><p class="total"><span>Total Amount</span><span>₹${money(record.totalAmount)}</span></p><p><span>Paid Amount</span><span>₹${money(record.paidAmount)}</span></p><p class="total"><span>Dues Amount</span><span>₹${money(record.duesAmount)}</span></p></div></div>
    ${record.remark ? `<p class="remark"><strong>Remark:</strong> ${escapeHtml(record.remark)}</p>` : ''}
    <div class="footer"><div><strong>Our Bank Details</strong><p>Bank Name: ${escapeHtml(bank.bankName)}</p><p>Branch: ${escapeHtml(bank.branch)}</p><p>Account No: ${escapeHtml(bank.accountNo)}</p><p>IFSC Code: ${escapeHtml(bank.ifsc)}</p></div><div><strong>Declaration</strong><p>1. Terms &amp; conditions are subject to our trade policy</p><p>2. Our risk &amp; responsibility ceases after the delivery of goods.</p><p>E &amp; O.E.</p></div></div><p class="bottom">This is computer generated invoice no signature required.</p>
  </main></body></html>`;
};

export const printRegisterBill = (record, dealer, rates, bank) => {
  const popup = window.open('', '_blank');
  if (!popup) return false;
  popup.document.write(registerBillHtml(record, dealer, rates, bank));
  popup.document.close();
  let printed = false;
  const print = async () => {
    if (printed) return;
    printed = true;
    await Promise.all(Array.from(popup.document.images).map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })));
    await popup.document.fonts?.ready;
    popup.focus(); popup.print();
  };
  popup.addEventListener('load', print, { once: true });
  if (popup.document.readyState === 'complete') void print();
  return true;
};
