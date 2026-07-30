import { useState } from 'react';

const HomeDashboardLoggedIn = ({
  homeQuickActions,
  homeAccountDetails,
  actionCenterCards,
  onQuickAction,
  todayOrders,
  pendingEkycCount,
  activePackageStatus,
  announcements,
  homeTodayFocus,
  homeSupportPoints,
  recentActivities,
}) => {
  const [showRecentActivity, setShowRecentActivity] = useState(false);

  return (
    <>
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
          <h3>आज का अगला काम यहीं से पकड़ें</h3>
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
      {announcements.length > 0 && (
        <div className="home-section">
          <h3>Latest Announcements</h3>
          <ul>
            {announcements.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> - {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="home-section">
        <h3>त्वरित कार्य</h3>
        <ul>{homeQuickActions.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div className="home-section">
        <h3>आज का फोकस</h3>
        <ul>{homeTodayFocus.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div className="home-section">
        <h3>सहायता और सुझाव</h3>
        <ul>{homeSupportPoints.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </div>
      <div className="home-recent-activity">
        <button
          type="button"
          className="home-recent-activity__header home-recent-activity__toggle"
          onClick={() => setShowRecentActivity((prev) => !prev)}
          aria-expanded={showRecentActivity}
        >
          <h3>Recent Activity</h3>
          <span>{recentActivities.length} recent actions</span>
        </button>
        {showRecentActivity && (
          recentActivities.length === 0 ? (
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
          )
        )}
      </div>
    </>
  );
};

export default HomeDashboardLoggedIn;
