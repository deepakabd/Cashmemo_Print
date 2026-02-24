import React, { useState, useEffect } from 'react';

const initialRates = [
  { Code: 36, Item: '14.2 KG NON-SUBSIDIZED CYLINDER', BasicPrice: 904.76, SGST: 2.5, CGST: 2.5, RSP: 950 },
  { Code: 36, Item: '14.2 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', BasicPrice: 904.76, SGST: 2.5, CGST: 2.5, RSP: 950 },
  { Code: 64, Item: '19 KG FILLED LPG CYLINDER', BasicPrice: 1700.85, SGST: 9, CGST: 9, RSP: 2007 },
  { Code: 109, Item: '5 KG NON-SUBSIDIZED CYLINDER', BasicPrice: 336.67, SGST: 2.5, CGST: 2.5, RSP: 353.5 },
  { Code: 109, Item: '5 KG NON-SUBSIDIZED CYLINDER-LD(DBTL CTC)', BasicPrice: 336.67, SGST: 2.5, CGST: 2.5, RSP: 353.5 },
  { Code: 122, Item: '35 KG FILLED LPG CYLINDER', BasicPrice: 3134.75, SGST: 9, CGST: 9, RSP: 3699 },
  { Code: 42, Item: '47.5 KG FILLED LPG CYLINDER (NDNE)', BasicPrice: 4247.88, SGST: 9, CGST: 9, RSP: 5012.5 },
  { Code: 149, Item: '5 KG FILLED LPG CYLINDER (NDNE)', BasicPrice: 507.2, SGST: 9, CGST: 9, RSP: 598.5 },
  { Code: 27, Item: '5 KG FILLED LPG CYLINDER (FTL)', BasicPrice: 1248.31, SGST: 9, CGST: 9, RSP: 1473 },
  { Code: 450, Item: '425 KG (SUMO) FILLED LPG CYLINDER', BasicPrice: 38057.63, SGST: 9, CGST: 9, RSP: 44908 },
  { Code: 102, Item: '2 KG LPG CYLINDER REFILL - FILLED', BasicPrice: 237.29, SGST: 9, CGST: 9, RSP: 280 },
  { Code: 66, Item: '19KG FILLED HP GAS FLAME PLUS', BasicPrice: 1718.22, SGST: 9, CGST: 9, RSP: 2027.5 },
  { Code: 43, Item: '47.5KG FILLED HP GAS FLAME PLUS', BasicPrice: 4290.25, SGST: 9, CGST: 9, RSP: 5062.5 },
];

function RateUpdatePage({ onClose }) {
  const [rates, setRates] = useState(initialRates);

  useEffect(() => {
    const saved = localStorage.getItem('ratesData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRates(parsed);
        }
      } catch {}
    }
  }, []);

  const handleRSPChange = (index, value) => {
    const newRates = [...rates];
    newRates[index].RSP = value === '' ? '' : value;
    const rspNum = parseFloat(value);
    if (!isNaN(rspNum)) {
      const sgst = parseFloat(newRates[index].SGST) || 0;
      const cgst = parseFloat(newRates[index].CGST) || 0;
      const factor = 1 + sgst / 100 + cgst / 100;
      newRates[index].BasicPrice = factor > 0 ? parseFloat((rspNum / factor).toFixed(2)) : 0;
    } else {
      newRates[index].BasicPrice = 0;
    }
    setRates(newRates);
  };

  const handleSave = () => {
    localStorage.setItem('ratesData', JSON.stringify(rates));
    alert('Rates saved successfully!');
    console.log('Updated Rates:', rates);
    onClose(); // Close the page after saving
  };

  return (
    <div className="placeholder-container">
      <h2>Rate Update</h2>
      <div className="rate-table-container">
        <table className="rate-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Item</th>
              <th>Basic Price (₹)</th>
              <th>SGST/UTGST (₹)</th>
              <th>CGST (₹)</th>
              <th>RSP (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate, index) => (
              <tr key={rate.Code}>
                <td>{rate.Code}</td>
                <td>{rate.Item}</td>
                <td>
                  <input className="rate-input read-only" type="number" value={rate.BasicPrice} readOnly />
                </td>
                <td>
                  <span className="tax-pill">
                    {rate.SGST}% (₹{(rate.BasicPrice * rate.SGST / 100).toFixed(2)})
                  </span>
                </td>
                <td>
                  <span className="tax-pill">
                    {rate.CGST}% (₹{(rate.BasicPrice * rate.CGST / 100).toFixed(2)})
                  </span>
                </td>
                <td>
                  <input className="rate-input" type="number" step="0.01" value={rate.RSP ?? ''} onChange={(e) => handleRSPChange(index, e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rate-update-actions">
        <button onClick={handleSave}>Save Rates</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default RateUpdatePage;
