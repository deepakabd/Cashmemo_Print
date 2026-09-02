const CashmemoPrintGuide = ({ onUpload }) => (
  <section className="cashmemo-guide">
    <header className="cashmemo-guide__hero">
      <span>CAS HMEMO PRINT WORKFLOW</span>
      <h2>Upload Pending Booking File</h2>
      <p>Cashmemo print karne se pehle cDCMS se downloaded pending booking Excel file upload kijiye.</p>
      <button type="button" className="cashmemo-guide__upload" onClick={onUpload}>Upload Pending Booking Excel</button>
    </header>
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
