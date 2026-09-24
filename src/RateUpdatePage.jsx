import React, { useState, useEffect } from 'react';
import { resolveRatesForDate } from './utils/rateUtils';
import { loadRatesFromCloudflare } from './services/rateRepository';

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

const rateProductKey = (row) => `${String(row?.Code ?? '').trim()}|${String(row?.Item ?? '').trim().toLowerCase()}`;
const withDefaultProductsForDate = (rows, effectiveDate) => {
  const existing = Array.isArray(rows) ? rows : [];
  const selectedKeys = new Set(existing.filter((row) => row.RateEffectiveFrom === effectiveDate).map(rateProductKey));
  const templates = new Map(initialRates.map((row) => [rateProductKey(row), row]));
  [...existing]
    .sort((a, b) => String(a.RateEffectiveFrom || '').localeCompare(String(b.RateEffectiveFrom || '')))
    .forEach((row) => { if (row?.Item) templates.set(rateProductKey(row), row); });
  const missing = [...templates.entries()]
    .filter(([key]) => !selectedKeys.has(key))
    .map(([, row]) => {
      const cleanRow = Object.fromEntries(Object.entries(row).filter(([key, value]) => value !== undefined && !['RateUpdatedAt', 'RateUpdatedBy', 'RateApprovedAt'].includes(key)));
      return {
        ...cleanRow,
        RateMonth: effectiveDate.slice(0, 7),
        RateEffectiveFrom: effectiveDate,
        RateStatus: 'Draft',
        HSNCode: String(row.HSNCode ?? '27111900') || '27111900',
      };
    });
  return missing.length ? [...existing, ...missing] : existing;
};

function RateUpdatePage({ onClose, initialRatesData = null, onSaveRates, updatedBy = 'Dealer', requestState = null, userId = '' }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedEffectiveDate, setSelectedEffectiveDate] = useState(`${currentMonth}-01`);
  const [showTaxColumns, setShowTaxColumns] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [showHistory, setShowHistory] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all');
  const [excludedProducts, setExcludedProducts] = useState(() => new Set());
  const [manualBasicPrice, setManualBasicPrice] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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

  useEffect(() => {
    let active = true;
    void loadRatesFromCloudflare(userId).then((cloudRates) => {
      if (!active || !cloudRates.length) return;
      setRates((previous) => {
        const merged = new Map(previous.map((row) => [`${row.RateEffectiveFrom}|${rateProductKey(row)}`, row]));
        cloudRates.forEach((row) => merged.set(`${row.RateEffectiveFrom}|${rateProductKey(row)}`, row));
        return [...merged.values()];
      });
    }).catch(() => { /* Firebase rates remain available if D1 history cannot load. */ });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    setRates((previous) => withDefaultProductsForDate(previous, selectedEffectiveDate));
    setExcludedProducts(new Set());
    setHasUnsavedChanges(false);
  }, [selectedEffectiveDate, initialRatesData, requestState]);

  useEffect(() => {
    const warn = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);

  const revisionRates = rates.filter((row) => row.RateEffectiveFrom === selectedEffectiveDate);
  const matchesCategory = (row) => category === 'all'
    || (category === 'cylinder' ? /cylinder/i.test(row.Item || '') : !/cylinder/i.test(row.Item || ''));
  const filteredRevisionRates = revisionRates.filter((row) => {
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
  const monthRates = filteredRevisionRates.filter((row) => {
    const change = rateChange(row);
    if (quickFilter === 'changed') return Boolean(change?.amount);
    if (quickFilter === 'unchanged') return !change?.amount && Number(row.RSP) > 0;
    if (quickFilter === 'increased') return change?.amount > 0;
    if (quickFilter === 'decreased') return change?.amount < 0;
    if (quickFilter === 'missing') return !Number(row.RSP);
    return true;
  });
  const completedProducts = revisionRates.filter((row) => Number(row.RSP) > 0 && Number.isFinite(Number(row.SGST)) && Number.isFinite(Number(row.CGST))).length;
  const selectedProducts = revisionRates.filter((row) => !excludedProducts.has(rateProductKey(row)));

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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
    setRates((prev) => [
      ...prev,
      { Code: '', HSNCode: '27111900', Item: '', BasicPrice: 0, SGST: 0, CGST: 0, RSP: '', RateMonth: selectedMonth, RateEffectiveFrom: selectedEffectiveDate, RateStatus: 'Draft' },
    ]);
  };

  const handleCopyPreviousMonth = () => {
    const sourceDates = [...new Set(rates.map((row) => row.RateEffectiveFrom).filter((date) => date < selectedEffectiveDate))].sort();
    const sourceDate = sourceDates.at(-1);
    if (!sourceDate) return;
    setHasUnsavedChanges(true);
    const copiedRates = rates
      .filter((row) => row.RateEffectiveFrom === sourceDate)
      .map((row) => ({ ...row, RateMonth: selectedMonth, RateEffectiveFrom: selectedEffectiveDate, RateStatus: 'Draft' }));
    setRates((prev) => [...prev.filter((row) => row.RateEffectiveFrom !== selectedEffectiveDate), ...copiedRates]);
  };

  const handleSave = async () => {
    if (!selectedProducts.length) {
      alert('Select at least one product to update.');
      return;
    }
    const now = new Date().toISOString();
    const selectedKeys = new Set(selectedProducts.map(rateProductKey));
    const payload = rates.map((row) => row.RateEffectiveFrom === selectedEffectiveDate && selectedKeys.has(rateProductKey(row))
      ? { ...row, RateStatus: 'Pending', RateUpdatedAt: now, RateUpdatedBy: updatedBy }
      : row).map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)));
    localStorage.setItem('ratesData', JSON.stringify(payload));
    if (typeof onSaveRates === 'function') {
      try {
        const saved = await onSaveRates(payload);
        if (saved === false) return;
      } catch (error) {
        alert(error?.message || 'Cloud rate save failed. Please retry.');
        return;
      }
    }
    setRates(payload);
    setHasUnsavedChanges(false);
    alert('Rates request submitted successfully.');
    onClose();
  };

  const handleClose = () => {
    if (hasUnsavedChanges && !window.confirm('Rate changes अभी save नहीं हुए हैं। क्या आप बिना save किए page बंद करना चाहते हैं?')) return;
    onClose();
  };

  return (
    <div className="placeholder-container rate-update-page">
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
      <section className="rate-validation-summary is-valid" aria-label="Monthly rate completion">
        <div><strong>Monthly Completion</strong><span>{completedProducts}/{revisionRates.length} products updated</span></div>
        <progress max={Math.max(1, revisionRates.length)} value={completedProducts} />
        <div className="rate-validation-counts"><span>Selected: <b>{selectedProducts.length}</b></span></div>
      </section>
      <div className="rate-management-tools">
        <label>Search products<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, product code or HSN" /></label>
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All products</option><option value="cylinder">Cylinders</option><option value="accessory">Accessories</option></select></label>
        <label>Rate preview date<input type="date" value={previewDate} onChange={(event) => setPreviewDate(event.target.value)} /></label>
        <label>Quick filter<select value={quickFilter} onChange={(event) => setQuickFilter(event.target.value)}><option value="all">All products</option><option value="changed">Changed</option><option value="unchanged">Unchanged</option><option value="increased">Increased rates</option><option value="decreased">Decreased rates</option><option value="missing">Missing rates</option></select></label>
        <label className="rate-manual-toggle"><input type="checkbox" checked={manualBasicPrice} onChange={(event) => setManualBasicPrice(event.target.checked)} />Manual Basic Price</label>
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
              <th className="rate-select-column"><input type="checkbox" aria-label="Select all visible products" checked={monthRates.length > 0 && monthRates.every((row) => !excludedProducts.has(rateProductKey(row)))} onChange={(event) => setExcludedProducts((previous) => { const next = new Set(previous); monthRates.forEach((row) => { const key = rateProductKey(row); if (event.target.checked) next.delete(key); else next.add(key); }); return next; })} /></th>
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
                <td className="rate-select-column"><input type="checkbox" aria-label={`Select ${rate.Item || 'product'}`} checked={!excludedProducts.has(rateProductKey(rate))} onChange={(event) => setExcludedProducts((previous) => { const next = new Set(previous); const key = rateProductKey(rate); if (event.target.checked) next.delete(key); else next.add(key); return next; })} /></td>
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
                  <input className={`rate-input${manualBasicPrice ? '' : ' read-only'}`} type="number" step="0.01" min="0" value={rate.BasicPrice} readOnly={!manualBasicPrice} onChange={(event) => handleFieldChange(index, 'BasicPrice', event.target.value)} />
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
                    onClick={() => { setHasUnsavedChanges(true); setRates((prev) => prev.filter((_, i) => i !== index)); }}
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
        <button onClick={handleSave}>Save Selected Rates</button>
        <button onClick={handleClose}>Close</button>
      </div>
    </div>
  );
}

export default RateUpdatePage;
