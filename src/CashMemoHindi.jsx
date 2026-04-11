import React from 'react';
import './CashMemoPrint.css';
import { HINDI_LABELS, getHindiValue } from './hindiPrint';

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
  basePrice,
  dlvryCharges,
  cAndCRebate,
  cgst,
  sgst,
  totalAmount,
  eKyc,
  payment,
  labelSettings,
}) => {
  const leftRows = [
    [HINDI_LABELS.mobileNo, mobileNo, 'mobileNo'],
    [HINDI_LABELS.deliveryArea, deliveryArea, 'deliveryArea'],
    ['डिलीवरी कर्मी', deliveryMan, 'deliveryStaff'],
    [HINDI_LABELS.productHsnQty, `${product} / ${hsn} / ${orderQty}`, 'productHsnQty'],
    [HINDI_LABELS.orderNoAndDate, `${orderNo} - ${orderDate}`, 'orderNoAndDate'],
    [HINDI_LABELS.cashMemoNoAndDate, `${cashMemoNo} - ${cashMemoDate}`, 'cashMemoNoAndDate'],
  ].filter(([, , key]) => shouldShowLabel(labelSettings, key));

  const amountRowsLeft = [
    [HINDI_LABELS.basePrice, basePrice, 'basePrice'],
    [HINDI_LABELS.deliveryCharges, dlvryCharges, 'dlvryCharges'],
    [HINDI_LABELS.cashCarryRebate, cAndCRebate, 'cashCarryRebate'],
    [HINDI_LABELS.cgst, cgst, 'cgst'],
    [HINDI_LABELS.sgst, sgst, 'sgst'],
    [HINDI_LABELS.totalAmount, totalAmount, 'totalAmount'],
    [HINDI_LABELS.eKyc, eKyc, 'eKyc'],
    [HINDI_LABELS.payment, payment, 'payment'],
  ].filter(([, , key]) => shouldShowLabel(labelSettings, key));

  return (
    <div className="distributor-details">
      {shouldShowLabel(labelSettings, 'consumerName') && <div className="details-headline details-headline--emphasis details-headline--primary">{HINDI_LABELS.consumerName} : {consumerName}</div>}
      {shouldShowLabel(labelSettings, 'consumerNoLpgId') && <div className="details-headline details-headline--emphasis details-headline--primary">{HINDI_LABELS.consumerNo} / {HINDI_LABELS.lpgId} : {consumerNo} / {lpgId}</div>}
      {shouldShowLabel(labelSettings, 'address') && <div className="details-address">{HINDI_LABELS.address}: {address}</div>}
      <PairTable rows={leftRows} className="pair-table--dist-main" emphasisLabels={[HINDI_LABELS.mobileNo, HINDI_LABELS.eKyc, HINDI_LABELS.payment]} />
      <PairTable rows={amountRowsLeft} className="pair-table--dist-amounts" emphasisLabels={[HINDI_LABELS.totalAmount]} />
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
  netPayable,
  labelSettings,
}) => {
  const middleTopRows = [
    [HINDI_LABELS.consumerName, consumerName, 'taxConsumerName'],
    [HINDI_LABELS.consumerNo, consumerNo, 'taxConsumerNo'],
    [HINDI_LABELS.lpgId, lpgId, 'taxLpgId'],
    [HINDI_LABELS.address, address, 'taxAddress'],
  ].filter(([, , key]) => shouldShowLabel(labelSettings, key));

  const middleBottomRows = [
    [HINDI_LABELS.mobileNo, mobileNo, 'mobileNo'],
    [HINDI_LABELS.category, category, 'category'],
    [HINDI_LABELS.productHsn, `${product} / ${hsn}`, 'productHsn'],
    [HINDI_LABELS.connectionQty, connectionQty, 'connectionQty'],
    [HINDI_LABELS.eKyc, eKyc, 'eKyc'],
    [HINDI_LABELS.bookingSource, bookingSource, 'bookingSource'],
    [HINDI_LABELS.payment, payment, 'payment'],
  ].filter(([, , key]) => shouldShowLabel(labelSettings, key));

  const normalizedPayment = String(payment || '').trim().toLowerCase();
  const isOnlinePayment = normalizedPayment.includes('ऑनलाइन') && !normalizedPayment.includes('डिलीवरी');
  const displayAdvanceOnline = isOnlinePayment ? 'भुगतान किया गया' : '00';
  const displayNetPayable = isOnlinePayment ? '00' : netPayable || totalAmount;

  const rightRows = [
    [HINDI_LABELS.orderNo, orderNo, 'orderNo'],
    [HINDI_LABELS.orderDate, orderDate, 'orderDate'],
    [HINDI_LABELS.cashMemoNo, cashMemoNo, 'cashMemoNo'],
    [HINDI_LABELS.cashMemoDate, cashMemoDate, 'cashMemoDate'],
    [HINDI_LABELS.basePrice, basePrice, 'basePrice'],
    [HINDI_LABELS.deliveryCharges, dlvryCharges, 'deliveryCharges'],
    [HINDI_LABELS.cashCarryRebate, cAndCRebate, 'cashCarryRebate'],
    [HINDI_LABELS.taxableAmount, taxableAmount, 'taxableAmount'],
    [HINDI_LABELS.cgst, cgst, 'cgst'],
    [HINDI_LABELS.sgst, sgst, 'sgst'],
    [HINDI_LABELS.totalAmount, totalAmount, 'totalAmount'],
    [HINDI_LABELS.advanceOnline, displayAdvanceOnline, 'advanceOnline'],
    [HINDI_LABELS.netPayable, displayNetPayable, 'netPayable'],
  ].filter(([, , key]) => shouldShowLabel(labelSettings, key));

  return (
    <div className="tax-details">
      <div className="tax-details__columns">
        <div className="tax-details__column">
          <PairTable rows={middleTopRows} dense className="pair-table--tax-main pair-table--tax-top" emphasisLabels={[HINDI_LABELS.consumerName, HINDI_LABELS.consumerNo, HINDI_LABELS.lpgId]} />
          <div className="tax-details__spacer" />
          <PairTable rows={middleBottomRows} dense className="pair-table--tax-main pair-table--tax-bottom" emphasisLabels={[HINDI_LABELS.mobileNo, HINDI_LABELS.eKyc]} />
        </div>
        <div className="tax-details__column tax-details__column--right">
          <PairTable rows={rightRows} amountAlign dense className="pair-table--tax-amounts" emphasisLabels={[HINDI_LABELS.payment, HINDI_LABELS.totalAmount]} />
        </div>
      </div>
    </div>
  );
};

const CashMemoHindi = ({ customer, dealerDetails, formatDateToDDMMYYYY, pageType, labelSettings }) => {
  if (!customer) {
    return <p>कृपया कैश मेमो बनाने के लिए उपभोक्ता चुनें।</p>;
  }

  const consumerName = getHindiValue('Consumer Name', customer['Consumer Name'] || '');
  const consumerNo = customer['Consumer No.'] || '';
  const lpgId = customer['LPG ID'] || customer.UniqueConsumerId || customer['Unique Consumer Id'] || customer['Unique Consumer ID'] || '';
  const address = getHindiValue('Address', customer['Address'] || '');
  const mobileNo = customer['Mobile No.'] || '';
  const deliveryArea = getHindiValue('Delivery Area', customer['Delivery Area'] || '');
  const deliveryMan = getHindiValue('Delivery Man', customer['Delivery Man'] || '');
  const product = getHindiValue('Product', customer['Product'] || '');
  const hsn = customer['HSN'] || '';
  const orderQty = customer['Order Qty.'] || '';
  const orderNo = customer['Order No.'] || '';
  const orderDate = customer['Order Date'] ? formatDateToDDMMYYYY(new Date(customer['Order Date'])) : '';
  const cashMemoNo = customer['Cash Memo No.'] || '';
  const cashMemoDate = customer['Cash Memo Date'] ? formatDateToDDMMYYYY(new Date(customer['Cash Memo Date'])) : '';

  const basePrice = pickMoney(customer, ['Base Price (₹)', 'Base Price (â‚¹)', 'Base Price (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)', 'Base Price (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹)']);
  const dlvryCharges = pickMoney(customer, ['Delivery Charges (₹)', 'Delivery Charges (â‚¹)', 'Delivery Charges (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)', 'Delivery Charges (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹)']);
  const cAndCRebate = pickMoney(customer, ['Cash & Carry Rebate (₹)', 'Cash & Carry Rebate (â‚¹)', 'Cash & Carry Rebate (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)', 'Cash & Carry Rebate (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹)']);
  const cgst = pickMoney(customer, ['CGST (2.50%) (₹)', 'CGST (2.50%) (â‚¹)', 'CGST (2.50%) (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)', 'CGST (2.50%) (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹)']);
  const sgst = pickMoney(customer, ['SGST (2.50%) (₹)', 'SGST (2.50%) (â‚¹)', 'SGST (2.50%) (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)', 'SGST (2.50%) (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹)']);
  const totalAmount = pickMoney(customer, ['Total Amount (₹)', 'Total Amount (â‚¹)', 'Total Amount (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)', 'Total Amount (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹)']);
  const taxableAmount = pickMoney(customer, ['Taxable Amount (₹)', 'Taxable Amount (â‚¹)', 'Taxable Amount (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)', 'Taxable Amount (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹)']);
  const netPayable = pickMoney(customer, ['Net Payable (₹)', 'Net Payable (â‚¹)', 'Net Payable (ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹)', 'Net Payable (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹)']);

  const category = getHindiValue('Consumer Package', customer['Consumer Package'] || '');
  const connectionQty = getHindiValue('Connection/Qty', customer['Connection/Qty'] || 'SBC / 1');
  const eKyc = getHindiValue('EKYC Status', customer['EKYC Status'] || 'Not Done');
  const onlineRefillPaymentStatus = customer['Online Refill Payment status'] || '';
  const rawPaymentMethod = customer['Payment Method'] || '';
  const paymentSource = /paid/i.test(String(onlineRefillPaymentStatus)) ? 'Online' : (rawPaymentMethod || 'Pay On Delivery');
  const payment = getHindiValue('Payment Method', paymentSource);
  const bookingSource = getHindiValue('Order Source', customer['Order Source'] || 'HP Pay');

  const dealerName = getHindiValue('Consumer Name', dealerDetails?.name || '');
  const dealerPlotNo = getHindiValue('Address', dealerDetails?.address?.plotNo || '');
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
    netPayable,
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
        <div className="distributor-copy-title">{HINDI_LABELS.distributorCopy}</div>
        <div className="memo-table-wrap">
          <div className="memo-table-box memo-table-box--distributor">
            <DistributorDetails {...commonProps} labelSettings={labelSettings} />
          </div>
        </div>
        <div className="declaration">
          <p className="declaration-text">
            {HINDI_LABELS.declaration} : मैं भरे हुए एलपीजी सिलेंडर को सीलबंद स्थिति में प्राप्त करने तथा ऊपर लिखी गई राशि की पुष्टि करता/करती हूं।
            सिलेंडर का वजन तथा रिसाव मेरे सामने जांचा गया।
          </p>
          <div className="signature-section">
            <span>{HINDI_LABELS.signatureOfCustomer}</span>
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
            WhatsApp Booking No. <br />
            <strong className="contact-info-strong">9222201122</strong>
          </div>
          <div>
            Missed Call Booking No. <br />
            <strong className="contact-info-strong">9493602222</strong>
          </div>
          <div>
            {HINDI_LABELS.complaintNo} <br />
            <strong className="contact-info-strong">1800 233 3555</strong>
          </div>
        </div>

        <div className="header-content">
          <div className="header-content-flex-spacer"></div>
          <p className="tax-invoice-title">{HINDI_LABELS.taxInvoice}</p>
          <div className="header-content-flex-spacer">
            <img alt="1906" src="/1906.jpg" className="image-1906" />
          </div>
        </div>

        <div className="memo-table-wrap memo-table-wrap--tax">
          <div className="memo-table-box memo-table-box--tax">
            <TaxInvoiceDetails {...commonProps} labelSettings={labelSettings} />
          </div>
        </div>
        <p className="signature-text">For {dealerName}...........</p>

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
