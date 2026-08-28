import './AboutInfo.css';

const operations = [
  ['Customer & Booking Management', 'Manage customer and booking records with upload, search, sorting, and operational filters.', 'Customer और Booking records को upload, search, sorting और operational filters के साथ manage करें।'],
  ['Cash Memo Management', 'Generate print-ready cash memos from customer records using configurable printing options.', 'Customer records से configurable printing options के साथ print-ready Cash Memo generate करें।'],
  ['Invoice Management', 'Create, save, and duplicate invoices to simplify regular billing activities.', 'Regular billing को आसान बनाने के लिए Invoice create, save और duplicate करें।'],
  ['Stock Register', 'Maintain and track LPG stock records through an organized digital register.', 'LPG Stock Records को एक organized digital register में maintain और track करें।'],
  ['Employee & Attendance Management', 'Manage employee profiles, attendance, ID cards, reports, and salary slips.', 'Employee profiles, attendance, ID cards, reports और salary slips manage करें।'],
  ['Reports & Operational Tracking', 'Review important customer and operational information through dedicated reports.', 'Dedicated reports के माध्यम से महत्वपूर्ण customer और operational information review करें।'],
  ['Search & Advanced Filters', 'Find required records quickly with customer, delivery, eKYC, payment, order, and cash memo filters.', 'Customer, delivery, eKYC, payment, order और Cash Memo filters से आवश्यक records जल्दी खोजें।'],
  ['Hindi & English Support', 'Support daily operational and printing requirements in Hindi and English.', 'Hindi और English terminology के साथ daily operations और printing requirements manage करें।'],
];

const benefits = [
  ['Faster Operations', 'Reduce repetitive manual steps.', 'Repetitive manual steps को कम करें।'],
  ['Organized Information', 'Keep records structured and searchable.', 'Records को structured और searchable रखें।'],
  ['Centralized Management', 'Manage multiple activities from one workspace.', 'कई activities को एक workspace से manage करें।'],
  ['Print-Ready Documents', 'Use practical cash memo and invoice formats.', 'Cash Memo और Invoice के practical print formats पाएँ।'],
];

const topics = [
  ['How to Manage LPG Booking Data Efficiently', 'LPG Booking Data को efficiently manage करने के practical तरीके।'],
  ['Cash Memo Management: From Data to Print', 'Cash Memo generation से printing तक का simple workflow।'],
  ['Understanding the LPG Stock Register', 'Stock records को organized तरीके से maintain करने का महत्व।'],
  ['Digital Employee & Attendance Management', 'Employee और attendance records को digitally manage करने के तरीके।'],
  ['Digital Transformation in LPG Distribution', 'LPG distribution में digital workflows की भूमिका।'],
];

const AboutInfo = ({ onLogin }) => (
  <section className="about-page about-page--final">
    <header className="about-hero">
      <span className="about-eyebrow">ABOUT cDCMS</span>
      <h1>Smart LPG Distribution<br />Management System</h1>
      <p className="about-hindi">स्मार्ट LPG डिस्ट्रीब्यूशन मैनेजमेंट सिस्टम</p>
      <p className="about-hero-copy">cDCMS is a digital management system designed to simplify and organize everyday operations for LPG distributors. It brings customer management, billing, documentation, stock tracking, employee management, and reporting into one centralized workspace.</p>
      <p className="about-hindi">cDCMS LPG distributors के daily operations को आसान और व्यवस्थित बनाने वाला digital management system है। यह customer management, billing, documentation, stock tracking, employee management और reporting को एक centralized workspace में लाता है।</p>
    </header>

    <section className="about-section about-copy-section">
      <span className="about-eyebrow">WHY cDCMS?</span>
      <h2>Built around everyday distributor operations.</h2>
      <p className="about-hindi">Distributor के daily operations को ध्यान में रखकर बनाया गया।</p>
      <p>LPG distribution involves recurring activities every day. Managing customer records, bookings, cash memos, invoices, stock records, employee activities, and reports through separate processes can become time-consuming.</p>
      <p>cDCMS brings these frequently used workflows together in one practical digital system, reducing repetitive work and keeping important information easy to access.</p>
      <p className="about-hindi">Customer records, bookings, Cash Memo, Invoice, Stock Records, Employee Activities और Reports को अलग-अलग processes से manage करना समय लेने वाला हो सकता है। cDCMS इन्हें एक practical digital system में लाकर repetitive work कम करता है।</p>
      <div className="about-change-grid"><div><strong>Reduce Manual Work</strong><small>Manual work कम करें</small></div><div><strong>Organize Information</strong><small>Information व्यवस्थित रखें</small></div><div><strong>Centralized System</strong><small>एक centralized system</small></div></div>
    </section>

    <section className="about-section">
      <span className="about-eyebrow">WHAT cDCMS BRINGS TOGETHER</span>
      <h2>One workspace. Multiple operations.</h2>
      <p className="about-hindi">एक workspace में कई महत्वपूर्ण operations।</p>
      <div className="about-feature-grid">{operations.map(([title, copy, hindi], index) => <article className="about-feature-card" key={title}><span className="about-feature-icon">{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{copy}</p><p className="about-hindi">{hindi}</p></article>)}</div>
    </section>

    <section className="about-workflow about-section">
      <span className="about-eyebrow">A SIMPLE DIGITAL WORKFLOW</span>
      <h2>From data to daily operations.</h2>
      <p className="about-hindi">Data से Daily Operations तक।</p>
      <p>cDCMS follows a practical workflow designed around frequently used distributor activities.</p>
      <div className="about-workflow-line">Upload <b>→</b> Search <b>→</b> Filter <b>→</b> Process <b>→</b> Print <b>→</b> Track</div>
      <p className="about-hindi">Upload करें → Search करें → Filter करें → Process करें → Print करें → Track करें</p>
    </section>

    <section className="about-section about-copy-section">
      <span className="about-eyebrow">DESIGNED FOR PRACTICAL USE</span>
      <h2>Simple tools for real-world operations.</h2>
      <p className="about-hindi">Real-world operations के लिए simple tools।</p>
      <p>cDCMS focuses on practical digital tools that support the everyday working requirements of LPG distributors. Instead of adding unnecessary complexity, the system keeps commonly used activities organized and accessible.</p>
      <p className="about-hindi">अनावश्यक complexity बढ़ाने के बजाय, cDCMS commonly used activities को organized और accessible workflow में रखता है।</p>
    </section>

    <section className="about-section">
      <span className="about-eyebrow">KEY BENEFITS</span>
      <h2>Work smarter. Stay organized.</h2>
      <p className="about-hindi">Smart तरीके से काम करें। Organized रहें।</p>
      <div className="about-benefit-strip">{benefits.map(([title, copy, hindi]) => <div key={title}><b>{title}</b><span>{copy}</span><small>{hindi}</small></div>)}</div>
    </section>

    <section className="about-section about-copy-section">
      <span className="about-eyebrow">OUR APPROACH</span>
      <h2>Technology that simplifies work.</h2>
      <p className="about-hindi">ऐसी Technology जो काम को आसान बनाए।</p>
      <p>We believe digital tools should make everyday work simpler, more organized, and easier to manage. cDCMS focuses on accessible workflows, organized information, practical document generation, and tools that support LPG distribution operations.</p>
      <p className="about-hindi">हमारा मानना है कि digital tools को daily work को आसान, व्यवस्थित और manage करने में सरल बनाना चाहिए।</p>
    </section>

    <section className="about-section about-knowledge">
      <span className="about-eyebrow">KNOWLEDGE HUB</span>
      <h2>Learn more about LPG distribution operations.</h2>
      <p className="about-hindi">LPG Distribution Operations के बारे में और जानें।</p>
      <p>Explore practical guides covering customer data management, cash memos, invoices, stock registers, employee management, and digital workflows.</p>
      <p className="about-hindi">Customer Data Management, Cash Memo, Invoice, Stock Register, Employee Management और digital workflows से जुड़े practical guides पढ़ें।</p>
      <div className="about-article-grid">{topics.map(([topic, hindi], index) => <article className="about-article" key={topic}><span>TOPIC {String(index + 1).padStart(2, '0')}</span><h3>{topic}</h3><p className="about-hindi">{hindi}</p><button type="button">Read Article →</button></article>)}</div>
    </section>

    <section className="about-cta">
      <span className="about-eyebrow">START WITH cDCMS</span>
      <h2>Bring your daily operations together.</h2>
      <p>Bring customer data, billing, cash memo, stock, employee management, reports, and other activities into one organized workspace.</p>
      <p className="about-hindi">अपने Daily Operations को एक organized digital workspace में manage करें।</p>
      <button type="button" onClick={onLogin}>Login <span>→</span></button>
    </section>
  </section>
);

export default AboutInfo;
