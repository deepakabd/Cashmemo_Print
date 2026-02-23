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

  const handleRateChange = (index, field, value) => {
    const newRates = [...rates];
    newRates[index][field] = parseFloat(value) || 0;
    setRates(newRates);
  };

  const handleSave = () => {
    alert('Rates saved successfully!');
    console.log('Updated Rates:', rates);
    onClose(); // Close the page after saving
  };

  return (
    <div className="placeholder-container">
      <h2>Rate Update</h2>
      <div className="rate-table-container">
        <table>
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
                  <input
                    type="number"
                    value={rate.BasicPrice}
                    onChange={(e) => handleRateChange(index, 'BasicPrice', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={rate.SGST}
                    onChange={(e) => handleRateChange(index, 'SGST', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={rate.CGST}
                    onChange={(e) => handleRateChange(index, 'CGST', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={rate.RSP}
                    onChange={(e) => handleRateChange(index, 'RSP', e.target.value)}
                  />
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
