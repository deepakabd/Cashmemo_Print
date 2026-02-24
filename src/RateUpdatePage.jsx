import React, { useState, useEffect } from 'react';

const initialRates = [
  { Code: 36, HSNCode: 36, Item: '14.2 KG NON-SUBSIDIZED CYLINDER', BasicPrice: 904.76, SGST: 2.5, CGST: 2.5, RSP: 950 },
  { Code: 36, HSNCode: 36, Item: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', BasicPrice: 904.76, SGST: 2.5, CGST: 2.5, RSP: 950 },
  { Code: 64, HSNCode: 64, Item: '19 KG FILLED LPG CYLINDER', BasicPrice: 1700.85, SGST: 9, CGST: 9, RSP: 2007 },
  { Code: 109, HSNCode: 109, Item: '5 KG NON-SUBSIDIZED CYLINDER', BasicPrice: 336.67, SGST: 2.5, CGST: 2.5, RSP: 353.5 },
  { Code: 109, HSNCode: 109, Item: '5 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', BasicPrice: 336.67, SGST: 2.5, CGST: 2.5, RSP: 353.5 },
  { Code: 122, HSNCode: 122, Item: '35 KG FILLED LPG CYLINDER', BasicPrice: 3134.75, SGST: 9, CGST: 9, RSP: 3699 },
  { Code: 42, HSNCode: 42, Item: '47.5 KG FILLED LPG CYLINDER (NDNE)', BasicPrice: 4247.88, SGST: 9, CGST: 9, RSP: 5012.5 },
  { Code: 149, HSNCode: 149, Item: '5 KG FILLED LPG CYLINDER (NDNE)', BasicPrice: 507.2, SGST: 9, CGST: 9, RSP: 598.5 },
  { Code: 27, HSNCode: 27, Item: '5 KG FILLED LPG CYLINDER (FTL)', BasicPrice: 1248.31, SGST: 9, CGST: 9, RSP: 1473 },
  { Code: 450, HSNCode: 450, Item: '425 KG (SUMO) FILLED LPG CYLINDER', BasicPrice: 38057.63, SGST: 9, CGST: 9, RSP: 44908 },
  { Code: 102, HSNCode: 102, Item: '2 KG LPG CYLINDER REFILL - FILLED', BasicPrice: 237.29, SGST: 9, CGST: 9, RSP: 280 },
  { Code: 66, HSNCode: 66, Item: '19KG FILLED HP GAS FLAME PLUS', BasicPrice: 1718.22, SGST: 9, CGST: 9, RSP: 2027.5 },
  { Code: 43, HSNCode: 43, Item: '47.5KG FILLED HP GAS FLAME PLUS', BasicPrice: 4290.25, SGST: 9, CGST: 9, RSP: 5062.5 },
];

function RateUpdatePage({ onClose }) {
  const [rates, setRates] = useState(initialRates);

  useEffect(() => {
    const saved = localStorage.getItem('ratesData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRates(parsed.map((row) => ({ ...row, HSNCode: row.HSNCode ?? '' })));
        }
      } catch {}
    }
  }, []);

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

  const handleFieldChange = (index, field, value) => {
    setRates((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };
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
      { Code: '', HSNCode: '', Item: '', BasicPrice: 0, SGST: 0, CGST: 0, RSP: '' },
    ]);
  };

  const handleSave = () => {
    localStorage.setItem('ratesData', JSON.stringify(rates));
    alert('Rates saved successfully!');
    onClose();
  };

  return (
    <div className="placeholder-container">
      <h2>Rate Update</h2>
      <div className="rate-table-container">
        <table className="rate-table">
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
            {rates.map((rate, index) => (
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
                    className="rate-input"
                    type="text"
                    value={rate.Item ?? ''}
                    onChange={(e) => handleFieldChange(index, 'Item', e.target.value)}
                  />
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
                </td>
                <td>
                  <button
                    type="button"
                    className="rate-row-remove"
                    onClick={() => setRates((prev) => prev.filter((_, i) => i !== index))}
                    disabled={rates.length <= 1}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rate-update-actions">
        <button onClick={handleAddProduct}>Add Product</button>
        <button onClick={handleSave}>Save Rates</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default RateUpdatePage;
