import React from 'react';
import './CashMemoPrint.css';

export const getCashMemoPerPage = (pageType) => {
  if (pageType === '2 Cashmemo/Page') return 2;
  if (pageType === '4 Cashmemo/Page') return 4;
  return 3;
};

export const CASHMEMO_LAYOUT_PRINT_STYLES = `
  @page {
    size: A4 portrait;
    margin: 4mm 6mm 5mm;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111;
    font-family: Calibri, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  * {
    box-sizing: border-box;
  }
  body {
    padding: 0;
  }
  #print-root {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
  }
  .cashmemo-print-item {
    width: 100%;
    height: 94mm;
    margin: 0 0 2mm;
    border: 1px solid #111;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    background: #fff;
  }
  .cashmemo-print-item--2 {
    height: 142mm;
    margin-bottom: 2mm;
  }
  .cashmemo-print-item--4 {
    height: 68.75mm;
    margin-bottom: 1.5mm;
  }
  .cash-memo-single {
    display: flex;
    width: 100%;
    height: 100%;
    background: #fff;
    color: #111;
  }
  .distributor-copy,
  .tax-invoice {
    min-height: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
  .distributor-copy {
    width: 41.5%;
    border-right: 1px dashed #6e6e6e;
  }
  .tax-invoice {
    width: 58.5%;
  }
  .distributor-header,
  .tax-invoice-header {
    min-height: 12.5mm;
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid #222;
  }
  .distributor-header-logo,
  .tax-invoice-header-logo {
    width: 34%;
    display: flex;
    align-items: center;
    padding: 1mm 1.5mm;
  }
  .distributor-header-image,
  .tax-invoice-header-image {
    width: 100%;
    max-height: 10.5mm;
    object-fit: contain;
  }
  .distributor-header-details,
  .tax-invoice-header-details {
    flex: 1;
    padding: 0.9mm 1.5mm 0.7mm;
    text-align: center;
    font-size: 2.8mm;
    font-weight: 700;
    line-height: 1.1;
  }
  .distributor-header-detail-text,
  .tax-invoice-header-detail-text,
  .signature-text,
  .tax-invoice-title {
    margin: 0;
  }
  .distributor-copy-title {
    display: inline-block;
    margin: 0.9mm 0 0.8mm 1.2mm;
    padding: 0.35mm 1.4mm;
    background: #ececec;
    color: #222;
    font-size: 2.45mm;
    font-weight: 700;
  }
  .contact-info {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-bottom: 1px solid #222;
    background: #0a4c9a;
    color: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .contact-info > div {
    padding: 0.65mm 1mm;
    border-right: 1px solid rgba(255, 255, 255, 0.45);
    font-size: 2.05mm;
    line-height: 1.05;
  }
  .contact-info > div:last-child {
    border-right: none;
  }
  .contact-info-strong {
    font-size: 3.5mm;
    font-weight: 700;
    color: #fff;
  }
  .header-content {
    min-height: 5.4mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.2mm;
  }
  .tax-invoice-title {
    font-size: 2.5mm;
    font-weight: 700;
    padding-right: 5.4mm;
  }
  .header-content-flex-spacer {
    flex: 1;
  }
  .image-1906 {
    height: 5.2mm;
    object-fit: contain;
  }
  .signature-text {
    padding: 0 1.3mm 0.5mm;
    font-size: 2.1mm;
    font-weight: 700;
  }
  .declaration {
    min-height: 11.2mm;
    display: flex;
    align-items: flex-end;
    border: 1px solid #222;
    margin: 0.9mm 1mm 1mm;
  }
  .declaration-text {
    flex: 1;
    margin: 0;
    padding: 0.9mm 1mm 0.55mm;
    color: #c22121;
    font-size: 1.9mm;
    line-height: 1.1;
    text-align: justify;
    font-weight: 700;
  }
  .signature-section {
    width: 30%;
    min-width: 26mm;
    margin: 0 1.2mm 0.85mm 0.4mm;
    border-top: 1px solid #222;
    padding-top: 0.4mm;
    text-align: center;
    font-size: 2mm;
    font-weight: 600;
  }
  .instructions-section {
    display: flex;
    align-items: stretch;
    border: 1px solid #222;
    margin: 0 1mm 1mm;
  }
  .instructions-text-container {
    flex: 1;
    padding: 0.5mm 1mm 0.2mm;
  }
  .instructions-list {
    margin: 0;
    padding-left: 3.2mm;
    font-size: 1.7mm;
    line-height: 1.2;
  }
  .hp-pay-image-container {
    width: 19mm;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 0.6mm 0.8mm 0.6mm 0;
  }
  .hp-pay-image {
    width: 16.5mm;
    height: auto;
    object-fit: contain;
  }
  .cashmemo-layout-preview-slot .header-layout-sheet,
  .cashmemo-print-item .header-layout-sheet {
    height: 100%;
  }
  .cashmemo-layout-placeholder {
    visibility: hidden;
  }
  .cashmemo-layout-placeholder--left,
  .cashmemo-layout-placeholder--right {
    flex: 1;
  }
  .cash-memo-single--compact .distributor-header,
  .cash-memo-single--compact .tax-invoice-header {
    min-height: 10.8mm;
  }
  .cash-memo-single--compact .distributor-header-details,
  .cash-memo-single--compact .tax-invoice-header-details {
    font-size: 2.35mm;
  }
  .cash-memo-single--compact .distributor-copy-title,
  .cash-memo-single--compact .tax-invoice-title {
    font-size: 2.15mm;
  }
  .cash-memo-single--compact .contact-info > div {
    font-size: 1.75mm;
  }
  .cash-memo-single--compact .contact-info-strong {
    font-size: 2.85mm;
  }
  .cash-memo-single--compact .instructions-list,
  .cash-memo-single--compact .declaration-text,
  .cash-memo-single--compact .signature-text {
    font-size: 1.65mm;
  }
  .cash-memo-single--compact .signature-section {
    font-size: 1.65mm;
  }
`;

const PREVIEW_COPY = {
  English: {
    distributorCopy: 'Distributor Copy',
    taxInvoice: 'Tax Invoice',
    email: 'Email',
    gstn: 'GSTN',
    telephone: 'Telephone',
    whatsapp: 'Whatsapp Booking No.',
    missedCall: 'Missed Call Booking No.',
    complaint: 'Complaint No.',
    declaration: 'Declaration : I hereby confirm receipt of filled LPG cylinder in sealed condition and above mentioned price. The cylinder was checked in my presence for correct weight & for any leakages to my satisfaction.',
    signature: 'Signature of Customer',
  },
  Hindi: {
    distributorCopy: 'वितरक प्रति',
    taxInvoice: 'कर चालान',
    email: 'ईमेल',
    gstn: 'जीएसटीएन',
    telephone: 'फोन',
    whatsapp: 'WhatsApp Booking No.',
    missedCall: 'Missed Call Booking No.',
    complaint: 'Complaint No.',
    declaration: 'घोषणा : मैं भरे हुए एलपीजी सिलेंडर को सीलबंद स्थिति में प्राप्त करने तथा ऊपर लिखी गई राशि की पुष्टि करता/करती हूँ। सिलेंडर का वजन तथा रिसाव मेरे सामने जाँचा गया।',
    signature: 'उपभोक्ता के हस्ताक्षर',
  },
};

export const CashmemoHeaderPreviewSheet = ({ pageType, dealerDetails, language = 'English' }) => {
  const dealerName = dealerDetails?.name || '';
  const dealerPlotNo = dealerDetails?.address?.plotNo || '';
  const dealerEmail = dealerDetails?.contact?.email || '';
  const dealerTelephone = dealerDetails?.contact?.telephone || '';
  const dealerGstn = dealerDetails?.gstn || '';
  const copy = PREVIEW_COPY[language] || PREVIEW_COPY.English;
  const isCompactPage = pageType === '4 Cashmemo/Page';

  return (
    <div className={`cash-memo-single${isCompactPage ? ' cash-memo-single--compact' : ''} header-layout-sheet`}>
      <div className="distributor-copy">
        <div className="distributor-header">
          <div className="distributor-header-logo">
            <img src="/logo.jpg" alt="HP GAS Logo" className="distributor-header-image" />
          </div>
          <div className="distributor-header-details">
            <p className="distributor-header-detail-text">{dealerName}</p>
            <p className="distributor-header-detail-text">{copy.gstn} : {dealerGstn}</p>
          </div>
        </div>
        <div className="distributor-copy-title">{copy.distributorCopy}</div>
        <div className="cashmemo-layout-placeholder cashmemo-layout-placeholder--left" />
        <div className="declaration">
          <p className="declaration-text">
            {copy.declaration}
          </p>
          <div className="signature-section">
            <span>{copy.signature}</span>
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
            <p className="tax-invoice-header-detail-text">{copy.email} : {dealerEmail}</p>
            <p className="tax-invoice-header-detail-text">{copy.gstn} : {dealerGstn} | {copy.telephone} : {dealerTelephone}</p>
          </div>
        </div>

        <div className="contact-info">
          <div>
            HP ANYTIME 24x7 <br />
            <strong className="contact-info-strong">8888823456</strong>
          </div>
          <div>
            {copy.whatsapp} <br />
            <strong className="contact-info-strong">9222201122</strong>
          </div>
          <div>
            {copy.missedCall} <br />
            <strong className="contact-info-strong">9493602222</strong>
          </div>
          <div>
            {copy.complaint} <br />
            <strong className="contact-info-strong">1800 233 3555</strong>
          </div>
        </div>

        <div className="header-content">
          <div className="header-content-flex-spacer"></div>
          <p className="tax-invoice-title">{copy.taxInvoice}</p>
          <div className="header-content-flex-spacer">
            <img alt="1906" src="/1906.jpg" className="image-1906" />
          </div>
        </div>

        <div className="cashmemo-layout-placeholder cashmemo-layout-placeholder--right" />
        <p className="signature-text">{dealerName}{language === 'Hindi' ? '.....' : '......'}</p>
        <div className="instructions-section">
          <div className="instructions-text-container">
            <ul className="instructions-list">
              {language === 'Hindi' ? (
                <>
                  <li>डिलीवरी के समय एलपीजी सिलेंडर की प्री-डिलीवरी जाँच अवश्य कराएँ।</li>
                  <li>हर 5 वर्ष में एक बार एलपीजी इंस्टॉलेशन की जाँच कराएँ।</li>
                  <li>सुरक्षा होज को 5 वर्ष बाद या खराब होने पर बदलें।</li>
                  <li>होम डिलीवरी न लेने पर ग्राहक कैश एंड कैरी रिबेट के हकदार हैं।</li>
                </>
              ) : (
                <>
                  <li>Insist deliverymen for Pre Delivery checks of LPG Cylinder at time of delivery</li>
                  <li>Get your LPG Installation inspected once in 5 years</li>
                  <li>Replace Suraksha Hose every 5 years or earlier if damaged</li>
                  <li>Customers are entitled for cash & carry rebate in case of non-home delivery of LPG cylinder</li>
                </>
              )}
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

const CashmemoLayoutPage = ({
  pageType,
  setPageType,
  language,
  setLanguage,
  pageTypes,
  dealerDetails,
  onPrint,
  onClose,
}) => {
  const memosPerPage = getCashMemoPerPage(pageType);

  return (
    <div className="placeholder-container cashmemo-layout-page">
      <div className="label-update-header">
        <div>
          <h2>Cashmemo Layout</h2>
          <p>A4 page preview me selected page type ke hisaab se sirf visible layout section dikhai dega.</p>
        </div>
        <div className="label-update-actions">
          <select className="form-input" value={pageType} onChange={(e) => setPageType(e.target.value)}>
            {pageTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select className="form-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="English">English Header</option>
            <option value="Hindi">Hindi Header</option>
          </select>
          <button type="button" className="table-action table-action--blue" onClick={onPrint}>Print Layout</button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="cashmemo-layout-preview-card">
        <div className="cashmemo-layout-preview-caption">
          Preview: {pageType} | {language}
        </div>
        <div className="cashmemo-layout-preview-page">
          {Array.from({ length: memosPerPage }).map((_, index) => (
            <div key={`${pageType}-${language}-${index}`} className={`cashmemo-layout-preview-slot cashmemo-layout-preview-slot--${memosPerPage}`}>
              <CashmemoHeaderPreviewSheet pageType={pageType} dealerDetails={dealerDetails} language={language} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CashmemoLayoutPage;
