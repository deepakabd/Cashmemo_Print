const ExpiredPlanGuide = ({ onUpgrade, adminContacts }) => (
  <section className="expired-plan-guide">
    <header className="expired-plan-guide__hero">
      <span>ACCOUNT STATUS</span>
      <h2>Your plan has expired / आपका प्लान समाप्त हो गया है</h2>
      <p>Once renewal is approved, your daily Cashmemo workflow will become active again. नीचे देखें कि renewal के बाद क्या मिलेगा और expiry के दौरान कौन-सी सुविधाएँ unavailable रहेंगी।</p>
    </header>
    <div className="expired-plan-guide__grid">
      <article className="expired-plan-guide__card expired-plan-guide__card--benefit">
        <h3>Benefits of renewal / Renewal के फायदे</h3>
        <ul>
          <li>Upload pending-booking Excel files and work with the latest data. / Pending booking Excel upload करके latest data पर काम कर सकेंगे।</li>
          <li>Generate, filter, verify reports, and print Cashmemos. / Cashmemo generate, filter, report verify और print कर सकेंगे।</li>
          <li>Use Invoice, Attendance, and Stock Register tools. / Invoice, Attendance और Stock Register tools use कर सकेंगे।</li>
          <li>Submit rate, profile, bank, label, delivery-area, and staff updates. / Rate, profile, bank, label, delivery area और staff updates भेज सकेंगे।</li>
        </ul>
      </article>
      <article className="expired-plan-guide__card expired-plan-guide__card--restricted">
        <h3>Unavailable without renewal / Renewal के बिना unavailable</h3>
        <ul>
          <li>Upload Data and the Cashmemo Print workflow. / Upload Data और Cashmemo Print workflow।</li>
          <li>Invoice creation, operational reports, and working-data filters. / Invoice creation, operational reports और working-data filters।</li>
          <li>Attendance, Stock Register, and configuration updates. / Attendance, Stock Register और configuration updates।</li>
          <li>New rate, profile, bank, and master-data approval requests. / नई rate, profile, bank और master-data approval requests।</li>
        </ul>
      </article>
    </div>
    <footer>
      <p>Submit your renewal request from <strong>Upgrade Plan</strong>. Approval के बाद access automatically restore हो जाएगा।</p>
      <div className="expired-plan-guide__actions">
        <button type="button" className="expired-plan-guide__upgrade" onClick={onUpgrade}>Upgrade Plan</button>
        <a href={`mailto:${adminContacts?.email || ''}`}>Email Admin</a>
        <a href={adminContacts?.whatsapp || '#'} target="_blank" rel="noopener noreferrer">WhatsApp Admin</a>
      </div>
    </footer>
  </section>
);

export default ExpiredPlanGuide;
