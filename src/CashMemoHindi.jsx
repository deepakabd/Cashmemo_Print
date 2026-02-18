import React from 'react';

const CashMemoHindi = ({ customerData }) => {
  if (!customerData) {
    return <p>कृपया कैशमेमो जनरेट करने के लिए एक ग्राहक का चयन करें।</p>;
  }

  // प्रदर्शन के लिए डमी डेटा, ग्राहक डेटा या अन्य स्रोतों से वास्तविक डेटा से बदलें
  const dummyOrderDetails = {
    orderNo: '558495',
    orderRefNo: '5230515200376779',
    orderDateTime: customerData['Order Date'] || 'उपलब्ध नहीं', // Use formatted date from customerData
    paymentType: 'डिलीवरी पर भुगतान',
    orderSource: 'आईवीआरएस',
    subsidyConsumed: '5 वर्ष .2023-2024',
    orderStatus: 'वितरित',
  };

  const dummyInvoiceDetails = {
    hsn: '27111900',
    cashMemoDetails: `1440396 / ${customerData['Cash Memo Date'] || 'उपलब्ध नहीं'}`, // Use formatted date from customerData
    consumerCategory: 'घरेलू',
    lastDeliveryDate: '22/07/2023',
    productName: '14.2 KG N5 CYLINDER-LD(DBTL CTC)',
    quantity: 1,
    connectionType: 'डीबीसी',
    ctcStatus: 'सीटीसी',
    refillType: 'रिफिल',
  };

  const dummyTotals = {
    baseRate: 884.29,
    deliveryCharges: 0.00,
    cashAndCarryRebate: 0.00,
    taxableAmount: 884.29,
    cgst: 22.11,
    sgst: 22.11,
    totalAmount: 928.50,
    advancePaidOnline: 0.00,
    netPayable: 928.50,
  };

  return (
    <div className="cash-memo-wrapper" style={{ border: '1px solid #ccc', marginBottom: '20px' }}>
      <div className="cash-memo-single" style={{ display: 'flex', fontFamily: 'Arial, sans-serif', width: '100%', boxSizing: 'border-box' }}>
        {/* Distributor Copy Section (Left Half) */}
        <div className="distributor-copy" style={{ width: '50%', borderRight: '1px dashed black', padding: '5px', boxSizing: 'border-box', fontSize: '10px' }}>
          {/* Header Section - Distributor Copy */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid black', paddingBottom: '5px', marginBottom: '5px' }}>
            <div style={{ fontSize: '9px', lineHeight: '1.3' }}>
              <p style={{ margin: '0', fontWeight: 'bold' }}>प्रमोद गैस एंड जनरल एजेंसीज</p>
              <p style={{ margin: '0' }}>वितरक कोड: 41051239</p>
              <p style={{ margin: '0' }}>पता: "धुरवनकुर", रामनागर</p>
              <p style={{ margin: '0' }}>जिला लातूर.लातूर.लातूर</p>
              <p style={{ margin: '0' }}>सीएसटीआईएन: 27AAHFP6000G1ZI</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <img src="https://via.placeholder.com/80x30?text=HP+GAS+Logo" alt="HP Gas Logo" style={{ width: '80px' }} />
            </div>
          </div>

          {/* Contact Numbers Section - Distributor Copy */}
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#f0f0f0', padding: '3px 0', fontSize: '9px', borderBottom: '1px solid black', marginBottom: '5px' }}>
            <span>एचपी एनीटाइम <strong style={{ color: 'red' }}>88888823456</strong></span>
            <span>व्हाट्सएप <strong style={{ color: 'red' }}>9222201122</strong></span>
          </div>

          <h4 style={{ textAlign: 'center', margin: '5px 0', fontSize: '10px' }}>डिस्ट्रीब्यूटर कॉपी</h4>

          {/* Customer Details - Distributor Copy */}
          <div style={{ border: '1px solid black', marginBottom: '5px', padding: '5px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '3px', fontSize: '9px' }}>
              <span>उपभोक्ता का नाम:</span><span>{customerData.Consumer_Name || 'उपलब्ध नहीं'}</span>
              <span>पता:</span><span>{customerData.Address || 'उपलब्ध नहीं'}</span>
              <span>कैश मेमो विवरण:</span><span>{dummyInvoiceDetails.cashMemoDetails}</span>
              <span>कुल राशि:₹</span><span>{dummyTotals.totalAmount.toFixed(2)}</span>
              <span>शुद्ध देय:₹</span><span>{dummyTotals.netPayable.toFixed(2)}</span>
            </div>
          </div>

          {/* Declaration - Distributor Copy */}
          <div style={{ border: '1px solid black', padding: '5px', minHeight: '60px', marginBottom: '5px' }}>
            <p style={{ margin: '0', fontSize: '8px' }}>
              घोषणा: मैं एतद्द्वारा सीलबंद स्थिति में भरे हुए एलपीजी सिलेंडर और उपरोक्त उल्लिखित मूल्य की प्राप्ति की पुष्टि करता हूं। सिलेंडर का वजन और किसी भी रिसाव के लिए मेरी उपस्थिति में जांच की गई और मैं संतुष्ट हूं।
            </p>
          </div>

          {/* Signature and QR Code - Distributor Copy */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px', fontSize: '9px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0' }}>ग्राहक के हस्ताक्षर</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <img src="https://via.placeholder.com/50x50?text=QR+Code" alt="QR Code" style={{ width: '50px' }} />
              <p style={{ margin: '0' }}>एचपी पे</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0' }}>वितरक के हस्ताक्षर</p>
            </div>
          </div>
        </div>

        {/* Tax Invoice Section (Right Half) */}
        <div className="tax-invoice" style={{ width: '50%', padding: '5px', boxSizing: 'border-box', fontSize: '10px' }}>
          {/* Header Section - Tax Invoice */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid black', paddingBottom: '5px', marginBottom: '5px' }}>
            <div style={{ fontSize: '9px', lineHeight: '1.3' }}>
              <p style={{ margin: '0', fontWeight: 'bold' }}>प्रमोद गैस एंड जनरल एजेंसीज</p>
              <p style={{ margin: '0' }}>वितरक कोड: 41051239</p>
              <p style={{ margin: '0' }}>पता: "धुरवनकुर", रामनागर</p>
              <p style={{ margin: '0' }}>जिला लातूर.लातूर.लातूर</p>
              <p style={{ margin: '0' }}>सीएसटीआईएन: 27AAHFP6000G1ZI <span style={{ marginLeft: '5px' }}>दूरभाष: 02382225284</span></p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <img src="https://via.placeholder.com/80x30?text=HP+GAS+Logo" alt="HP Gas Logo" style={{ width: '80px' }} />
            </div>
          </div>

          {/* Contact Numbers Section - Tax Invoice */}
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#f0f0f0', padding: '3px 0', fontSize: '9px', borderBottom: '1px solid black', marginBottom: '5px' }}>
            <span>एचपी एनीटाइम <strong style={{ color: 'red' }}>88888823456</strong></span>
            <span>व्हाट्सएप <strong style={{ color: 'red' }}>9222201122</strong></span>
            <span>मिस्ड कॉल बुकिंग नं. <strong style={{ color: 'red' }}>9493602222</strong></span>
          </div>

          <h4 style={{ textAlign: 'center', margin: '5px 0', fontSize: '10px' }}>टैक्स चालान</h4>

          {/* Customer Details and Order Details - Tax Invoice */}
          <div style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid black', marginBottom: '5px' }}>
            {/* Customer Details */}
            <div style={{ width: '49%', borderRight: '1px solid black', padding: '5px' }}>
              <h5 style={{ margin: '0 0 5px 0', textDecoration: 'underline', fontSize: '9px' }}>ग्राहक विवरण</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '3px', fontSize: '8px' }}>
                <span>एलपीजी आईडी:</span><span>{customerData.LPG_ID || 'उपलब्ध नहीं'}</span>
                <span>उपभोक्ता संख्या:</span><span>{customerData.Consumer_Number || 'उपलब्ध नहीं'}</span>
                <span>उपभोक्ता का नाम:</span><span>{customerData.Consumer_Name || 'उपलब्ध नहीं'}</span>
                <span>पता:</span><span>{customerData.Address || 'उपलब्ध नहीं'}</span>
              </div>
            </div>

            {/* Order Details */}
            <div style={{ width: '49%', padding: '5px' }}>
              <h5 style={{ margin: '0 0 5px 0', textDecoration: 'underline', fontSize: '9px' }}>ऑर्डर विवरण</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '3px', fontSize: '8px' }}>
                <span>ऑर्डर नं.:</span><span>{dummyOrderDetails.orderNo}</span>
                <span>ऑर्डर संदर्भ नं.:</span><span>{dummyOrderDetails.orderRefNo}</span>
                <span>ऑर्डर दिनांक और समय:</span><span>{dummyOrderDetails.orderDateTime}</span>
                <span>भुगतान प्रकार:</span><span>{dummyOrderDetails.paymentType}</span>
                <span>ऑर्डर स्रोत:</span><span>{dummyOrderDetails.orderSource}</span>
                <span>उपयोग की गई सब्सिडी:</span><span>{dummyOrderDetails.subsidyConsumed}</span>
                <span>ऑर्डर स्थिति:</span><span>{dummyOrderDetails.orderStatus}</span>
              </div>
            </div>
          </div>

          {/* Invoice Details and Totals - Tax Invoice */}
          <div style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid black' }}>
            {/* Invoice Details */}
            <div style={{ width: '49%', borderRight: '1px solid black', padding: '5px' }}>
              <h5 style={{ margin: '0 0 5px 0', textDecoration: 'underline', fontSize: '9px' }}>चालान विवरण</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '3px', fontSize: '8px' }}>
                <span>एचएसएन :</span><span>{dummyInvoiceDetails.hsn}</span>
                <span>कैश मेमो विवरण:</span><span>{dummyInvoiceDetails.cashMemoDetails}</span>
                <span>उपभोक्ता श्रेणी:</span><span>{dummyInvoiceDetails.consumerCategory}</span>
                <span>अंतिम डिलीवरी तिथि:</span><span>{dummyInvoiceDetails.lastDeliveryDate}</span>
                <span>उत्पाद का नाम:</span><span>{dummyInvoiceDetails.productName}</span>
                <span>मात्रा:</span><span>{dummyInvoiceDetails.quantity}</span>
                <span>कनेक्शन प्रकार:</span><span>{dummyInvoiceDetails.connectionType}</span>
                <span>सीटीसी स्थिति:</span><span>{dummyInvoiceDetails.ctcStatus}</span>
                <span>रिफिल प्रकार:</span><span>{dummyInvoiceDetails.refillType}</span>
              </div>
            </div>

            {/* Totals */}
            <div style={{ width: '49%', padding: '5px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '3px', fontSize: '8px' }}>
                <span>मूल दर:₹</span><span style={{ textAlign: 'right' }}>{dummyTotals.baseRate.toFixed(2)}</span>
                <span>डिलीवरी शुल्क:₹</span><span style={{ textAlign: 'right' }}>{dummyTotals.deliveryCharges.toFixed(2)}</span>
                <span>कैश और कैरी छूट:₹</span><span style={{ textAlign: 'right' }}>{dummyTotals.cashAndCarryRebate.toFixed(2)}</span>
                <span>कर योग्य राशि:₹</span><span style={{ textAlign: 'right' }}>{dummyTotals.taxableAmount.toFixed(2)}</span>
                <span>सीजीएसटी/यूटीजीएसटी (2.5%):₹</span><span style={{ textAlign: 'right' }}>{dummyTotals.cgst.toFixed(2)}</span>
                <span>एसजीएसटी/यूटीजीएसटी (2.5%):₹</span><span style={{ textAlign: 'right' }}>{dummyTotals.sgst.toFixed(2)}</span>
                <span style={{ fontWeight: 'bold' }}>कुल राशि:₹</span><span style={{ textAlign: 'right', fontWeight: 'bold' }}>{dummyTotals.totalAmount.toFixed(2)}</span>
                <span>अग्रिम भुगतान (ऑनलाइन):₹</span><span style={{ textAlign: 'right' }}>{dummyTotals.advancePaidOnline.toFixed(2)}</span>
                <span style={{ fontWeight: 'bold' }}>शुद्ध देय:₹</span><span style={{ textAlign: 'right', fontWeight: 'bold' }}>{dummyTotals.netPayable.toFixed(2)}</span>
              </div>
            </div>
          </div>
          {/* Signature and QR Code - Tax Invoice */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px', fontSize: '9px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0' }}>ग्राहक के हस्ताक्षर</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <img src="https://via.placeholder.com/50x50?text=QR+Code" alt="QR Code" style={{ width: '50px' }} />
              <p style={{ margin: '0' }}>एचपी पे</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0' }}>वितरक के हस्ताक्षर</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashMemoHindi;
