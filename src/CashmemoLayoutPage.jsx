import React from 'react';
import './CashMemoPrint.css';

export const getCashMemoPerPage = (pageType) => {
  if (pageType === '2 Cashmemo/Page') return 2;
  if (pageType === '4 Cashmemo/Page') return 4;
  return 3;
};

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
