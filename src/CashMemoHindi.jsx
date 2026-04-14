import React from 'react';
import './CashMemoPrint.css';

const valueOrBlank = (value) => (value === undefined || value === null || value === '' ? '' : String(value));

const shouldShowLabel = (settings, key) => !settings || settings[key] !== false;

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
        if (label === 'Payment' || label === 'भुगतान') classes.push('pair-table__row--payment');
        if (label === 'Mobile No.' || label === 'मोबाइल नं.') classes.push('pair-table__row--mobile');
        if (label === 'Address' || label === 'पता') classes.push('pair-table__row--address');
        if (label === 'Delivery Area' || label === 'डिलीवरी एरिया') classes.push('pair-table__row--delivery-area');
        if ((label === 'E-KYC' || label === 'ई-केवाईसी') && /not\s*done|लंबित|नहीं/i.test(String(value))) classes.push('pair-table__row--alert');

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
  labelSettings,
}) => {
  const leftRows = [
    ['मोबाइल नं.', mobileNo, 'mobileNo'],
    ['डिलीवरी एरिया', deliveryArea, 'deliveryArea'],
    ['डिलीवरी स्टाफ', deliveryMan, 'deliveryStaff'],
    ['उत्पाद / HSN / मात्रा', `${product} / ${hsn} / ${orderQty}`, 'productHsnQty'],
    ['ऑर्डर नं. और तिथि', `${orderNo} - ${orderDate}`, 'orderNoAndDate'],
    ['कैशमेमो नं. और तिथि', `${cashMemoNo} - ${cashMemoDate}`, 'cashMemoNoAndDate']
  ].filter(([, , key]) => shouldShowLabel(labelSettings, key));

  const amountRowsLeft = [
    ['मूल मूल्य (रु.)', basePrice, 'basePrice'],
    ['डिलीवरी शुल्क (रु.)', dlvryCharges, 'dlvryCharges'],
    ['कैश एंड कैरी छूट (रु.)', cAndCRebate, 'cashCarryRebate'],
    ['CGST (2.50%)(रु.)', cgst, 'cgst'],
    ['SGST (2.50%)(रु.)', sgst, 'sgst'],
    ['कुल राशि (रु.)', totalAmount, 'totalAmount'],
    ['ई-केवाईसी', eKyc, 'eKyc'],
    ['भुगतान', payment, 'payment']
  ].filter(([, , key]) => shouldShowLabel(labelSettings, key));

  return (
    <div className="distributor-details">
      {shouldShowLabel(labelSettings, 'consumerName') && <div className="details-headline details-headline--emphasis details-headline--primary">उपभोक्ता नाम : {consumerName}</div>}
      {shouldShowLabel(labelSettings, 'consumerNoLpgId') && <div className="details-headline details-headline--emphasis details-headline--primary">Consumer No / LPG ID : {consumerNo} / {lpgId}</div>}
      {shouldShowLabel(labelSettings, 'address') && <div className="details-address">पता: {address}</div>}
      <PairTable rows={leftRows} className="pair-table--dist-main" emphasisLabels={['मोबाइल नं.', 'ई-केवाईसी', 'भुगतान']} />
      <PairTable rows={amountRowsLeft} className="pair-table--dist-amounts" emphasisLabels={['कुल राशि (रु.)']} />
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
  labelSettings,
}) => {
  const middleTopRows = [
    ['उपभोक्ता नाम', consumerName, 'taxConsumerName'],
    ['Consumer No.', consumerNo, 'taxConsumerNo'],
    ['LPD ID', lpgId, 'taxLpgId'],
    ['पता', address, 'taxAddress']
  ].filter(([, , key]) => shouldShowLabel(labelSettings, key));

  const middleBottomRows = [
    ['मोबाइल नं.', mobileNo, 'mobileNo'],
    ['श्रेणी', category, 'category'],
    ['उत्पाद / HSN', `${product} / ${hsn}`, 'productHsn'],
    ['कनेक्शन / मात्रा', connectionQty, 'connectionQty'],
    ['ई-केवाईसी', eKyc, 'eKyc'],
    ['बुकिंग स्रोत', bookingSource, 'bookingSource'],
    ['भुगतान', payment, 'payment']
  ].filter(([, , key]) => shouldShowLabel(labelSettings, key));

  const normalizedPayment = String(payment || '').trim().toLowerCase();
  const isOnlinePayment = (normalizedPayment.includes('online') || normalizedPayment.includes('ऑनलाइन')) && !normalizedPayment.includes('pay on delivery');
  const displayAdvanceOnline = isOnlinePayment ? 'Paid' : '00';
  const displayNetPayable = isOnlinePayment ? '00' : totalAmount;

  const rightRows = [
    ['ऑर्डर नं.', orderNo, 'orderNo'],
    ['ऑर्डर तिथि', orderDate, 'orderDate'],
    ['कैशमेमो नं.', cashMemoNo, 'cashMemoNo'],
    ['कैशमेमो तिथि', cashMemoDate, 'cashMemoDate'],
    ['मूल मूल्य (रु.)', basePrice, 'basePrice'],
    ['डिलीवरी शुल्क (रु.)', dlvryCharges, 'deliveryCharges'],
    ['कैश एंड कैरी छूट (रु.)', cAndCRebate, 'cashCarryRebate'],
    ['कर योग्य राशि (रु.)', taxableAmount, 'taxableAmount'],
    ['CGST (2.50%)(रु.)', cgst, 'cgst'],
    ['SGST (2.50%)(रु.)', sgst, 'sgst'],
    ['कुल राशि (रु.)', totalAmount, 'totalAmount'],
    ['अग्रिम (ऑनलाइन) (रु.)', displayAdvanceOnline, 'advanceOnline'],
    ['शुद्ध देय (रु.)', displayNetPayable, 'netPayable']
  ].filter(([, , key]) => shouldShowLabel(labelSettings, key));

  return (
    <div className="tax-details">
      <div className="tax-details__columns">
        <div className="tax-details__column">
          <PairTable rows={middleTopRows} dense className="pair-table--tax-main pair-table--tax-top" emphasisLabels={['उपभोक्ता नाम', 'Consumer No.']} />
          <div className="tax-details__spacer" />
          <PairTable rows={middleBottomRows} dense className="pair-table--tax-main pair-table--tax-bottom" emphasisLabels={['मोबाइल नं.', 'ई-केवाईसी']} />
        </div>
        <div className="tax-details__column tax-details__column--right">
          <PairTable rows={rightRows} amountAlign dense className="pair-table--tax-amounts" emphasisLabels={['भुगतान', 'कुल राशि (रु.)']} />
        </div>
      </div>
    </div>
  );
};

const CashMemoHindi = ({ customer, dealerDetails, formatDateToDDMMYYYY, pageType, labelSettings }) => {
  if (!customer) {
    return <p>Please select a customer to generate Cash Memo.</p>;
  }

  const consumerName = customer['Consumer Name Hindi'] || customer['Consumer Name'] || '';
  const consumerNo = customer['Consumer No.'] || '';
  const lpgId = customer['LPG ID'] || customer.UniqueConsumerId || customer['Unique Consumer Id'] || customer['Unique Consumer ID'] || '';
  const address = customer['Address Hindi'] || customer['Address'] || '';
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
  let eKyc = customer['EKYC Status'] || 'Not Done';
  if (/ekyc\s*done/i.test(eKyc) || /done/i.test(eKyc)) eKyc = 'पूर्ण (Done)';
  else if (/not\s*done/i.test(eKyc)) eKyc = 'लंबित (Not Done)';
  else if (/pending/i.test(eKyc)) eKyc = 'लंबित (Pending)';

  const onlineRefillPaymentStatus = customer['Online Refill Payment status'] || '';
  const rawPaymentMethod = customer['Payment Method'] || '';
  let payment = /paid/i.test(String(onlineRefillPaymentStatus))
    ? 'ऑनलाइन (Online)'
    : (rawPaymentMethod || 'कैश ऑन डिलीवरी (COD)');

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
        <div className="distributor-copy-title">वितरक प्रति</div>
        <div className="memo-table-wrap">
          <div className="memo-table-box memo-table-box--distributor">
            <DistributorDetails {...commonProps} labelSettings={labelSettings} />
          </div>
        </div>
        <div className="declaration">
          <p className="declaration-text">
            घोषणा : मैं भरे हुए एलपीजी सिलेंडर को सीलबंद स्थिति में प्राप्त करने तथा ऊपर लिखी गई राशि की पुष्टि करता/करती हूं। सिलेंडर का वजन तथा रिसाव मेरे सामने जांचा गया।
          </p>
          <div className="signature-section">
            <span>उपभोक्ता के हस्ताक्षर</span>
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
            <p className="tax-invoice-header-detail-text">ईमेल : {dealerEmail} </p>
            <p className="tax-invoice-header-detail-text">जीएसटीएन : {dealerGstn} | फोन : {dealerTelephone}</p>
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
          <p className="tax-invoice-title">कर चालान</p>
          <div className="header-content-flex-spacer">
            <img alt="1906" src="/1906.jpg" className="image-1906" />
          </div>
        </div>

        <div className="memo-table-wrap memo-table-wrap--tax">
          <div className="memo-table-box memo-table-box--tax">
            <TaxInvoiceDetails {...commonProps} labelSettings={labelSettings} />
          </div>
        </div>
        <p className="signature-text">{dealerName}.....</p>

        <div className="instructions-section">
          <div className="instructions-text-container">
            <ul className="instructions-list">
              <li>डिलीवरी के समय एलपीजी सिलेंडर की प्री-डिलीवरी जांच अवश्य कराएं।</li>
              <li>हर 5 वर्ष में एक बार एलपीजी इंस्टॉलेशन की जांच कराएं।</li>
              <li>सुरक्षा होज को 5 वर्ष बाद या खराब होने पर बदलें।</li>
              <li>होम डिलीवरी न लेने पर ग्राहक कैश एंड कैरी रिबेट के हकदार हैं।</li>
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

export default CashMemoHindi;
