import './AboutInfo.css';
import { useEffect, useState } from 'react';
import BrandMark from '../BrandMark';
//CHECK
const operations = [
  ['Customer & Booking Management', 'Manage customer and booking records with upload, search, sorting, and operational filters.', 'Customer और Booking records को upload, search, sorting और operational filters के साथ manage करें।', 'CUSTOMER FLOW'],
  ['Cash Memo Management', 'Generate print-ready cash memos from customer records using configurable printing options.', 'Customer records से configurable printing options के साथ print-ready Cash Memo generate करें।', 'BILLING DESK'],
  ['Invoice Management', 'Create, save, and duplicate invoices to simplify regular billing activities.', 'Regular billing को आसान बनाने के लिए Invoice create, save और duplicate करें।', 'INVOICE CONTROL'],
  ['Stock Register', 'Maintain and track LPG stock records through an organized digital register.', 'LPG Stock Records को एक organized digital register में maintain और track करें।', 'STOCK CONTROL'],
  ['Employee & Attendance Management', 'Manage employee profiles, attendance, ID cards, reports, and salary slips.', 'Employee profiles, attendance, ID cards, reports और salary slips manage करें।', 'TEAM DESK'],
  ['Reports & Operational Tracking', 'Review important customer and operational information through dedicated reports.', 'Dedicated reports के माध्यम से महत्वपूर्ण customer और operational information review करें।', 'INSIGHT CENTER'],
  ['Search & Advanced Filters', 'Find required records quickly with customer, delivery, eKYC, payment, order, and cash memo filters.', 'Customer, delivery, eKYC, payment, order और Cash Memo filters से आवश्यक records जल्दी खोजें।', 'SMART SEARCH'],
  ['Hindi & English Support', 'Support daily operational and printing requirements in Hindi and English.', 'Hindi और English terminology के साथ daily operations और printing requirements manage करें।', 'BILINGUAL WORKFLOW'],
];

const benefits = [
  ['Faster Operations', 'Reduce repetitive manual steps.', 'Repetitive manual steps को कम करें।'],
  ['Organized Information', 'Keep records structured and searchable.', 'Records को structured और searchable रखें।'],
  ['Centralized Management', 'Manage multiple activities from one workspace.', 'कई activities को एक workspace से manage करें।'],
  ['Print-Ready Documents', 'Use practical cash memo and invoice formats.', 'Cash Memo और Invoice के practical print formats पाएँ।'],
];

const topics = [
  ['How to Manage LPG Booking Data Efficiently', 'LPG Booking Data को efficiently manage करने के practical तरीके।', 'Learn how to upload booking data, search customer records, apply filters, and keep daily booking work organized so the team can find the right information quickly.', 'FIELD GUIDE · BOOKING DATA'],
  ['Cash Memo Management: From Data to Print', 'Cash Memo generation से printing तक का simple workflow।', 'Follow a clear process from selecting a customer record to checking the memo details, choosing the required format, and printing an accurate cash memo.', 'PRINT PLAYBOOK · CASH MEMO'],
  ['Understanding the LPG Stock Register', 'Stock records को organized तरीके से maintain करने का महत्व।', 'See how regular stock entries, delivery updates, and balance checks help distributors reduce mistakes and understand stock movement at a glance.', 'OPERATIONS NOTE · STOCK'],
  ['Digital Employee & Attendance Management', 'Employee और attendance records को digitally manage करने के तरीके।', 'Keep employee profiles, daily attendance, check-in times, leave, overtime, and wage information together for easier payroll and workforce management.', 'WORKFORCE GUIDE · ATTENDANCE'],
  ['Digital Transformation in LPG Distribution', 'LPG distribution में digital workflows की भूमिका।', 'Discover how connected digital workflows reduce repeated manual work and bring customer, billing, stock, employee, and reporting activities into one workspace.', 'STRATEGY BRIEF · DIGITAL FLOW'],
  ['How to Keep Customer Records Accurate', 'Customer details को updated, साफ और reliable रखने की practical checklist।', 'Use consistent customer details, review changes regularly, and remove duplicate or incomplete entries so booking and delivery teams always work with reliable information.', 'DATA CARE · CUSTOMER RECORDS'],
  ['Daily LPG Operations Checklist for Distributors', 'Opening से closing तक daily distributor activities को व्यवस्थित करने का तरीका।', 'Start the day by reviewing bookings and pending work, update delivery and payment information during operations, and close with stock and report checks.', 'DAILY PLAYBOOK · DISTRIBUTOR'],
  ['Managing Delivery Staff and Routes Better', 'Delivery staff, routes और customer service को बेहतर तरीके से coordinate करने के सुझाव।', 'Coordinate delivery staff with clear assignments, updated customer information, and route planning so deliveries stay timely and service issues are easier to track.', 'FIELD NOTE · DELIVERY ROUTES'],
  ['Using Reports for Faster Business Decisions', 'Reports और operational data से सही समय पर बेहतर business decisions लेने का तरीका।', 'Use daily and monthly reports to identify pending bookings, payment trends, stock needs, attendance patterns, and the operational areas that need attention first.', 'INSIGHT BRIEF · REPORTS'],
];

const AboutInfo = ({ onLogin, isLoggedIn = false, isPlanExpired = false, onUpgrade, adminContacts }) => {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const expiredActions = isPlanExpired && (
    <div className="about-expired-actions">
      <button type="button" className="about-expired-actions__upgrade" onClick={onUpgrade}>Upgrade Plan</button>
      <a href={`mailto:${adminContacts?.email || ''}`}>Email Admin</a>
      <a href={adminContacts?.whatsapp || '#'} target="_blank" rel="noopener noreferrer">WhatsApp Admin</a>
    </div>
  );

  useEffect(() => {
    if (!selectedTopic) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedTopic(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedTopic]);

  return (
  <section className="about-page about-page--final">
    <style>{`.about-feature-label{display:inline-flex;align-items:center;justify-content:center;width:auto;min-height:32px;padding:0 10px;box-sizing:border-box;border-radius:999px;background:#eaf4ff;color:#126bc5;font-size:10px;font-weight:800;letter-spacing:.08em;line-height:1.2;white-space:normal;text-align:center}`}</style>
    <header className="about-hero">
      <BrandMark size="large" />
      <span className="about-eyebrow">ABOUT cDCMS</span>
      <h1>Smart LPG Distribution<br />Management System</h1>
      <p className="about-hindi">स्मार्ट LPG डिस्ट्रीब्यूशन मैनेजमेंट सिस्टम</p>
      <p className="about-hero-copy">cDCMS is a digital management system designed to simplify and organize everyday operations for LPG distributors. It brings customer management, billing, documentation, stock tracking, employee management, and reporting into one centralized workspace.</p>
      <p className="about-hindi">cDCMS LPG distributors के daily operations को आसान और व्यवस्थित बनाने वाला digital management system है। यह customer management, billing, documentation, stock tracking, employee management और reporting को एक centralized workspace में लाता है।</p>
    </header>
    {isPlanExpired && <section className="about-expired-actions--top">{expiredActions}</section>}

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
      <div className="about-feature-grid">{operations.map(([title, copy, hindi, label]) => <article className="about-feature-card" key={title}><span className="about-feature-icon about-feature-label">{label}</span><h3>{title}</h3><p>{copy}</p><p className="about-hindi">{hindi}</p></article>)}</div>
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
      <div className="about-article-grid">{topics.map(([topic, hindi, description, label]) => <article className="about-article" key={topic}><span>{label}</span><h3>{topic}</h3><p className="about-hindi">{hindi}</p><button type="button" onClick={() => setSelectedTopic({ topic, hindi, description })}>Read Article →</button></article>)}</div>
    </section>

    {!isLoggedIn && <section className="about-cta">
      <span className="about-eyebrow">START WITH cDCMS</span>
      <h2>Bring your daily operations together.</h2>
      <p>Bring customer data, billing, cash memo, stock, employee management, reports, and other activities into one organized workspace.</p>
      <p className="about-hindi">अपने Daily Operations को एक organized digital workspace में manage करें।</p>
      <button type="button" onClick={onLogin}>Login <span>→</span></button>
    </section>}
    {isPlanExpired && <section className="about-section about-expired-actions--bottom">{expiredActions}</section>}
    {selectedTopic && <div className="about-article-dialog" role="dialog" aria-modal="true" aria-labelledby="about-article-title" onClick={() => setSelectedTopic(null)}>
      <div className="about-article-dialog__panel" onClick={(event) => event.stopPropagation()}>
        <span className="about-eyebrow">KNOWLEDGE HUB ARTICLE</span>
        <h2 id="about-article-title">{selectedTopic.topic}</h2>
        <p className="about-hindi">{selectedTopic.hindi}</p>
        <p>{selectedTopic.description}</p>
        <button type="button" onClick={() => setSelectedTopic(null)}>Close</button>
      </div>
    </div>}
  </section>
  );
};

export default AboutInfo;
