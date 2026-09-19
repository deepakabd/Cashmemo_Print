import React, { useState, useEffect } from 'react';
import { resolveRatesForDate } from './utils/rateUtils';

const initialRates = [
  { Code: 36, HSNCode: '27111900', Item: '14.2 KG NON-SUBSIDIZED CYLINDER', BasicPrice: 904.76, SGST: 2.5, CGST: 2.5, RSP: 950 },
  { Code: 36, HSNCode: '27111900', Item: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', BasicPrice: 904.76, SGST: 2.5, CGST: 2.5, RSP: 950 },
  { Code: 64, HSNCode: '27111900', Item: '19 KG FILLED LPG CYLINDER', BasicPrice: 1700.85, SGST: 9, CGST: 9, RSP: 2007 },
  { Code: 109, HSNCode: '27111900', Item: '5 KG NON-SUBSIDIZED CYLINDER', BasicPrice: 336.67, SGST: 2.5, CGST: 2.5, RSP: 353.5 },
  { Code: 109, HSNCode: '27111900', Item: '5 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', BasicPrice: 336.67, SGST: 2.5, CGST: 2.5, RSP: 353.5 },
  { Code: 122, HSNCode: '27111900', Item: '35 KG FILLED LPG CYLINDER', BasicPrice: 3134.75, SGST: 9, CGST: 9, RSP: 3699 },
  { Code: 42, HSNCode: '27111900', Item: '47.5 KG FILLED LPG CYLINDER (NDNE)', BasicPrice: 4247.88, SGST: 9, CGST: 9, RSP: 5012.5 },
  { Code: 149, HSNCode: '27111900', Item: '5 KG FILLED LPG CYLINDER (NDNE)', BasicPrice: 507.2, SGST: 9, CGST: 9, RSP: 598.5 },
  { Code: 27, HSNCode: '27111900', Item: '5 KG FILLED LPG CYLINDER (FTL)', BasicPrice: 1248.31, SGST: 9, CGST: 9, RSP: 1473 },
  { Code: 450, HSNCode: '27111900', Item: '425 KG (SUMO) FILLED LPG CYLINDER', BasicPrice: 38057.63, SGST: 9, CGST: 9, RSP: 44908 },
  { Code: 102, HSNCode: '27111900', Item: '2 KG LPG CYLINDER REFILL - FILLED', BasicPrice: 237.29, SGST: 9, CGST: 9, RSP: 280 },
  { Code: 66, HSNCode: '27111900', Item: '19KG FILLED HP GAS FLAME PLUS', BasicPrice: 1718.22, SGST: 9, CGST: 9, RSP: 2027.5 },
  { Code: 43, HSNCode: '27111900', Item: '47.5KG FILLED HP GAS FLAME PLUS', BasicPrice: 4290.25, SGST: 9, CGST: 9, RSP: 5062.5 },
];

function RateUpdatePage({ onClose, initialRatesData = null, onSaveRates, updatedBy = 'Dealer', requestState = null }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedEffectiveDate, setSelectedEffectiveDate] = useState(`${currentMonth}-01`);
  const [showTaxColumns, setShowTaxColumns] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [showHistory, setShowHistory] = useState(false);
  const [rates, setRates] = useState(() => initialRates.map((row) => ({ ...row, RateMonth: currentMonth, RateEffectiveFrom: `${currentMonth}-01` })));

  useEffect(() => {
    const requestStatus = String(requestState?.status || '').toLowerCase();
    const requestRates = Array.isArray(requestState?.payload) ? requestState.payload : null;
    const sourceRates = requestRates?.length && ['pending', 'rejected'].includes(requestStatus)
      ? requestRates
      : initialRatesData;
    if (Array.isArray(sourceRates) && sourceRates.length > 0) {
      setRates(sourceRates.map((row) => {
        const rateMonth = row.RateMonth || String(row.RateEffectiveFrom || '').slice(0, 7) || currentMonth;
        const status = row.RateStatus === 'Pending' && requestStatus === 'rejected' ? 'Rejected' : row.RateStatus;
        return { ...row, RateMonth: rateMonth, RateEffectiveFrom: row.RateEffectiveFrom || `${rateMonth}-01`, RateStatus: status || 'Approved', HSNCode: String(row.HSNCode ?? '27111900') || '27111900' };
      }));
      return;
    }
    const saved = localStorage.getItem('ratesData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRates(parsed.map((row) => {
            const rateMonth = row.RateMonth || String(row.RateEffectiveFrom || '').slice(0, 7) || currentMonth;
            return { ...row, RateMonth: rateMonth, RateEffectiveFrom: row.RateEffectiveFrom || `${rateMonth}-01`, RateStatus: row.RateStatus || 'Draft', HSNCode: String(row.HSNCode ?? '27111900') || '27111900' };
          }));
        }
      } catch {
        // Ignore an invalid optional local cache and retain the default rates.
      }
    }
  }, [initialRatesData, currentMonth, requestState]);

  const revisionRates = rates.filter((row) => row.RateEffectiveFrom === selectedEffectiveDate);
  const matchesCategory = (row) => category === 'all'
    || (category === 'cylinder' ? /cylinder/i.test(row.Item || '') : !/cylinder/i.test(row.Item || ''));
  const monthRates = revisionRates.filter((row) => {
    const needle = search.trim().toLowerCase();
    return matchesCategory(row) && (!needle || [row.Item, row.Code, row.HSNCode].join(' ').toLowerCase().includes(needle));
  });
  const savedRevisionDates = [...new Set(rates
    .map((row) => row.RateEffectiveFrom)
    .filter((date) => String(date).startsWith(`${selectedMonth}-`)))].sort();
  const [selectedYear, selectedMonthNumber] = selectedMonth.split('-').map(Number);
  const selectedMonthEnd = new Date(Date.UTC(selectedYear, selectedMonthNumber, 0)).toISOString().slice(0, 10);
  const nextRevisionDate = rates.map((row) => row.RateEffectiveFrom).filter((date) => date > selectedEffectiveDate).sort()[0] || '';
  const previewRates = resolveRatesForDate(rates, previewDate);
  const productKey = (row) => String(row.Code || row.Item || '').trim().toLowerCase();
  const previousVersion = (rate) => rates
    .filter((row) => productKey(row) === productKey(rate) && row.RateEffectiveFrom < rate.RateEffectiveFrom)
    .sort((a, b) => b.RateEffectiveFrom.localeCompare(a.RateEffectiveFrom))[0];
  const rateChange = (rate) => {
    const previous = previousVersion(rate);
    if (!previous) return null;
    const amount = Number(rate.RSP || 0) - Number(previous.RSP || 0);
    return { amount, percent: Number(previous.RSP) ? (amount / Number(previous.RSP)) * 100 : 0, oldRate: Number(previous.RSP || 0) };
  };

  const recalculateBasicPrice = (row) => {
    const rspNum = parseFloat(row.RSP);
    const sgst = parseFloat(row.SGST) || 0;
    const cgst = parseFloat(row.CGST) || 0;
    if (isNaN(rspNum)) {
      return { ...row, BasicPrice: 0 };
    }
    const factor = 1 + sgst / 100 + cgst / 100;
    const basic = factor > 0 ? parseFloat((rspNum / factor).toFixed(2)) : 0;
    return { ...row, BasicPrice: basic };
  };
//hi
  const handleFieldChange = (rowIndex, field, value) => {
    setRates((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;
        const updated = { ...row, [field]: value, RateStatus: 'Draft' };
        if (field === 'RSP' || field === 'SGST' || field === 'CGST') {
          return recalculateBasicPrice(updated);
        }
        return updated;
      })
    );
  };

  const handleAddProduct = () => {
    setRates((prev) => [
      ...prev,
      { Code: '', HSNCode: '27111900', Item: '', BasicPrice: 0, SGST: 0, CGST: 0, RSP: '', RateMonth: selectedMonth, RateEffectiveFrom: selectedEffectiveDate, RateStatus: 'Draft' },
    ]);
  };

  const handleCopyPreviousMonth = () => {
    const sourceDates = [...new Set(rates.map((row) => row.RateEffectiveFrom).filter((date) => date < selectedEffectiveDate))].sort();
    const sourceDate = sourceDates.at(-1);
    if (!sourceDate) return;
    const copiedRates = rates
      .filter((row) => row.RateEffectiveFrom === sourceDate)
      .map((row) => ({ ...row, RateMonth: selectedMonth, RateEffectiveFrom: selectedEffectiveDate, RateStatus: 'Draft' }));
    setRates((prev) => [...prev.filter((row) => row.RateEffectiveFrom !== selectedEffectiveDate), ...copiedRates]);
  };

  const handleSave = async () => {
    const now = new Date().toISOString();
    const payload = rates.map((row) => row.RateEffectiveFrom === selectedEffectiveDate
      ? { ...row, RateStatus: 'Pending', RateUpdatedAt: now, RateUpdatedBy: updatedBy }
      : row);
    localStorage.setItem('ratesData', JSON.stringify(payload));
    if (typeof onSaveRates === 'function') {
      const saved = await onSaveRates(payload);
      if (saved === false) return;
    }
    setRates(payload);
    alert('Rates request submitted successfully.');
    onClose();
  };

  return (
    <div className="placeholder-container">
      <h2>Rate Update</h2>
      <div className="rate-month-toolbar">
        <label>
          Rate Month
          <input type="month" value={selectedMonth} onChange={(event) => { const month = event.target.value; setSelectedMonth(month); setSelectedEffectiveDate(`${month}-01`); }} />
          <small>Jis month ke rates dekhne ya update karne hain.</small>
        </label>
        <label>
          Effective From
          <input required type="date" min={`${selectedMonth}-01`} max={selectedMonthEnd} value={selectedEffectiveDate} onChange={(event) => setSelectedEffectiveDate(event.target.value)} />
          <small>Naya rate is date se bill mein apply hoga.</small>
        </label>
        {savedRevisionDates.length > 0 && (
          <label>
            Saved Revisions
            <select value={savedRevisionDates.includes(selectedEffectiveDate) ? selectedEffectiveDate : ''} onChange={(event) => event.target.value && setSelectedEffectiveDate(event.target.value)}>
              <option value="">New revision</option>
              {savedRevisionDates.map((date) => <option key={date} value={date}>{date}</option>)}
            </select>
            <small>Is month ke purane rate versions dekhein.</small>
          </label>
        )}
        {monthRates.length === 0 && (
          <button type="button" onClick={handleCopyPreviousMonth}>Copy Previous Rates</button>
        )}
        <button
          type="button"
          className="rate-column-toggle"
          aria-pressed={showTaxColumns}
          onClick={() => setShowTaxColumns((visible) => !visible)}
        >
          {showTaxColumns ? 'Hide Extra Columns' : 'Show Extra Columns'}
        </button>
      </div>
      <p className="rate-effective-note">
        <strong>Rate rule:</strong> Normally month ki 1st date select karein. Beech month rate change ho, to change wali date select karke new revision banayein.
      </p>
      <div className="rate-revision-summary">
        <span className={`rate-status rate-status--${String(revisionRates[0]?.RateStatus || requestState?.status || 'draft').toLowerCase()}`}>
          {revisionRates[0]?.RateStatus || requestState?.status || 'Draft'}
        </span>
        <strong>Applicable:</strong>
        <span>{selectedEffectiveDate} se {nextRevisionDate ? `${nextRevisionDate} se ek din pehle tak` : 'next revision tak'}</span>
        {selectedEffectiveDate.slice(-2) !== '01' && <span className="rate-conflict-warning">Mid-month change: is date se purana rate replace hoga.</span>}
        {revisionRates[0]?.RateUpdatedAt && <span>Updated by {revisionRates[0].RateUpdatedBy || 'Dealer'} · {new Date(revisionRates[0].RateUpdatedAt).toLocaleString('en-IN')}</span>}
        {revisionRates[0]?.RateApprovedAt && <span>Approved {new Date(revisionRates[0].RateApprovedAt).toLocaleString('en-IN')}</span>}
      </div>
      <div className="rate-management-tools">
        <label>Search products<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, product code or HSN" /></label>
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All products</option><option value="cylinder">Cylinders</option><option value="accessory">Accessories</option></select></label>
        <label>Rate preview date<input type="date" value={previewDate} onChange={(event) => setPreviewDate(event.target.value)} /></label>
        <button type="button" onClick={() => setShowHistory((visible) => !visible)}>{showHistory ? 'Hide History' : 'Rate-change History'}</button>
      </div>
      <div className="rate-preview-panel">
        <strong>Preview for {previewDate}</strong>
        <span>{previewRates.length} products · revision effective {previewRates[0]?.RateEffectiveFrom || 'not available'}</span>
        <div>{previewRates.slice(0, 5).map((row) => <span key={`${row.Code}-${row.Item}`}>{row.Item}: ₹{Number(row.RSP || 0).toLocaleString('en-IN')}</span>)}</div>
      </div>
      <div className="rate-table-container">
        <table className={`rate-table${showTaxColumns ? '' : ' rate-table--tax-hidden'}`}>
          <thead>
            <tr>
              <th>Product Code</th>
              <th>HSN Code</th>
              <th>Item</th>
              <th>Basic Price (Rs)</th>
              <th>SGST/UTGST (%)</th>
              <th>CGST (%)</th>
              <th>RSP (Rs)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {monthRates.map((rate) => {
              const index = rates.indexOf(rate);
              return (
              <tr key={`${rate.Code || 'new'}-${index}`}>
                <td>
                  <input
                    className="rate-input"
                    type="text"
                    value={rate.Code ?? ''}
                    onChange={(e) => handleFieldChange(index, 'Code', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="rate-input"
                    type="text"
                    value={rate.HSNCode ?? ''}
                    onChange={(e) => handleFieldChange(index, 'HSNCode', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="rate-input rate-item-input"
                    type="text"
                    size={Math.min(80, Math.max(24, String(rate.Item ?? '').length + 2))}
                    value={rate.Item ?? ''}
                    onChange={(e) => handleFieldChange(index, 'Item', e.target.value)}
                  />
                  <small className={`rate-row-status rate-row-status--${String(rate.RateStatus || 'draft').toLowerCase()}`}>{rate.RateStatus || 'Draft'}</small>
                </td>
                <td>
                  <input className="rate-input read-only" type="number" value={rate.BasicPrice} readOnly />
                </td>
                <td>
                  <input
                    className="rate-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={rate.SGST ?? ''}
                    onChange={(e) => handleFieldChange(index, 'SGST', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="rate-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={rate.CGST ?? ''}
                    onChange={(e) => handleFieldChange(index, 'CGST', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="rate-input"
                    type="number"
                    step="0.01"
                    value={rate.RSP ?? ''}
                    onChange={(e) => handleFieldChange(index, 'RSP', e.target.value)}
                  />
                  {(() => {
                    const change = rateChange(rate);
                    if (!change || change.amount === 0) return null;
                    return <small className={`rate-change ${change.amount > 0 ? 'is-up' : 'is-down'}`}>{change.amount > 0 ? '+' : '-'}₹{Math.abs(change.amount).toLocaleString('en-IN')} ({change.amount > 0 ? '+' : ''}{change.percent.toFixed(2)}%)</small>;
                  })()}
                </td>
                <td>
                  <button
                    type="button"
                    className="rate-row-remove"
                    onClick={() => setRates((prev) => prev.filter((_, i) => i !== index))}
                    disabled={monthRates.length <= 1}
                    aria-label={`Remove ${rate.Item || 'product'}`}
                    title="Remove product"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.75 12h-8.5L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z" />
                    </svg>
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showHistory && (
        <section className="rate-history-panel">
          <h3>Rate-change History</h3>
          <div className="rate-table-container">
            <table className="rate-history-table">
              <thead><tr><th>Effective Date</th><th>Product</th><th>Old Rate</th><th>New Rate</th><th>Change</th><th>Status</th><th>Audit</th></tr></thead>
              <tbody>{[...rates].sort((a, b) => b.RateEffectiveFrom.localeCompare(a.RateEffectiveFrom)).map((row, historyIndex) => {
                const change = rateChange(row);
                return <tr key={`${row.RateEffectiveFrom}-${productKey(row)}-${historyIndex}`}><td>{row.RateEffectiveFrom}</td><td>{row.Item}</td><td>{change ? `₹${change.oldRate.toLocaleString('en-IN')}` : '—'}</td><td>₹{Number(row.RSP || 0).toLocaleString('en-IN')}</td><td className={change?.amount > 0 ? 'is-up' : change?.amount < 0 ? 'is-down' : ''}>{change ? `${change.amount > 0 ? '+' : '-'}₹${Math.abs(change.amount).toLocaleString('en-IN')}` : 'Opening rate'}</td><td>{row.RateStatus || 'Approved'}</td><td>{row.RateUpdatedBy || '—'}{row.RateUpdatedAt ? ` · ${new Date(row.RateUpdatedAt).toLocaleString('en-IN')}` : ''}</td></tr>;
              })}</tbody>
            </table>
          </div>
        </section>
      )}
      <div className="rate-update-actions">
        <button onClick={handleAddProduct}>Add Product</button>
        <button onClick={handleSave}>Save Rates</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default RateUpdatePage;
