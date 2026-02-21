import React from 'react';

const CashMemoEnglish = ({ customer, dealerDetails, formatDateToDDMMYYYY }) => {
  if (!customer) {
    return <p>Please select a customer to generate Cash Memo.</p>;
  }

  const distributorName = dealerDetails?.name || 'RAJE BHAWANISHANKAR ENTERPRISES (41012240)';
  const gstn = dealerDetails?.gstn || '27AEXPB6427K1ZZ';
  const plotNo = dealerDetails?.address?.plotNo || 'PLOT NO-3, SECTOR-6, CBD BELAPUR, MAHARASHTRA-400614';
  const email = dealerDetails?.contact?.email || 'raje.thane@hpgas.hpcl.co.in';
  const telephone = dealerDetails?.contact?.telephone || '022-27571972, 27573871';

  return (
    <div className="cash-memo-wrapper">
      {/* Single Cash Memo Container */}
      <div className="cash-memo-single">

        {/* Distributor Copy Section (Left Half) */}
        <div className="distributor-copy">
          {/* Header for Distributor Copy */}
          <div className="distributor-header" style={{ display: 'flex' }}>
              <div className="distributor-header-logo" style={{ flex: 1 }}>
                <img src="/logo.jpg" alt="Distributor Header" className="distributor-header-image" style={{ width: '35%' }} />
              </div>
              <div className="distributor-header-details" style={{ flex: 1 }}>
                <p className="distributor-header-detail-text">{distributorName}</p>
                <p className="distributor-header-detail-text">GSTN : {gstn}</p>
              </div>
            </div>
          <p className="distributor-copy-title">Distributor Copy</p>

          {/* Customer Details - Simplified for Distributor Copy */}
          <div className="customer-details-distributor">
            {/* Left Column of Distributor Copy Details */}
            <div className="distributor-details-left">
              <span>Consumer No. :</span><span>{customer['Consumer No.'] || 'N/A'}</span>
              <span>Consumer Name :</span><span>{customer['Consumer Name'] || 'N/A'}</span>
              <span>Address:</span><span className="address-value">{customer['Address'] || 'N/A'}</span>
              <span>Delivery Area :</span><span>{customer['Delivery Area'] || 'N/A'}</span>
              <span>Mobile No. :</span><span>{customer['Mobile No.'] || 'N/A'}</span>
              <span>IVR Booking No. :</span><span>{customer['IVR Booking No.'] || customer['Order Ref No.'] || 'N/A'}</span>
              
                 <span>Product / HSN / Qty :</span><span>{customer['Consumer Package'] || 'N/A'} / {customer['HSN'] || 'N/A'} / {customer['Order Qty.'] || 'N/A'}</span>
               
              <span>Order Source :</span><span>{customer['Order Source'] || 'N/A'}</span>
              <span>Order Status :</span><span>{customer['Order Status'] || 'N/A'}</span>
              <span>Order No. / Order Date :</span><span>{customer['Order No.'] || 'N/A'} / {formatDateToDDMMYYYY(customer['Order Date'])}</span>
              <span>Cash Memo No / Date :</span><span>{customer['Cash Memo No.'] || 'N/A'} / {formatDateToDDMMYYYY(customer['Cash Memo Date'])}</span>
              <span>Cash Memo Status :</span><span>{customer['Cash Memo Status'] || 'N/A'}</span>
              <span>Delivery Man :</span><span>{customer['Delivery Man'] || 'N/A'}</span>
              <span>EKYC Status :</span><span>{customer['EKYC Status'] || 'N/A'}</span>
              <span>Online Refill Payment status :</span><span>{customer['Online Refill Payment status'] || 'Pay on Delivery / Cash'}</span>
            </div>

            {/* Right Column of Distributor Copy Details (Prices) */}
            <div className="distributor-details-right">
              <span>Base Price (₹) :</span><span className="price-value">{parseFloat(customer['Base Price (₹)'] || 0).toFixed(2)}</span>
              <span>Dlvry Charges(₹) :</span><span className="price-value">{parseFloat(customer['Delivery Charges (₹)'] || 0).toFixed(2)}</span>
              <span>C & C Rebate(₹) :</span><span className="price-value">{parseFloat(customer['Cash & Carry Rebate (₹)'] || 0).toFixed(2)}</span>
              <span>CGST (2.50%)(₹) :</span><span className="price-value">{parseFloat(customer['CGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
              <span>SGST (2.50%)(₹) :</span><span className="price-value">{parseFloat(customer['SGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
              <span>Total Amount(₹) :</span><span className="price-value total-amount">{parseFloat(customer['Total Amount (₹)'] || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Declaration */}
          <div className="declaration">
            <p className="declaration-text">
              Declaration : I hereby confirm receipt of filled LPG cylinder in sealed condition and above mentioned price. The cylinder was checked in my presence for correct weight & for any leakages to my satisfaction.
            </p>
            <div className="signature-section">
              <p className="signature-text">Signature of Customer</p>
            </div>
          </div>
        </div>

        {/* Tax Invoice Section (Right Half) */}
        <div className="tax-invoice">
          {/* Header Section */}
          <div className="tax-invoice-header" style={{ display: 'flex' }}>
              <div className="tax-invoice-header-logo" style={{ flex: 1 }}>
                <img src="/logo.jpg" alt="Tax Invoice Header" className="tax-invoice-header-image" style={{ width: '35%' }} />
              </div>
              <div className="tax-invoice-header-details" style={{ flex: 1 }}>
                <p className="tax-invoice-header-detail-text">{distributorName}</p>
                <p className="tax-invoice-header-detail-text">{plotNo}</p>
                <p className="tax-invoice-header-detail-text">Email : {email} | Telephone : {telephone}</p>
                <p className="tax-invoice-header-detail-text">GSTN : {gstn}</p>
              </div>
            </div>

          {/* Contact Numbers Section */}
          <div className="contact-info">
            <div>HP ANYTIME 24x7 <br /><strong className="contact-info-strong">8888823456</strong></div>
            <div>Whatsapp Booking No. <br /><strong className="contact-info-strong">9222201122</strong></div>
            <div>Missed Call Booking No. <br /><strong className="contact-info-strong">9493602222</strong></div>
            <div>Complaint No. <br /><strong className="contact-info-strong">1800 233 3555</strong></div>
        
          </div>

          {/* <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img src="/printback.jpg" alt="Watermark" style={{ opacity: '1', width: '200px', height: 'auto' }} />
          </div> */}

          <div className="header-content">
            <div className="header-content-flex-spacer"></div>
            <p className="tax-invoice-title">Tax Invoice</p>
            <div className="hp-gas-logo-section">
              <img alt="1906" src="/1906.jpg" className="image-1906" />
            </div>
          </div>

          <div className="customer-details-tax-invoice">
            {/* Left Column of Tax Invoice Details */}
            <div className="tax-invoice-details-left">
              <span>Consumer No. :</span><span>{customer['Consumer No.'] || 'N/A'}</span>
              <span>Consumer Name :</span><span>{customer['Consumer Name'] || 'N/A'}</span>
              <span>Address:</span><span className="address-value">{customer['Address'] || 'N/A'}</span>
              <span>Delivery Area :</span><span>{customer['Delivery Area'] || 'N/A'}</span>
              <span>Mobile No. :</span><span>{customer['Mobile No.'] || 'N/A'}</span>
              <span>IVR Booking No. :</span><span>{customer['IVR Booking No.'] || customer['Order Ref No.'] || 'N/A'}</span>
              <span>Product / HSN / Qty :</span><span>{customer['Consumer Package'] || 'N/A'} / {customer['HSN'] || 'N/A'} / {customer['Order Qty.'] || 'N/A'}</span>
              <span>Order Source :</span><span>{customer['Order Source'] || 'N/A'}</span>
              <span>Order Status :</span><span>{customer['Order Status'] || 'N/A'}</span>
              <span>Order No. / Order Date :</span><span>{customer['Order No.'] || 'N/A'} / {formatDateToDDMMYYYY(customer['Order Date'])}</span>
              <span>Cash Memo No / Date :</span><span>{customer['Cash Memo No.'] || 'N/A'} / {formatDateToDDMMYYYY(customer['Cash Memo Date'])}</span>
              <span>Delivery Man :</span><span>{customer['Delivery Man'] || 'N/A'}</span>
              <span>EKYC Status :</span><span>{customer['EKYC Status'] || 'N/A'}</span>
              <span>Online Refill Payment status :</span><span>{customer['Online Refill Payment status'] || 'Pay on Delivery/ Cash'}</span>
            </div>

            {/* Right Column of Tax Invoice Details (Prices) */}
            <div className="tax-invoice-details-right">
              <span>Base Price (₹) :</span><span className="price-value">{parseFloat(customer['Base Price (₹)'] || 0).toFixed(2)}</span>
              <span>Dlvry Charges(₹) :</span><span className="price-value">{parseFloat(customer['Delivery Charges (₹)'] || 0).toFixed(2)}</span>
              <span>C & C Rebate(₹) :</span><span className="price-value">{parseFloat(customer['Cash & Carry Rebate (₹)'] || 0).toFixed(2)}</span>
              <span>CGST (2.50%)(₹) :</span><span className="price-value">{parseFloat(customer['CGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
              <span>SGST (2.50%)(₹) :</span><span className="price-value">{parseFloat(customer['SGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
              <span>Total Amount(₹) :</span><span className="price-value total-amount">{parseFloat(customer['Total Amount (₹)'] || 0).toFixed(2)}</span>
            </div>
          </div>


          {/* Instructions/QR Code Section */}
          <div className="instructions-section">
            <div className="instructions-text-container">
              <p className="instructions-title">For RAJE BHAWANISHANKAR ENTERPRISES</p>
              <ul className="instructions-list">
                <li>Insist deliverymen for Pre Delivery checks of LPG Cylinder at time of delivery</li>
                <li>Get your LPG Installation inspected once in 5 years</li>
                <li>Replace Suraksha Hose every 5 years or earlier if damaged</li>
                <li>Customers are entitled for cash & carry rebate in case of non-home delivery of LPG cylinder</li>
              </ul>
            </div>
            <div className="hp-pay-image-container">
              <img src="/hppay.jpg" alt="HP Pay" className="hp-pay-image" />
               </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashMemoEnglish;
