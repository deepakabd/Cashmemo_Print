const CashmemoPrintGuide = ({ onUpload, canUpload = true }) => (
  <section className="cashmemo-guide">
    <header className="cashmemo-guide__hero">
      <span>CASHMEMO PRINT WORKFLOW</span>
      <h2>Upload Pending Booking File</h2>
      <p>Cashmemo print karne se pehle cDCMS se downloaded pending booking Excel file upload kijiye.</p>
      {canUpload && <button type="button" className="cashmemo-guide__upload" onClick={onUpload}>Upload Pending Booking Excel</button>}
    </header>
    <section className="cashmemo-guide__instructions" aria-label="Cashmemo printing instructions">
      <h3>📌 आवश्यक निर्देश: Cashmemo प्रिंट के लिए (Important Instructions for Printing)</h3>
      <ol className="cashmemo-guide__steps">
        <li className="cashmemo-guide__step cashmemo-guide__step--yellow"><strong>Step 1: cDCMS में जाकर Pending Booking file डाउनलोड करें</strong><span>Path: cDCMS → Order Fulfillment → Pending Booking (डाउनलोड करें)</span></li>
        <li className="cashmemo-guide__step cashmemo-guide__step--purple"><strong>Step 2: इस पोर्टल के Top Navbar में CSV/Excel फाइल Upload करें</strong><span>Upload बटन में जाकर अपनी Pending Booking फाइल चुनें।</span></li>
        <li className="cashmemo-guide__step cashmemo-guide__step--cyan"><strong>Step 3: “Show Data” बटन दबाकर डेटा को सत्यापित करें</strong><span>सभी rows को जाँचें और आवश्यक फ़िल्टर सही हैं यह सुनिश्चित करें।</span></li>
        <li className="cashmemo-guide__step cashmemo-guide__step--green"><strong>Step 4: फ़िल्टर लागू करें और Cashmemo प्रिंट करें</strong><span>Advanced filters (eKYC, Payment Status, Area) का उपयोग करके चयनित cashmemo प्रिंट करें।</span></li>
      </ol>
      <p className="cashmemo-guide__warning">⚠️ महत्वपूर्ण: बिना cDCMS से Pending Booking डेटा अपलोड किए Cashmemo प्रिंट संभव नहीं होगा।</p>
      <div className="cashmemo-guide__features">
        <h3>✨ मुख्य विशेषताएं (Key Features):</h3>
        <ul>
          <li>📊 स्मार्ट डेटा विश्लेषण: Aging reports (2-5 दिन), Advanced filters और Real-time insights</li>
          <li>🖨️ बल्क प्रिंटिंग: 2, 3 या 4 cashmemos प्रति पेज, GST कैलकुलेशन के साथ</li>
          <li>🌐 द्विभाषी सपोर्ट: Hindi-English Dictionary, यूनिकोड और बेहतर प्रिंटिंग सपोर्ट</li>
          <li>🛡️ सुरक्षित एक्सेस: PIN-based login, Role-based access और Approval workflows</li>
        </ul>
      </div>
    </section>
    <div className="cashmemo-guide__grid">
      <article>
        <strong>1. Pending Booking download karein</strong>
        <p>cDCMS login karein → Booking / Refill section kholein → Pending Booking report select karein → date aur delivery area verify karke Excel format me Download ya Save karein.</p>
      </article>
      <article>
        <strong>2. File ko change na karein</strong>
        <p>Downloaded Excel file ka column structure, header aur data rows edit na karein. Isse Cashmemo, filters aur reports sahi kaam karenge.</p>
      </article>
      <article>
        <strong>3. Upload aur verify karein</strong>
        <p>Upar Upload Pending Booking Excel button se saved file choose karein. Upload ke baad records, filters aur report cards check karein.</p>
      </article>
    </div>
    <section className="cashmemo-guide__preview">
      <div><span>Cashmemo workspace</span><h3>Upload ke baad aapko kya milega</h3></div>
      <div className="cashmemo-guide__tools"><button type="button" disabled>Filters</button><button type="button" disabled>Report</button><button type="button" disabled>Print Cashmemo</button></div>
      <div className="cashmemo-guide__table"><span>Consumer No.</span><span>Customer Name</span><span>Delivery Area</span><span>Cashmemo Status</span><span>Payment</span></div>
      <p>Filters se pending / online-paid / eKYC records select karein, Report se totals verify karein, phir selected records ka Cashmemo Print karein.</p>
    </section>
  </section>
);

export default CashmemoPrintGuide;
