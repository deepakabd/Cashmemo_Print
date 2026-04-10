import React from 'react';
import './CashMemoPrint.css';

const valueOrBlank = (value) => (value === undefined || value === null || value === '' ? '' : String(value));

const pickMoney = (customer, keys) => {
  for (const key of keys) {
    if (customer[key] !== undefined && customer[key] !== null && customer[key] !== '') {
      const parsed = Number.parseFloat(customer[key]);
      return Number.isFinite(parsed) ? parsed.toFixed(2) : String(customer[key]);
    }
  }
  return '0.00';
};

const PairTable = ({ rows, amountAlign = false, dense = false, className = '', emphasisLabels = [] }) => (
  <table className={`pair-table${dense ? ' pair-table--dense' : ''}${amountAlign ? ' pair-table--amount' : ''}${className ? ` ${className}` : ''}`}>
    <tbody>
      {rows.map(([label, value]) => {
        const classes = [];
        if (emphasisLabels.includes(label)) classes.push('pair-table__row--emphasis');
        if (label === 'Payment') classes.push('pair-table__row--payment');
        if (label === 'Mobile No.') classes.push('pair-table__row--mobile');
        if (label === 'Address') classes.push('pair-table__row--address');
        if (label === 'Delivery Area') classes.push('pair-table__row--delivery-area');
        if (label === 'E-KYC' && /ekyc\s*not\s*done/i.test(String(value))) classes.push('pair-table__row--alert');

        return (
        <tr key={label} className={classes.join(' ')}>
          <td className="pair-table__label">{label}</td>
          <td className="pair-table__sep">:</td>
          <td className="pair-table__value">{valueOrBlank(value)}</td>
        </tr>
        );
      })}
    </tbody>
  </table>
);

const DistributorDetails = ({
  consumerName,
  consumerNo,
  lpgId,
  address,
  mobileNo,
  deliveryArea,
  deliveryMan,
  product,
  hsn,
  orderQty,
  orderNo,
  orderDate,
  cashMemoNo,
  cashMemoDate,
  lastDeliveryDate,
  basePrice,
  dlvryCharges,
  cAndCRebate,
  cgst,
  sgst,
  totalAmount,
  hoseExpiry,
  miStatus,
  eKyc,
  payment,
  salesType,
  hideCompactRows = false
}) => {
  const hiddenMainLabels = new Set(['Delivery Staff', 'Product / HSN / Qty']);
  const hiddenAmountLabels = new Set(['Dlvry Charges (Rs.)', 'C & C Rebate (Rs.)']);
  const leftRows = [
    ['Mobile No.', mobileNo],
    ['Delivery Area', deliveryArea],
    ['Delivery Staff', deliveryMan],
    ['Product / HSN / Qty', `${product} / ${hsn} / ${orderQty}`],
    ['Order No. & Order Date', `${orderNo} - ${orderDate}`],
    ['Cash Memo No. & Date', `${cashMemoNo} - ${cashMemoDate}`]
  ].filter(([label]) => !hideCompactRows || !hiddenMainLabels.has(label));

  const amountRowsLeft = [
    ['Base Price (Rs.)', basePrice],
    ['Dlvry Charges (Rs.)', dlvryCharges],
    ['C & C Rebate (Rs.)', cAndCRebate],
    ['CGST (2.50%)(Rs.)', cgst],
    ['SGST (2.50%)(Rs.)', sgst],
    ['Total Amount(Rs.)', totalAmount],
    ['E-KYC', eKyc],
    ['Payment', payment]
  ].filter(([label]) => !hideCompactRows || !hiddenAmountLabels.has(label));

  return (
    <div className="distributor-details">
      <div className="details-headline details-headline--emphasis details-headline--primary">Consumer Name : {consumerName}</div>
      <div className="details-headline details-headline--emphasis details-headline--primary">Consumer No / LPG ID : {consumerNo} / {lpgId}</div>
      <div className="details-address">Address: {address}</div>
      <PairTable rows={leftRows} className="pair-table--dist-main" emphasisLabels={['Mobile No.', 'E-KYC', 'Payment']} />
      <PairTable rows={amountRowsLeft} className="pair-table--dist-amounts" emphasisLabels={['Total Amount(Rs.)']} />
    </div>
  );
};

const TaxInvoiceDetails = ({
  consumerName,
  consumerNo,
  lpgId,
  address,
  mobileNo,
  category,
  product,
  hsn,
  connectionQty,
  ctcStatus,
  subsidyConsumed,
  hoseExpiry,
  miStatus,
  eKyc,
  bookingSource,
  payment,
  orderNo,
  orderDate,
  cashMemoNo,
  cashMemoDate,
  basePrice,
  dlvryCharges,
  cAndCRebate,
  taxableAmount,
  cgst,
  sgst,
  totalAmount,
  advanceOnline,
  netPayable,
  hideCompactRows = false
}) => {
  const middleTopRows = [
    ['Consumer Name', consumerName],
    ['Consumer No.', consumerNo],
    ['LPD ID', lpgId],
    ['Address', address]
  ];

  const hiddenMiddleLabels = new Set(['Category', 'Product/ HSN', 'Connection/ Qty']);
  const hiddenRightLabels = new Set(['Delivery Charges (Rs.)', 'C & C Rebate (Rs.)', 'Taxable Amount (Rs.)']);

  const middleBottomRows = [
    ['Mobile No.', mobileNo],
    ['Category', category],
    ['Product/ HSN', `${product} / ${hsn}`],
    ['Connection/ Qty', connectionQty],
    ['E-KYC', eKyc],
    ['Booking Source', bookingSource],
    ['Payment', payment]
  ].filter(([label]) => !hideCompactRows || !hiddenMiddleLabels.has(label));

  const rightRows = [
    ['Order No.', orderNo],
    ['Order Date', orderDate],
    ['CashMemo No.', cashMemoNo],
    ['CashMemo Date', cashMemoDate],
    ['Base Price (Rs.)', basePrice],
    ['Delivery Charges (Rs.)', dlvryCharges],
    ['C & C Rebate (Rs.)', cAndCRebate],
    ['Taxable Amount (Rs.)', taxableAmount],
    ['CGST (2.50%)(Rs.)', cgst],
    ['SGST (2.50%)(Rs.)', sgst],
    ['Total Amount (Rs.)', totalAmount],
    ['Advance (Online) (Rs.)', advanceOnline],
    ['Net Payable (Rs.)', netPayable]
  ].filter(([label]) => !hideCompactRows || !hiddenRightLabels.has(label));

  const normalizedPayment = String(payment || '').trim().toLowerCase();
  const isOnlinePayment = normalizedPayment.includes('online') && !normalizedPayment.includes('pay on delivery');
  const displayAdvanceOnline = isOnlinePayment ? 'Paid' : '00';
  const displayNetPayable = isOnlinePayment ? '00' : totalAmount;

  rightRows[rightRows.findIndex(([label]) => label === 'Advance (Online) (Rs.)')] = ['Advance (Online) (Rs.)', displayAdvanceOnline];
  rightRows[rightRows.findIndex(([label]) => label === 'Net Payable (Rs.)')] = ['Net Payable (Rs.)', displayNetPayable];

  return (
    <div className="tax-details">
      <div className="tax-details__columns">
        <div className="tax-details__column">
          <PairTable rows={middleTopRows} dense className="pair-table--tax-main pair-table--tax-top" emphasisLabels={['Consumer Name', 'Consumer No.', 'LPD ID']} />
          <div className="tax-details__spacer" />
          <PairTable rows={middleBottomRows} dense className="pair-table--tax-main pair-table--tax-bottom" emphasisLabels={['Mobile No.', 'E-KYC']} />
        </div>
        <div className="tax-details__column tax-details__column--right">
          <PairTable rows={rightRows} amountAlign dense className="pair-table--tax-amounts" emphasisLabels={['Payment', 'Total Amount (Rs.)']} />
        </div>
      </div>
    </div>
  );
};

const CashMemoEnglish = ({ customer, dealerDetails, formatDateToDDMMYYYY, pageType }) => {
  if (!customer) {
    return <p>Please select a customer to generate Cash Memo.</p>;
  }

  const consumerName = customer['Consumer Name'] || '';
  const consumerNo = customer['Consumer No.'] || '';
  const lpgId = customer['LPG ID'] || customer.UniqueConsumerId || customer['Unique Consumer Id'] || customer['Unique Consumer ID'] || '';
  const address = customer['Address'] || '';
  const mobileNo = customer['Mobile No.'] || '';
  const deliveryArea = customer['Delivery Area'] || '';
  const deliveryMan = customer['Delivery Man'] || '';
  const product = customer['Product'] || '';
  const hsn = customer['HSN'] || '';
  const orderQty = customer['Order Qty.'] || '';
  const orderNo = customer['Order No.'] || '';
  const orderDate = customer['Order Date'] ? formatDateToDDMMYYYY(new Date(customer['Order Date'])) : '';
  const cashMemoNo = customer['Cash Memo No.'] || '';
  const cashMemoDate = customer['Cash Memo Date'] ? formatDateToDDMMYYYY(new Date(customer['Cash Memo Date'])) : '';
  const lastDeliveryDate = customer['Last Delivery Date'] ? formatDateToDDMMYYYY(new Date(customer['Last Delivery Date'])) : '';

  const basePrice = pickMoney(customer, ['Base Price (₹)', 'Base Price (Ã¢â€šÂ¹)', 'Base Price (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)']);
  const dlvryCharges = pickMoney(customer, ['Delivery Charges (₹)', 'Delivery Charges (Ã¢â€šÂ¹)', 'Delivery Charges (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)']);
  const cAndCRebate = pickMoney(customer, ['Cash & Carry Rebate (₹)', 'Cash & Carry Rebate (Ã¢â€šÂ¹)', 'Cash & Carry Rebate (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)']);
  const cgst = pickMoney(customer, ['CGST (2.50%) (₹)', 'CGST (2.50%) (Ã¢â€šÂ¹)', 'CGST (2.50%) (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)']);
  const sgst = pickMoney(customer, ['SGST (2.50%) (₹)', 'SGST (2.50%) (Ã¢â€šÂ¹)', 'SGST (2.50%) (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)']);
  const totalAmount = pickMoney(customer, ['Total Amount (₹)', 'Total Amount (Ã¢â€šÂ¹)', 'Total Amount (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)']);
  const taxableAmount = pickMoney(customer, ['Taxable Amount (₹)', 'Taxable Amount (Ã¢â€šÂ¹)', 'Taxable Amount (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)']);
  const advanceOnline = pickMoney(customer, ['Advance (Online) (₹)', 'Advance (Online) (Ã¢â€šÂ¹)', 'Advance (Online) (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)']);
  const netPayable = pickMoney(customer, ['Net Payable (₹)', 'Net Payable (Ã¢â€šÂ¹)', 'Net Payable (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)']);

  const category = customer['Consumer Package'] || '';
  const connectionQty = customer['Connection/Qty'] || 'SBC / 1';
  const eKyc = customer['EKYC Status'] || 'Not Done';
  const onlineRefillPaymentStatus = customer['Online Refill Payment status'] || '';
  const rawPaymentMethod = customer['Payment Method'] || '';
  const payment = /paid/i.test(String(onlineRefillPaymentStatus))
    ? 'Online'
    : (rawPaymentMethod || 'Pay On Delivery');
  const bookingSource = customer['Order Source'] || 'HP Pay';
  const hoseExpiry = customer['Hose Expiry'] || '';
  const miStatus = customer.MI || customer['MI Status'] || '';
  const salesType = customer['Sales Type'] || '';
  const ctcStatus = customer['CTC Status'] || '';
  const subsidyConsumed = customer['Subsidy Consumed'] || '';

  const dealerName = dealerDetails?.name || '';
  const dealerPlotNo = dealerDetails?.address?.plotNo || '';
  const dealerEmail = dealerDetails?.contact?.email || '';
  const dealerTelephone = dealerDetails?.contact?.telephone || '';
  const dealerGstn = dealerDetails?.gstn || '';

  const commonProps = {
    consumerName,
    consumerNo,
    lpgId,
    address,
    mobileNo,
    deliveryArea,
    deliveryMan,
    product,
    hsn,
    orderQty,
    orderNo,
    orderDate,
    cashMemoNo,
    cashMemoDate,
    lastDeliveryDate,
    basePrice,
    dlvryCharges,
    cAndCRebate,
    cgst,
    sgst,
    totalAmount,
    category,
    connectionQty,
    eKyc,
    payment,
    bookingSource,
    taxableAmount,
    advanceOnline,
    netPayable,
    hoseExpiry,
    miStatus,
    salesType,
    ctcStatus,
    subsidyConsumed
  };

  const isCompactPage = pageType === '4 Cashmemo/Page';

  return (
    <div className={`cash-memo-single${isCompactPage ? ' cash-memo-single--compact' : ''}`}>
      <div className="distributor-copy">
        <div className="distributor-header">
          <div className="distributor-header-logo">
            <img src="/logo.jpg" alt="HP GAS Logo" className="distributor-header-image" />
          </div>
          <div className="distributor-header-details">
            <p className="distributor-header-detail-text">{dealerName}</p>
            <p className="distributor-header-detail-text">{dealerPlotNo}</p>
            <p className="distributor-header-detail-text">GSTN : {dealerGstn}</p>
          </div>
        </div>
        <div className="distributor-copy-title">Distributor Copy</div>
        <div className="memo-table-wrap">
          <div className="memo-table-box memo-table-box--distributor">
            <DistributorDetails {...commonProps} hideCompactRows={isCompactPage} />
          </div>
        </div>
        <div className="declaration">
          <p className="declaration-text">
            Declaration : I hereby confirm receipt of filled LPG cylinder in sealed condition and above mentioned price.
            The cylinder was checked in my presence for correct weight & for any leakages to my satisfaction.
          </p>
          <div className="signature-section">
            <span>Signature of Customer</span>
          </div>
        </div>
      </div>

      <div className="tax-invoice">
        <div className="tax-invoice-header">
          <div className="tax-invoice-header-logo">
            <img src="/logo.jpg" alt="HP GAS Logo" className="tax-invoice-header-image" />
          </div>
          <div className="tax-invoice-header-details">
            <p className="tax-invoice-header-detail-text">{dealerName}</p>
            <p className="tax-invoice-header-detail-text">{dealerPlotNo}</p>
            <p className="tax-invoice-header-detail-text">Email : {dealerEmail} | Telephone : {dealerTelephone}</p>
            <p className="tax-invoice-header-detail-text">GSTN : {dealerGstn}</p>
          </div>
        </div>

        <div className="contact-info">
          <div>
            HP ANYTIME 24x7 <br />
            <strong className="contact-info-strong">8888823456</strong>
          </div>
          <div>
            Whatsapp Booking No. <br />
            <strong className="contact-info-strong">9222201122</strong>
          </div>
          <div>
            Missed Call Booking No. <br />
            <strong className="contact-info-strong">9493602222</strong>
          </div>
          <div>
            Complaint No. <br />
            <strong className="contact-info-strong">1800 233 3555</strong>
          </div>
        </div>

        <div className="header-content">
          <div className="header-content-flex-spacer"></div>
          <p className="tax-invoice-title">Tax Invoice</p>
          <div className="header-content-flex-spacer">
            <img alt="1906" src="/1906.jpg" className="image-1906" />
          </div>
        </div>

        <div className="memo-table-wrap memo-table-wrap--tax">
          <div className="memo-table-box memo-table-box--tax">
            <TaxInvoiceDetails {...commonProps} hideCompactRows={isCompactPage} />
          </div>
        </div>
        <p className="signature-text">For {dealerName}...........</p>

        <div className="instructions-section">
          <div className="instructions-text-container">
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
  );
};

export default CashMemoEnglish;
