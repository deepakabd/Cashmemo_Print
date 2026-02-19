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
      <div className="cash-memo-single" style={{ display: 'flex', fontFamily: 'Arial, sans-serif', width: '100%', boxSizing: 'border-box', height: '100%', backgroundColor: 'white' }}>

        {/* Distributor Copy Section (Left Half) */}
        <div className="distributor-copy" style={{ width: '50%', borderRight: '1px dashed black', padding: '5px', boxSizing: 'border-box', fontSize: '10px', height: '100%', color: 'black' }}>
          {/* Header for Distributor Copy */}
          <div style={{ position: 'relative', width: '100%' }}>
              <img src="/tax.jpg" alt="Distributor Header" style={{ width: '100%' }} />
              <div style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', textAlign: 'right', color: 'black', fontSize: '8px', fontWeight: 'bold' }}>
                <p style={{ margin: '0' }}>{distributorName}</p>
                <p style={{ margin: '0' }}>GSTN : {gstn}</p>
              </div>
            </div>
          <p style={{ margin: ' 5px 0 5px 0', fontWeight: 'bold', fontSize: '12px', color: 'black' }}>Distributor Copy</p>

          {/* Customer Details - Simplified for Distributor Copy */}
          <div style={{ border: '1px solid black', padding: '5px', marginBottom: '5px', display: 'flex', fontSize: '8px' }}>
            {/* Left Column of Distributor Copy Details */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1px', paddingRight: '5px', borderRight: '1px dashed #ccc' }}>
              <span>Consumer No. :</span><span>{customer['Consumer No.'] || 'N/A'}</span>
              <span>Consumer Name :</span><span>{customer['Consumer Name'] || 'N/A'}</span>
              <span>Address:</span><span>{customer['Address'] || 'N/A'}</span>
              <span>Delivery Area :</span><span>{customer['Delivery Area'] || 'N/A'}</span>
              <span>Mobile No. :</span><span>{customer['Mobile No.'] || 'N/A'}</span>
              <span>IVR Booking No. :</span><span>{customer['IVR Booking No.'] || customer['Order Ref No.'] || 'N/A'}</span>
              <span>Product / HSN / Qty :</span><span>{customer['Product Name'] || 'N/A'} / {customer['HSN'] || 'N/A'} / {customer['Quantity'] || 'N/A'}</span>
              <span>Order Source :</span><span>{customer['Order Source'] || 'N/A'}</span>
              <span>Order Status :</span><span>{customer['Order Status'] || 'N/A'}</span>
              <span>Order No. / Order Date :</span><span>{customer['Order No.'] || 'N/A'} / {customer['Order Date'] || 'N/A'}</span>
              <span>Cash Memo No / Date :</span><span>{customer['Cash Memo No.'] || 'N/A'} / {customer['Cash Memo Date'] || 'N/A'}</span>
              <span>Cash Memo Status :</span><span>{customer['Cash Memo Status'] || 'N/A'}</span>
              <span>Delivery Man :</span><span>{customer['Delivery Staff'] || 'N/A'}</span>
              <span>EKYC Status :</span><span>{customer['E-KYC'] || 'N/A'}</span>
              <span>Online Refill Payment status :</span><span>{customer['Payment Type'] || 'N/A'}</span>
            </div>

            {/* Right Column of Distributor Copy Details (Prices) */}
            <div style={{ width: '150px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1px', paddingLeft: '5px' }}>
              <span>Base Price (₹) :</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Base Price (₹)'] || 0).toFixed(2)}</span>
              <span>Dlvry Charges(₹) :</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Delivery Charges (₹)'] || 0).toFixed(2)}</span>
              <span>C & C Rebate(₹) :</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Cash & Carry Rebate (₹)'] || 0).toFixed(2)}</span>
              <span>CGST (2.50%)(₹) :</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['CGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
              <span>SGST (2.50%)(₹) :</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['SGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
              <span>Total Amount(₹) :</span><span style={{ textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(customer['Total Amount (₹)'] || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Declaration */}
          <div style={{ border: '1px solid black', padding: '30px', marginBottom: '5px', fontSize: '7px', color: 'red' }}>
            <p style={{ margin: '0' }}>
              Declaration : I hereby confirm receipt of filled LPG cylinder in sealed condition and above mentioned price. The cylinder was checked in my presence for correct weight & for any leakages to my satisfaction.
            </p>
            <div style={{ marginTop: '10px', borderTop: '1px solid black', width: '150px', marginLeft: 'auto' }}>
              <p style={{ margin: '0', fontSize: '8px', textAlign: 'right' }}>Signature of Customer</p>
            </div>
          </div>
        </div>

        {/* Tax Invoice Section (Right Half) */}
        <div className="tax-invoice" style={{ width: '50%', padding: '5px', boxSizing: 'border-box', fontSize: '10px', height: '100%', color: 'black' }}>
          {/* Header Section */}
          <div style={{ position: 'relative', width: '100%' }}>
              <img src="/tax.jpg" alt="Tax Invoice Header" style={{ width: '100%' }} />
              <div style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', textAlign: 'right', color: 'black', fontSize: '8px', fontWeight: 'bold' }}>
                <p style={{ margin: '0' }}>{distributorName}</p>
                <p style={{ margin: '0' }}>{plotNo}</p>
                <p style={{ margin: '0' }}>Email : {email} | Telephone : {telephone}</p>
                <p style={{ margin: '0' }}>GSTN : {gstn}</p>
              </div>
            </div>

          {/* Contact Numbers Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 'px', alignItems: 'center', padding: 'px 0', fontSize: '7px', borderBottom: '1px solid black', marginBottom: '5px', backgroundColor: 'rgb(0, 0, 128)', color: 'white' }}>
            <div>HP ANYTIME 24x7 <br /><strong style={{ color: 'white', fontSize: '9px' }}>8888823456</strong></div>
            <div>Whatsapp Booking No. <br /><strong style={{ color: 'white', fontSize: '9px' }}>9222201122</strong></div>
            <div>Missed Call Booking No. <br /><strong style={{ color: 'white', fontSize: '9px' }}>9493602222</strong></div>
            <div>Complaint No. <br /><strong style={{ color: 'white', fontSize: '9px' }}>1800 233 3555</strong></div>
            {/* <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '7px' }}>LPG Emergency</span><br />
              <span style={{ fontSize: '7px' }}>Helpline 24x7</span>
            </div> */}
          </div>

          {/* <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img src="/printback.jpg" alt="Watermark" style={{ opacity: '0.1', width: '200px', height: 'auto' }} />
          </div> */}

          <div style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
            <div style={{ flex: 1 }}></div>
            <p style={{ margin: '0', fontSize: '12px', fontWeight: 'bold' }}>Tax Invoice</p>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <img alt="1906" src="/1906.jpg" style={{ height: '15px', verticalAlign: 'middle' }} />
            </div>
          </div>

          <div style={{ border: '1px solid black', padding: '5px', marginBottom: '5px', display: 'flex', fontSize: '8px' }}>
            {/* Left Column of Tax Invoice Details */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1px', paddingRight: '5px', borderRight: '1px dashed #ccc' }}>
              <span>Consumer No. :</span><span>{customer['Consumer No.'] || 'N/A'}</span>
              <span>Consumer Name :</span><span>{customer['Consumer Name'] || 'N/A'}</span>
              <span>Address:</span><span>{customer['Address'] || 'N/A'}</span>
              <span>Delivery Area :</span><span>{customer['Delivery Area'] || 'N/A'}</span>
              <span>Mobile No. :</span><span>{customer['Mobile No.'] || 'N/A'}</span>
              <span>IVR Booking No. :</span><span>{customer['IVR Booking No.'] || customer['Order Ref No.'] || 'N/A'}</span>
              <span>Product / HSN / Qty :</span><span>{customer['Product Name'] || 'N/A'} / {customer['HSN'] || 'N/A'} / {customer['Quantity'] || 'N/A'}</span>
              <span>Order Source :</span><span>{customer['Order Source'] || 'N/A'}</span>
              <span>Order Status :</span><span>{customer['Order Status'] || 'N/A'}</span>
              <span>Order No. / Order Date :</span><span>{customer['Order No.'] || 'N/A'} / {customer['Order Date'] || 'N/A'}</span>
              <span>Cash Memo No / Date :</span><span>{customer['Cash Memo No.'] || 'N/A'} / {customer['Cash Memo Date'] || 'N/A'}</span>
              <span>Delivery Man :</span><span>{customer['Delivery Staff'] || 'N/A'}</span>
              <span>EKYC Status :</span><span>{customer['E-KYC'] || 'N/A'}</span>
              <span>Online Refill Payment status :</span><span>{customer['Payment Type'] || 'N/A'}</span>
            </div>

            {/* Right Column of Tax Invoice Details (Prices) */}
            <div style={{ width: '150px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1px', paddingLeft: '5px' }}>
              <span>Base Price (₹) :</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Base Price (₹)'] || 0).toFixed(2)}</span>
              <span>Dlvry Charges(₹) :</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Delivery Charges (₹)'] || 0).toFixed(2)}</span>
              <span>C & C Rebate(₹) :</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['Cash & Carry Rebate (₹)'] || 0).toFixed(2)}</span>
              <span>CGST (2.50%)(₹) :</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['CGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
              <span>SGST (2.50%)(₹) :</span><span style={{ textAlign: 'right' }}>{parseFloat(customer['SGST (2.50%) (₹)'] || 0).toFixed(2)}</span>
              <span>Total Amount(₹) :</span><span style={{ textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(customer['Total Amount (₹)'] || 0).toFixed(2)}</span>
            </div>
          </div>


          {/* Instructions/QR Code Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '5px', fontSize: '7px' }}>
            <div style={{ lineHeight: '1.2', width: '70%' }}>
              <p style={{ margin: '0', fontWeight: 'bold' }}>For RAJE BHAWANISHANKAR ENTERPRISES</p>
              <ul style={{ margin: '0', paddingLeft: '10px' }}>
                <li>Insist deliverymen for Pre Delivery checks of LPG Cylinder at time of delivery</li>
                <li>Get your LPG Installation inspected once in 5 years</li>
                <li>Replace Suraksha Hose every 5 years or earlier if damaged</li>
                <li>Customers are entitled for cash & carry rebate in case of non-home delivery of LPG cylinder</li>
              </ul>
            </div>
            <div style={{ textAlign: 'center', width: '30%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src="/hppay.jpg" alt="HP Pay" style={{ width: '70px', marginBottom: '5px' }} />
               </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashMemoEnglish;
