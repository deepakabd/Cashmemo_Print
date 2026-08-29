import { useMemo } from 'react';

const HomeDashboardLoggedIn = ({ homeAccountDetails, todayOrders, pendingEkycCount, activePackageStatus, announcements, homeTodayFocus, actionCenterCards, onQuickAction, onStockRegister, onAttendance }) => {
  const now = useMemo(() => new Date(), []);
  const dealerName = homeAccountDetails.find((item) => item.label === 'Dealer Name')?.value || 'Dealer';
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateTime = now.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const overview = [
    ['Today’s Bookings', todayOrders, 'Orders recorded for today'],
    ['Pending eKYC', pendingEkycCount, 'Records needing review'],
    ['Selected Records', homeTodayFocus.find((item) => item.includes('selected'))?.match(/^\d+/)?.[0] || '0', 'Ready for print or export'],
    ['Plan Status', activePackageStatus, 'Current account package'],
  ];
  const attention = [
    pendingEkycCount > 0 ? { tone: 'danger', text: String(pendingEkycCount) + ' customer record(s) have pending eKYC', action: 'Review eKYC' } : null,
    ...homeTodayFocus.slice(2, 4).map((text) => ({ tone: 'info', text, action: 'Open workspace' })),
  ].filter(Boolean);

  return <section className="home-logged-dashboard">
    <header className="home-dashboard-welcome"><div><span className="home-dashboard-welcome__eyebrow">DAILY OPERATIONS OVERVIEW</span><h2>{greeting}, {dealerName}</h2><p>Welcome back! Here&apos;s your daily operational overview.</p><p className="home-dashboard-welcome__hindi">आज के महत्वपूर्ण operations और pending activities का overview नीचे दिया गया है।</p></div><div className="home-dashboard-welcome__status"><strong>● System Operational</strong><span>{dateTime}</span></div></header>
    <section className="home-dashboard-block"><div className="home-dashboard-block__heading"><div><span>TODAY&apos;S OVERVIEW</span><h3>Today&apos;s overview</h3></div><p>Only data currently available in your system is shown.</p></div><div className="home-summary-grid">{overview.map(([label, value, helper]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>)}</div></section>
    <section className="home-dashboard-block"><div className="home-dashboard-block__heading"><div><span>QUICK ACTIONS</span><h3>Quick actions</h3></div><p>जल्दी किए जाने वाले कार्य</p></div><div className="home-action-center__grid home-action-center__grid--dashboard">{actionCenterCards.slice(0, 6).map((card) => <button key={card.key} type="button" className={'home-action-card home-action-card--' + (card.tone || 'default')} onClick={() => onQuickAction(card.action)} disabled={card.disabled} title={card.description}><div className="home-action-card__top"><span className="home-action-card__label">{card.label}</span>{card.badge && <span className="home-action-card__badge">{card.badge}</span>}</div><strong>{card.title}</strong><p>{card.description}</p><span className="home-action-card__cta">{card.cta} →</span></button>)}</div></section>
    <div className="home-dashboard-columns"><section className="home-dashboard-panel"><div className="home-dashboard-block__heading"><div><span>TODAY&apos;S OPERATIONS</span><h3>What&apos;s happening today</h3></div></div><div className="home-operation-list">{homeTodayFocus.map((item, index) => <div key={item}><span className={index < 2 ? 'is-ready' : 'is-info'}>{index < 2 ? '✓' : '•'}</span><p>{item}</p></div>)}</div></section><section className="home-dashboard-panel"><div className="home-dashboard-block__heading"><div><span>NEEDS YOUR ATTENTION</span><h3>Pending tasks</h3></div></div>{attention.length ? <div className="home-attention-list">{attention.map((item) => <div key={item.text} className={'home-attention-item home-attention-item--' + item.tone}><p>{item.text}</p><button type="button" onClick={() => onQuickAction('showData')}>{item.action} →</button></div>)}</div> : <p className="home-dashboard-empty">No pending task needs attention right now.</p>}</section></div>
    <div className="home-dashboard-columns"><section className="home-dashboard-panel"><div className="home-dashboard-block__heading"><div><span>STOCK SNAPSHOT</span><h3>Stock overview</h3></div></div><p className="home-dashboard-empty">Today&apos;s stock summary will appear here after stock register data is available.</p><button type="button" className="home-dashboard-link" onClick={onStockRegister}>View Stock Register →</button></section><section className="home-dashboard-panel"><div className="home-dashboard-block__heading"><div><span>EMPLOYEE ATTENDANCE</span><h3>Attendance today</h3></div></div><p className="home-dashboard-empty">Attendance counts will appear here after today&apos;s attendance is recorded.</p><button type="button" className="home-dashboard-link" onClick={onAttendance}>Manage Attendance →</button></section></div>
    {announcements.length > 0 && <section className="home-dashboard-panel home-dashboard-panel--wide"><div className="home-dashboard-block__heading"><div><span>IMPORTANT UPDATES</span><h3>Announcements</h3></div></div><div className="home-announcement-list">{announcements.map((item) => <div key={item.id}><strong>{item.title}</strong><p>{item.message}</p></div>)}</div></section>}
  </section>;
};
export default HomeDashboardLoggedIn;
