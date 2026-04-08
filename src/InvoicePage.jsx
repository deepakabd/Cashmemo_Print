import { useEffect, useMemo, useRef, useState } from 'react';

function InvoicePage({ loggedInUser }) {
  const initialInvoiceRates = (() => {
    try {
      const userRates = Array.isArray(loggedInUser?.ratesData) ? loggedInUser.ratesData : null;
      const parsedRates = userRates || (() => {
        const savedRates = localStorage.getItem('ratesData');
        return savedRates ? JSON.parse(savedRates) : [];
      })();
      if (!Array.isArray(parsedRates)) return [];
      return parsedRates
        .map((rate) => ({
          Code: rate?.Code ?? '',
          HSNCode: String(rate?.HSNCode ?? '27111900').trim() || '27111900',
          Item: String(rate?.Item ?? '').trim(),
          BasicPrice: parseFloat(rate?.BasicPrice) || 0,
          SGST: parseFloat(rate?.SGST) || 0,
          CGST: parseFloat(rate?.CGST) || 0,
          RSP: parseFloat(rate?.RSP) || 0,
        }))
        .filter((rate) => rate.Item);
    } catch {
      return [];
    }
  })();

  const invoiceProfileData = loggedInUser?.profileData || {};
  const dealer = {
    name: invoiceProfileData.distributorName
      ? (invoiceProfileData.distributorCode
        ? `${invoiceProfileData.distributorName} (${invoiceProfileData.distributorCode})`
        : invoiceProfileData.distributorName)
      : '-',
    address: invoiceProfileData.address || '-',
    contact: invoiceProfileData.contact || '-',
    gstn: invoiceProfileData.gst || '-',
  };
  const defaultBankDetails = {
    bankName: '',
    branch: '',
    accountNo: '',
    ifsc: '',
  };
  const [invoiceRates] = useState(initialInvoiceRates);
  const [bankDetails, setBankDetails] = useState(defaultBankDetails);
  const [invoiceRows, setInvoiceRows] = useState([
    { id: `row-${Date.now()}`, item: '', quantity: 1, customRate: '', discount: '' },
  ]);
  const [billToName, setBillToName] = useState('');
  const [billToConsumerNo, setBillToConsumerNo] = useState('');
  const [billToMobileNo, setBillToMobileNo] = useState('');
  const [billToCenterNo, setBillToCenterNo] = useState('');
  const [billToDate, setBillToDate] = useState(new Date().toISOString().slice(0, 10));
  const [billToAddress, setBillToAddress] = useState('');
  const [billToGstin, setBillToGstin] = useState('');
  const invoicePrintRef = useRef(null);
  const toUpperValue = (value) => (value || '').toUpperCase();

  const buildInvoiceRow = () => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    item: '',
    quantity: 1,
    customRate: '',
    discount: '',
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = billToDate ? new Date(`${billToDate}T00:00:00`) : null;
  const isPastInvoiceDate = !!selectedDate && !isNaN(selectedDate.getTime()) && selectedDate < today;

  const itemRateMap = useMemo(
    () => new Map(invoiceRates.map((rate) => [rate.Item, rate])),
    [invoiceRates]
  );

  const lineItems = invoiceRows.map((row) => {
    const rate = itemRateMap.get(row.item) || null;
    const qty = Math.max(0, parseFloat(row.quantity) || 0);
    const sgstPct = rate?.SGST || 0;
    const cgstPct = rate?.CGST || 0;
    const fetchedRate = parseFloat(rate?.RSP) || 0;
    const customRateNum = parseFloat(row.customRate);
    const unitRate = isPastInvoiceDate && row.customRate !== '' && !isNaN(customRateNum)
      ? customRateNum
      : fetchedRate;
    const grossTotal = unitRate * qty;
    const discountInput = parseFloat(row.discount);
    const discount = Number.isFinite(discountInput) ? Math.min(Math.max(discountInput, 0), grossTotal) : 0;
    const discountedTotal = Math.max(0, grossTotal - discount);
    const gstFactor = 1 + (sgstPct / 100) + (cgstPct / 100);
    const taxable = gstFactor > 0 ? (discountedTotal / gstFactor) : discountedTotal;
    const sgst = taxable * sgstPct / 100;
    const cgst = taxable * cgstPct / 100;
    const gst = sgst + cgst;
    const total = discountedTotal;

    return {
      id: row.id,
      item: row.item,
      quantity: qty,
      rateData: rate,
      taxable,
      sgstPct,
      cgstPct,
      gstPercent: sgstPct + cgstPct,
      sgst,
      cgst,
      gst,
      unitRate,
      discount,
      total,
    };
  });

  const taxableAmount = lineItems.reduce((sum, row) => sum + row.taxable, 0);
  const sgstAmount = lineItems.reduce((sum, row) => sum + row.sgst, 0);
  const cgstAmount = lineItems.reduce((sum, row) => sum + row.cgst, 0);
  const gstAmount = sgstAmount + cgstAmount;
  const lineTotal = lineItems.reduce((sum, row) => sum + row.total, 0);
  const roundOff = Math.round(lineTotal) - lineTotal;
  const payableTotal = lineTotal + roundOff;
  const numberToWords = (num) => {
    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen',
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const belowThousand = (n) => {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
      return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${belowThousand(n % 100)}` : ''}`;
    };

    if (num === 0) return 'Zero';
    const parts = [];
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const hundred = num % 1000;

    if (crore) parts.push(`${belowThousand(crore)} Crore`);
    if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
    if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
    if (hundred) parts.push(belowThousand(hundred));
    return parts.join(' ').trim();
  };

  const rupees = Math.floor(Math.abs(payableTotal));
  const paise = Math.round((Math.abs(payableTotal) - rupees) * 100);
  const payableTotalInWords = `Rupees ${numberToWords(rupees)}${paise ? ` and ${numberToWords(paise)} Paise` : ''} Only`;

  const handleAddProduct = () => {
    setInvoiceRows((prev) => [...prev, buildInvoiceRow()]);
  };

  const buildEmptyProductRow = () => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    item: '',
    quantity: 1,
    customRate: '',
    discount: '',
  });

  const handleRemoveProduct = (rowId) => {
    setInvoiceRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const handleRowItemChange = (rowId, item) => {
    setInvoiceRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, item, customRate: '' } : row))
    );
  };

  const handleRowQuantityChange = (rowId, quantity) => {
    setInvoiceRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, quantity } : row))
    );
  };

  const handleRowRateChange = (rowId, customRate) => {
    setInvoiceRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, customRate } : row))
    );
  };

  const handleRowDiscountChange = (rowId, discount) => {
    setInvoiceRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, discount } : row))
    );
  };

  const handleClearInvoice = () => {
    setBillToDate('');
    setInvoiceRows([buildEmptyProductRow()]);
  };

  const handleResetInvoice = () => {
    setBillToName('');
    setBillToConsumerNo('');
    setBillToMobileNo('');
    setBillToCenterNo('');
    setBillToAddress('');
    setBillToGstin('');
    setBillToDate('');
    setInvoiceRows([buildEmptyProductRow()]);
  };

  const handlePrintInvoice = () => {
    if (!invoicePrintRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Unable to open print window. Please allow pop-ups.');
      return;
    }
    const liveSelectTexts = Array.from(invoicePrintRef.current.querySelectorAll('select')).map((selectEl) => {
      return selectEl.options?.[selectEl.selectedIndex]?.text || selectEl.value || '';
    });
    const printClone = invoicePrintRef.current.cloneNode(true);
    printClone.querySelectorAll('select').forEach((selectEl, index) => {
      const selectedText = liveSelectTexts[index] || '';
      const valueNode = document.createElement('span');
      valueNode.className = 'print-select-value';
      valueNode.textContent = selectedText;
      selectEl.replaceWith(valueNode);
    });
    printClone.querySelectorAll('input, textarea').forEach((fieldEl) => {
      const fieldValue = (fieldEl.value || '').trim();
      const isOptionalBillToField =
        fieldEl.classList.contains('billto-consumerno') ||
        fieldEl.classList.contains('billto-centerno') ||
        fieldEl.classList.contains('billto-gstin');
      const isBillToDateField = fieldEl.classList.contains('billto-date');

      if (isOptionalBillToField && !fieldValue) {
        const fieldWrapper = fieldEl.closest('.billto-field');
        if (fieldWrapper) {
          fieldWrapper.remove();
        } else {
          fieldEl.remove();
        }
        return;
      }

      const valueNode = document.createElement('span');
      if (isBillToDateField) {
        const dt = fieldValue ? new Date(`${fieldValue}T00:00:00`) : null;
        const formattedDate = dt && !isNaN(dt.getTime())
          ? `${String(dt.getDate()).padStart(2, '0')}-${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][dt.getMonth()]}-${dt.getFullYear()}`
          : '';
        valueNode.className = `${fieldEl.className} print-field-value print-date-value`;
        valueNode.textContent = formattedDate ? `Date: - ${formattedDate}` : 'Date: -';
      } else {
        valueNode.className = fieldEl.tagName === 'TEXTAREA'
          ? `${fieldEl.className} print-field-value print-field-textarea`
          : `${fieldEl.className} print-field-value`;
        valueNode.textContent = fieldValue;
      }
      fieldEl.replaceWith(valueNode);
    });
    const printConsumerNo = printClone.querySelector('.billto-consumerno.print-field-value');
    const printDateValue = printClone.querySelector('.billto-date.print-date-value');
    if (printConsumerNo && printDateValue) {
      const dateStrong = document.createElement('strong');
      dateStrong.className = 'print-date-inline';
      dateStrong.textContent = printDateValue.textContent;
      printConsumerNo.classList.add('print-consumerno-with-date');
      printConsumerNo.appendChild(dateStrong);
      const dateRow = printDateValue.closest('.billto-date-row');
      if (dateRow) {
        dateRow.remove();
      }
    }
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('');
    const printOnlyStyles = `
      <style>
        @page {
          margin: 6mm;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
        }
        body {
          display: block !important;
          place-items: initial !important;
          align-items: initial !important;
          justify-content: initial !important;
          overflow: auto !important;
        }
        .book-view {
          margin-top: 20px !important;
          padding: 0 !important;
        }
        .invoice-container {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        .invoice-tax-label {
          font-size: 12px !important;
          margin-bottom: 4px !important;
        }
        .invoice-header {
          padding: 6px 6px 8px 6px !important;
          gap: 8px !important;
        }
        .invoice-brand {
          grid-template-columns: 180px 1fr !important;
          gap: 8px !important;
        }
        .invoice-logo-image {
          width: 180px !important;
          height: 60px !important;
        }
        .invoice-title {
          font-size: 14px !important;
          line-height: 1.2 !important;
          letter-spacing: 0 !important;
        }
        .invoice-sub {
          font-size: 10px !important;
          line-height: 1.25 !important;
        }
        .invoice-table {
          width: 100% !important;
          table-layout: fixed !important;
        }
        .invoice-table th,
        .invoice-table td {
          padding: 4px 5px !important;
          word-break: break-word !important;
          white-space: normal !important;
        }
        .invoice-table thead th {
          font-size: 10px !important;
          line-height: 1.15 !important;
        }
        .invoice-table tbody td {
          font-size: 9px !important;
        }
        .invoice-table th:nth-child(2),
        .invoice-table td:nth-child(2) {
          width: 34% !important;
          min-width: 0 !important;
        }
        .invoice-table th:nth-child(1),
        .invoice-table td:nth-child(1) {
          width: 4% !important;
        }
        .invoice-table th:nth-child(3),
        .invoice-table td:nth-child(3) {
          width: 6% !important;
        }
        .invoice-table th:nth-child(4),
        .invoice-table td:nth-child(4) {
          width: 9% !important;
        }
        .invoice-table th:nth-child(5),
        .invoice-table td:nth-child(5),
        .invoice-table th:nth-child(6),
        .invoice-table td:nth-child(6),
        .invoice-table th:nth-child(7),
        .invoice-table td:nth-child(7),
        .invoice-table th:nth-child(8),
        .invoice-table td:nth-child(8),
        .invoice-table th:nth-child(9),
        .invoice-table td:nth-child(9),
        .invoice-table th:nth-child(10),
        .invoice-table td:nth-child(10) {
          width: 7% !important;
        }
        .invoice-actions,
        .invoice-row-remove {
          display: none !important;
        }
        .invoice-table th:last-child,
        .invoice-table td:last-child {
          display: none !important;
        }
        .print-select-value {
          display: inline-block;
          width: 100%;
          box-sizing: border-box;
          padding: 6px 8px;
          font-size: 11px;
          line-height: 1.3;
          word-break: break-word;
        }
        .print-field-value {
          display: inline-block;
          width: 100%;
          box-sizing: border-box;
          padding: 6px 8px;
          font-size: 11px;
          line-height: 1.3;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .print-field-textarea {
          min-height: 54px;
        }
        .print-consumerno-with-date {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .print-date-inline {
          font-weight: 700;
          white-space: nowrap;
        }
      </style>
    `;
    const html = `
      <html>
        <head>
          <title>Invoice</title>
          ${styles}
          ${printOnlyStyles}
        </head>
        <body>
          <div class="book-view">
            ${printClone.outerHTML}
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.scrollTo(0, 0);
      printWindow.print();
    }, 300);
  };

  useEffect(() => {
    if (loggedInUser?.bankDetailsData) {
      setBankDetails((prev) => ({ ...prev, ...loggedInUser.bankDetailsData }));
    } else {
      setBankDetails(defaultBankDetails);
    }
  }, [loggedInUser?.bankDetailsData]);

  return (
    <div className="placeholder-container">
      <div className="invoice-container" ref={invoicePrintRef}>
        <div className="invoice-tax-label">Tax Invoice</div>
        <div className="invoice-header">
          <div className="invoice-brand">
            <div className="invoice-brand-logo">
              <img src="/logo.jpg" alt="Distributor Logo" className="invoice-logo-image" />
            </div>
            <div className="invoice-brand-details">
              <div className="invoice-title">{dealer.name}</div>
              <div className="invoice-sub">{dealer.address}</div>
              <div className="invoice-sub">Contact: {dealer.contact}</div>
              <div className="invoice-sub">GSTIN: {dealer.gstn}</div>
            </div>
          </div>
        </div>
        <div className="invoice-grid">
          <div className="section-box billto-section">
            <span className="section-label">Bill To</span>
            <div className="billto-form">
              <div className="billto-field billto-name">
                <label>Consumer Name</label>
                <input className="invoice-input" placeholder="Consumer Name" value={billToName} onChange={(e) => setBillToName(toUpperValue(e.target.value))} />
              </div>
              <div className="billto-field billto-consumerno">
                <label>Consumer No (if available)</label>
                <input className="invoice-input billto-consumerno" placeholder="Consumer No (if available)" value={billToConsumerNo} onChange={(e) => setBillToConsumerNo(toUpperValue(e.target.value))} />
              </div>
              <div className="billto-inline-row">
                <div className="billto-field">
                  <label>Mobile No</label>
                  <input className="invoice-input billto-mobile" placeholder="Mobile No" value={billToMobileNo} onChange={(e) => setBillToMobileNo(toUpperValue(e.target.value))} />
                </div>
                <div className="billto-field">
                  <label>Center No</label>
                  <input className="invoice-input billto-centerno" placeholder="Center No" value={billToCenterNo} onChange={(e) => setBillToCenterNo(toUpperValue(e.target.value))} />
                </div>
              </div>
              <div className="billto-field billto-address">
                <label>Address</label>
                <textarea className="invoice-textarea" placeholder="Address" value={billToAddress} onChange={(e) => setBillToAddress(toUpperValue(e.target.value))} />
              </div>
              <div className="billto-field billto-gstin">
                <label>GSTIN (if available)</label>
                <input className="invoice-input billto-gstin" placeholder="GSTIN (if available)" value={billToGstin} onChange={(e) => setBillToGstin(toUpperValue(e.target.value))} />
              </div>
              <div className="billto-date-row">
                <div className="billto-field">
                  <label>Date</label>
                  <input className="invoice-input billto-date" type="date" value={billToDate} onChange={(e) => setBillToDate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Sr</th>
              <th>Goods & Service Description</th>
              <th>HSN</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Discount</th>
              <th>Taxable</th>
              <th>GST %</th>
              <th>GST Amt</th>
              <th>Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {invoiceRates.length > 0 ? (
              lineItems.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    <select className="invoice-input" value={row.item} onChange={(e) => handleRowItemChange(row.id, e.target.value)}>
                      <option value="">Select Product</option>
                      {invoiceRates.map((rate) => (
                        <option key={`${rate.Code}-${rate.Item}`} value={rate.Item}>{rate.Item}</option>
                      ))}
                    </select>
                  </td>
                  <td>{row.rateData?.HSNCode ?? row.rateData?.Code ?? '-'}</td>
                  <td>
                    <input
                      className="invoice-input"
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => handleRowQuantityChange(row.id, e.target.value)}
                    />
                  </td>
                  <td>
                    {isPastInvoiceDate ? (
                      <input
                        className="invoice-input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.customRate === '' ? (row.rateData?.RSP ?? '') : row.customRate}
                        onChange={(e) => handleRowRateChange(row.id, e.target.value)}
                      />
                    ) : (
                      row.unitRate.toFixed(2)
                    )}
                  </td>
                  <td>
                    <input
                      className="invoice-input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.discount || ''}
                      onChange={(e) => handleRowDiscountChange(row.id, e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td>{row.taxable.toFixed(2)}</td>
                  <td>{row.gstPercent.toFixed(2)}%</td>
                  <td>{row.gst.toFixed(2)}</td>
                  <td>{row.total.toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="invoice-row-remove"
                      onClick={() => handleRemoveProduct(row.id)}
                      disabled={invoiceRows.length <= 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center' }}>
                  No rate data found. Please update rates from the Rate Update section.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="invoice-actions">
          <button type="button" className="btn-add-product" onClick={handleAddProduct}>Add Product</button>
          <button type="button" className="btn-print-invoice" onClick={handlePrintInvoice}>Print Invoice</button>
          <button type="button" className="btn-clear-invoice" onClick={handleClearInvoice}>Clear</button>
          <button type="button" className="btn-reset-invoice" onClick={handleResetInvoice}>Reset</button>
        </div>
        <div className="invoice-summary">
          <div className="summary-box">
            <div className="summary-header">SUMMARY</div>
            <table className="summary-table">
              <tbody>
                <tr><td>Sub-Total</td><td>{taxableAmount.toFixed(2)}</td></tr>
                <tr><td>GST</td><td>{gstAmount.toFixed(2)}</td></tr>
                <tr><td>Total</td><td>{lineTotal.toFixed(2)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="summary-box">
            <div className="summary-header">AMOUNT</div>
            <table className="summary-table">
              <tbody>
                <tr><td>CGST Amt</td><td>{cgstAmount.toFixed(2)}</td></tr>
                <tr><td>SGST Amt</td><td>{sgstAmount.toFixed(2)}</td></tr>
                <tr><td>Round Off</td><td>{roundOff.toFixed(2)}</td></tr>
                <tr><td>Total Amount</td><td><strong>{payableTotal.toFixed(2)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="invoice-total-words-bar">
          <strong>Invoice Total in Words: {payableTotalInWords}</strong>
        </div>
        <div className="invoice-footer">
          <div className="invoice-bank">
            <div><strong>Our Bank Details</strong></div>
            <div>Bank Name: {bankDetails.bankName}</div>
            <div>Branch: {bankDetails.branch}</div>
            <div>Account No: {bankDetails.accountNo}</div>
            <div>IFSC Code: {bankDetails.ifsc}</div>
          </div>
          <div className="invoice-declaration">
            <div><strong>Declaration</strong></div>
            <div>1. Terms & conditions are subject to our trade policy</div>
            <div>2. Our risk & responsibility ceases after the delivery of goods.</div>
            <div>E & O.E.</div>
          </div>
        </div>
        <div className="invoice-bottom">“This is computer generated invoice no signature required.”</div>
      </div>
    </div>
  );
}

export default InvoicePage;
