import React from 'react';

const CashMemoEnglish = ({ customer, dealerDetails }) => {
  if (!customer) {
    return <p>Please select a customer to generate Cash Memo.</p>;
  }

  const distributorName = dealerDetails?.name || 'RAJE BHAWANISHANKAR ENTERPRISES (41012240)';
  const gstn = dealerDetails?.gstn || '27AEXPB6427K1ZZ';
  const plotNo = dealerDetails?.address?.plotNo || 'PLOT NO-3, SECTOR-6, CBD BELAPUR, MAHARASHTRA-400614';
  const email = dealerDetails?.contact?.email || 'raje.thane@hpgas.hpcl.co.in';
  const telephone = dealerDetails?.contact?.telephone || '022-27571972, 27573871';

  return (
    <div className="cash-memo-wrapper" style={{ border: '1px solid #ccc' }}>
      {/* Single Cash Memo Container */}
      <div className="cash-memo-single" style={{ display: 'flex', fontFamily: 'Arial, sans-serif', width: '100%', boxSizing: 'border-box' }}>

        {/* Distributor Copy Section (Left Half) */}
        <div className="distributor-copy" style={{ width: '50%', borderRight: '1px dashed black', padding: '5px', boxSizing: 'border-box', fontSize: '10px' }}>
          {/* Header for Distributor Copy */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid black', paddingBottom: '5px', marginBottom: '5px' }}>
            <img src="/src/logo.jpg" alt="HP Gas Logo" style={{ width: '100px', marginRight: '10px' }} />
            <div style={{ lineHeight: '1.2', flex: 1, textAlign: 'right', fontSize: '9px' }}>
              <p style={{ margin: '0', fontWeight: 'bold' }}>{distributorName}</p>
              <p style={{ margin: '0' }}>GSTN : {gstn}</p>
            </div>
          </div>
          <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Distributor Copy</p>

          {/* Customer Details - Simplified for Distributor Copy */}
          <div style={{ border: '1px solid black', padding: '5px', marginBottom: '5px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px' }}>
            <span>Consumer Name :</span><span>{customer['Consumer Name'] || 'N/A'}</span>
            <span>Consumer No / LPG ID :</span><span>{customer['Consumer No.'] || 'N/A'} / {customer['LPG ID'] || 'N/A'}</span>
            <span>Address:</span><span>{customer['Address'] || 'N/A'}</span>
            <span>Mobile No. :</span><span>{customer['Mobile No.'] || 'N/A'}</span>
            <span>Delivery Area :</span><span>{customer['Delivery Area'] || 'N/A'}</span>
            <span>Delivery Staff :</span><span>{customer['Delivery Staff'] || 'N/A'}</span>
            <span>Product / HSN / Qty :</span><span>{customer['Product Name'] || 'N/A'} / {customer['HSN'] || 'N/A'} / {customer['Quantity'] || 'N/A'}</span>
            <span>Order No. & Order Date :</span><span>{customer['Order No.'] || 'N/A'} & {customer['Order Date'] || 'N/A'}</span>
            <span>Cash Memo No. & Date :</span><span>{customer['Cash Memo No.'] || 'N/A'} & {customer['Cash Memo Date'] || 'N/A'}</span>
            <span>Last Delivery Date :</span><span>{customer['Last Delivery Date'] || 'N/A'}</span>
            <span>Base Price (₹) :</span><span>{parseFloat(customer['Base Price (₹)'] || 0).toFixed(2)}</span>
            <span>Dlvry Charges (₹) :</span><span>{parseFloat(customer['Delivery Charges (₹)'] || 0).toFixed(2)}</span>
            <span>C & C Rebate (₹) :</span><span>{parseFloat(customer['Cash & Carry Rebate (₹)'] || 0).toFixed(2)}</span>
            <span>CGST (2.5%) (₹) :</span><span>{parseFloat(customer['CGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
            <span>SGST (2.5%) (₹) :</span><span>{parseFloat(customer['SGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
            <span>Total Amount (₹) :</span><span>{parseFloat(customer['Total Amount (₹)'] || 0).toFixed(2)}</span>
            <span>Hose Expiry :</span><span>{customer['Hose Expiry'] || 'N/A'}</span>
            <span>Safety Chk :</span><span>{customer['Safety Check'] || 'N/A'}</span>
            <span>E-KYC :</span><span>{customer['E-KYC'] || 'N/A'}</span>
            <span>Payment :</span><span>{customer['Payment Type'] || 'N/A'}</span>
            <span>Sales Type :</span><span>{customer['Sales Type'] || 'N/A'}</span>
          </div>

          {/* Declaration */}
          <div style={{ border: '1px solid black', padding: '5px', minHeight: '100px', marginBottom: '5px', fontSize: '8px' }}>
            <p style={{ margin: '0' }}>
              Declaration : I hereby confirm receipt of filled LPG cylinder in sealed condition and above mentioned price. The cylinder was checked in my presence for correct weight & for any leakages to my satisfaction.
            </p>
            <div style={{ marginTop: '20px', borderTop: '1px solid black', width: '150px' }}>
              <p style={{ margin: '0', fontSize: '9px' }}>Signature of Customer</p>
            </div>
          </div>
        </div>

        {/* Tax Invoice Section (Right Half) */}
        <div className="tax-invoice" style={{ width: '50%', padding: '5px', boxSizing: 'border-box', fontSize: '10px', backgroundImage: 'url("/src/printback.jpg")', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}>
          {/* Header Section */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid black', paddingBottom: '5px', marginBottom: '5px' }}>
            <img src="/src/logo.jpg" alt="HP Gas Logo" style={{ width: '80px', marginRight: '10px' }} />
            <div style={{ lineHeight: '1.2' }}>
              <p style={{ margin: '0', fontWeight: 'bold' }}>{distributorName}</p>
              <p style={{ margin: '0' }}>{plotNo}</p>
              <p style={{ margin: '0' }}>Email : {email} | Telephone : {telephone}</p>
              <p style={{ margin: '0' }}>GSTN : {gstn}</p>
            </div>
          </div>

          {/* Contact Numbers Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: '9px', borderBottom: '1px solid black', marginBottom: '5px' }}>
            <span>HP ANYTIME <strong style={{ color: 'red' }}>8888823456</strong></span>
            <span>Whatsapp <strong style={{ color: 'red' }}>9222201122</strong></span>
            <span>Missed Call Booking No. <strong style={{ color: 'red' }}>9493602222</strong></span>
            <span>Complaint No. <strong style={{ color: 'red' }}>1800 233 3555</strong></span>
            <span><img src="/src/1906.jpg" alt="1906" style={{ height: '15px', verticalAlign: 'middle' }} /></span>
          </div>

          <h3 style={{ textAlign: 'center', margin: '5px 0', fontSize: '12px' }}>Tax Invoice</h3>

          {/* Customer Details and Order Details */}
          <div style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid black', marginBottom: '5px' }}>
            {/* Customer Details */}
            <div style={{ width: '49%', borderRight: '1px solid black', padding: '5px' }}>
              <h4 style={{ margin: '0 0 5px 0', textDecoration: 'underline', fontSize: '10px' }}>CUSTOMER DETAILS</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px' }}>
                <span>Consumer Name :</span><span>{customer['Consumer Name'] || 'N/A'}</span>
                <span>Consumer No / LPG ID :</span><span>{customer['Consumer No.'] || 'N/A'} / {customer['LPG ID'] || 'N/A'}</span>
                <span>Address:</span><span>{customer['Address'] || 'N/A'}</span>
                <span>Mobile No. :</span><span>{customer['Mobile No.'] || 'N/A'}</span>
                <span>Delivery Area :</span><span>{customer['Delivery Area'] || 'N/A'}</span>
                <span>Delivery Staff :</span><span>{customer['Delivery Staff'] || 'N/A'}</span>
                <span>Product / HSN / Qty :</span><span>{customer['Product Name'] || 'N/A'} / {customer['HSN'] || 'N/A'} / {customer['Quantity'] || 'N/A'}</span>
                <span>Order No. & Order Date :</span><span>{customer['Order No.'] || 'N/A'} & {customer['Order Date'] || 'N/A'}</span>
                <span>Cash Memo No. & Date :</span><span>{customer['Cash Memo No.'] || 'N/A'} & {customer['Cash Memo Date'] || 'N/A'}</span>
                <span>Last Delivery Date :</span><span>{customer['Last Delivery Date'] || 'N/A'}</span>
                <span>Base Price (₹) :</span><span>{parseFloat(customer['Base Price (₹)'] || 0).toFixed(2)}</span>
                <span>Dlvry Charges (₹) :</span><span>{parseFloat(customer['Delivery Charges (₹)'] || 0).toFixed(2)}</span>
                <span>C & C Rebate (₹) :</span><span>{parseFloat(customer['Cash & Carry Rebate (₹)'] || 0).toFixed(2)}</span>
                <span>CGST (2.5%) (₹) :</span><span>{parseFloat(customer['CGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
                <span>SGST (2.5%) (₹) :</span><span>{parseFloat(customer['SGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
                <span>Total Amount (₹) :</span><span>{parseFloat(customer['Total Amount (₹)'] || 0).toFixed(2)}</span>
                <span>Hose Expiry :</span><span>{customer['Hose Expiry'] || 'N/A'}</span>
                <span>Safety Chk :</span><span>{customer['Safety Check'] || 'N/A'}</span>
                <span>E-KYC :</span><span>{customer['E-KYC'] || 'N/A'}</span>
                <span>Payment :</span><span>{customer['Payment Type'] || 'N/A'}</span>
                <span>Sales Type :</span><span>{customer['Sales Type'] || 'N/A'}</span>
              </div>
            </div>

            {/* Order Details */}
            <div style={{ width: '49%', padding: '5px' }}>
              <h4 style={{ margin: '0 0 5px 0', textDecoration: 'underline', fontSize: '10px' }}>ORDER DETAILS</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '2px' }}>
                <span>Order No:</span><span>{customer['Order No.'] || 'N/A'}</span>
                <span>Order Ref No:</span><span>{customer['Order Ref No.'] || 'N/A'}</span>
                <span>Order Date:</span><span>{customer['Order Date'] || 'N/A'}</span>
                <span>Payment Type:</span><span>{customer['Payment Type'] || 'N/A'}</span>
                <span>Order Source:</span><span>{customer['Order Source'] || 'N/A'}</span>
                <span>Subsidy:</span><span>{customer['Subsidy Consumed'] || 'N/A'}</span>
                <span>Order Status:</span><span>{customer['Order Status'] || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Invoice Details and Totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid black' }}>
            {/* Invoice Details */}
            <div style={{ width: '49%', borderRight: '1px solid black', padding: '5px' }}>
              <h4 style={{ margin: '0 0 5px 0', textDecoration: 'underline', fontSize: '10px' }}>INVOICE DETAILS</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '2px' }}>
                <span>HSN :</span><span>{customer['HSN'] || 'N/A'}</span>
                <span>Cash Memo:</span><span>{customer['Cash Memo Date'] || 'N/A'}</span>
                <span>Category:</span><span>{customer['Consumer Category'] || 'N/A'}</span>
                <span>Delivery Date:</span><span>{customer['Delivery Date'] || 'N/A'}</span>
                <span>Product Name:</span><span>{customer['Product Name'] || 'N/A'}</span>
                <span>Quantity:</span><span>{customer['Quantity'] || 'N/A'}</span>
                <span>Connection:</span><span>{customer['Connection Type'] || 'N/A'}</span>
                <span>CTC Status:</span><span>{customer['CTC Status'] || 'N/A'}</span>
                <span>Refill Type:</span><span>{customer['Refill Type'] || 'N/A'}</span>
              </div>
            </div>

            {/* Totals */}
            <div style={{ width: '49%', padding: '5px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '2px' }}>
                <span>Base Rate:₹</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Base Price (₹)'] || 0).toFixed(2)}</span>
                <span>Delivery Chg:₹</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Delivery Charges (₹)'] || 0).toFixed(2)}</span>
                <span>C&C Rebate:₹</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Cash & Carry Rebate (₹)'] || 0).toFixed(2)}</span>
                <span>Taxable Amt:₹</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Taxable Amount (₹)'] || 0).toFixed(2)}</span>
                <span>CGST (2.5%):₹</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['CGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
                <span>SGST (2.5%):₹</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['SGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
                <span style={{ fontWeight: 'bold' }}>Total Amt:₹</span><span style={{ textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(customer['Total Amount (₹)'] || 0).toFixed(2)}</span>
                <span>Adv Paid (Online):₹</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Advance Paid (Online) (₹)'] || 0).toFixed(2)}</span>
                <span style={{ fontWeight: 'bold' }}>Net Payable:₹</span><span style={{ textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(customer['Net Payable (₹)'] || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
          {/* Instructions/QR Code Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '5px', fontSize: '8px' }}>
            <div style={{ lineHeight: '1.2', width: '70%' }}>
              <p style={{ margin: '0' }}>For RAJE BHAWANISHANKAR ENTERPRISES</p>
              <ul style={{ margin: '0', paddingLeft: '10px' }}>
                <li>Insist deliverymen for Pre Delivery checks of LPG Cylinder at time of delivery</li>
                <li>Get your LPG Installation inspected once in 5 years</li>
                <li>Replace Suraksha Hose every 5 years or earlier if damaged</li>
                <li>Customers are entitled for cash & carry rebate in case of non-home delivery of LPG cylinder</li>
              </ul>
            </div>
            <div style={{ textAlign: 'right', width: '30%' }}>
              <img src="/src/hppay.jpg" alt="HP Pay" style={{ width: '50px' }} />
              <p style={{ margin: '0', fontSize: '7px' }}>Scan to download</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashMemoEnglish;
