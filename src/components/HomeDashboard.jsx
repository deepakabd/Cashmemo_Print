const HomeDashboard = ({
  isLoggedIn,
  todayOrders,
  pendingEkycCount,
  activePackageStatus,
  homeQuickActions,
  homeTodayFocus,
  homeSupportPoints,
  homeAccountDetails,
  actionCenterCards,
  recentActivities,
  onQuickAction,
}) => (
  <div className="placeholder-container home-dashboard">
    <h2 className="home-info-title">🏠 होम (Home Dashboard)</h2>

    <div className="home-important-note">
      {!isLoggedIn && <h2>वेबसाइट टेस्ट करने के लिए ID- 41099999 , Pin - 0000 का उपयोग करे</h2>}
      <h3>📌 महत्वपूर्ण सूचना (Cashmemo Print हेतु)</h3>
      <p>Cashmemo प्रिंट करने से पहले कृपया अपने Pending Cashmemo को cDCMS से डाउनलोड या सेव अवश्य करें।</p>
      <p><strong>डाउनलोड करने का पथ (Path):</strong> cDCMS -&gt; Order Fulfillment -&gt; Pending Booking</p>
      <p>डाउनलोड की गई फ़ाइल को इस पोर्टल के Top Navbar में Upload करें, फिर “Show Data” पर क्लिक करके डेटा प्रदर्शित करें।</p>
      <p><strong>बिना cDCMS से Pending Booking डेटा अपलोड किए Cashmemo प्रिंट संभव नहीं होगा।</strong></p>
    </div>

    <div className="home-section">
      <h3>स्वागत संदेश</h3>
      <p>HPCL LPG Distributor Dashboard में आपका स्वागत है।</p>
      <p>यहाँ से आप cDCMS से Pending Booking डेटा upload करके, उसे validate और review करके, Cashmemo और Tax Invoice print कर सकते हैं।</p>
      <p>इसके साथ ही आप Profile, Bank, Rate, Delivery Area और Delivery Staff update requests भेज सकते हैं तथा approval workflow को ट्रैक कर सकते हैं।</p>
    </div>

    <div className="home-hero-grid">
      <div className="home-section home-highlight-card">
        <h3>काम करने का आसान क्रम</h3>
        <ol className="home-steps-list">
          {homeQuickActions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="home-section home-highlight-card">
        <h3>अकाउंट की झलक</h3>
        <div className="home-account-grid">
          {homeAccountDetails.map((item) => (
            <div key={item.label} className="home-account-item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="home-action-center">
      <div className="home-action-center__header">
        <div>
          <p className="home-action-center__eyebrow">Action Center</p>
          <h3>आज का अगला काम यही से पकड़ें</h3>
        </div>
        <div className="home-action-center__meta">
          <span>{todayOrders} bookings today</span>
          <span>{pendingEkycCount} eKYC pending</span>
          <span>{activePackageStatus}</span>
        </div>
      </div>
      <div className="home-action-center__grid">
        {actionCenterCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`home-action-card home-action-card--${card.tone || 'default'}`}
            onClick={() => onQuickAction(card.action)}
            disabled={card.disabled}
            title={card.description}
          >
            <div className="home-action-card__top">
              <span className="home-action-card__label">{card.label}</span>
              {card.badge ? <span className="home-action-card__badge">{card.badge}</span> : null}
            </div>
            <strong>{card.title}</strong>
            <p>{card.description}</p>
            <span className="home-action-card__cta">{card.cta}</span>
          </button>
        ))}
      </div>
    </div>

    <div className="home-layout">
      <div className="home-section">
        <h3>त्वरित कार्य</h3>
        <ul>
          {homeQuickActions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="home-section">
        <h3>आज का फोकस</h3>
        <ul>
          {homeTodayFocus.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="home-section">
        <h3>सहायता और सुझाव</h3>
        <ul>
          {homeSupportPoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>

    <div className="home-recent-activity">
      <div className="home-recent-activity__header">
        <h3>Recent Activity</h3>
        <span>{recentActivities.length} recent actions</span>
      </div>
      {recentActivities.length === 0 ? (
        <p className="home-recent-activity__empty">Abhi recent activity available nahi hai. Upload, login, ya request submit karte hi yahan summary dikhegi.</p>
      ) : (
        <div className="home-recent-activity__list">
          {recentActivities.map((item) => (
            <div key={item.id} className="home-recent-activity__item">
              <strong>{item.message}</strong>
              <span>{item.createdAt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default HomeDashboard;
