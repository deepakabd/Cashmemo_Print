import { useMemo, useState } from 'react';

const UserMenuDropdown = ({
  dealerWelcome,
  loggedInUser,
  userAvatarLabel,
  userAvatarImage,
  navbarPackageName,
  userMenuStatusText,
  userMenuSummaryPills,
  profileCompletenessChecks,
  profileCompletionPercent,
  userRole,
  userMenuPackageTips,
  packageAccessBreakdown,
  renewalUrgencyLabel,
  recentActivities,
  userMenuEmptyGuidance,
  incompleteProfileAreas,
  incompleteProfileActionItems,
  runUserMenuItem,
  getDisabledReason,
  isPlanExpired,
  pendingRequestCount,
  contactReplyCount,
  updateInboxCount,
  primaryQuickAction,
  secondaryQuickAction,
  recommendedAction,
  userMenuSections,
  adminContacts,
  handleLogout,
  closeUserMenuAndRun,
  firstUserMenuActionRef,
  formatDisplayDate,
}) => {
  const [showTips, setShowTips] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState({});
  const searchLower = menuSearch.trim().toLowerCase();
  const filteredSections = useMemo(() => (
    userMenuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!searchLower) return true;
          return [section.title, item.label, item.reason, item.hint, item.badge?.label]
            .some((value) => String(value || '').toLowerCase().includes(searchLower));
        }),
      }))
      .filter((section) => section.items.length > 0)
  ), [searchLower, userMenuSections]);
  const visibleRecentActivities = Array.isArray(recentActivities) ? recentActivities.slice(0, 5) : [];
  const toggleSection = (title) => {
    setCollapsedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
  <div className="dropdown-menu" id="user-menu-dropdown" role="menu" aria-label="User menu">
    <div className="dropdown-menu__topbar">
      <button type="button" className="dropdown-menu__logout dropdown-menu__logout--top" onClick={closeUserMenuAndRun(handleLogout)} role="menuitem">
        Logout
      </button>
    </div>
    <div className="dropdown-menu__summary">
      <div className="dropdown-menu__summary-header">
        <div className="dropdown-menu__summary-identity">
          <div className="dropdown-menu__avatar">
            {userAvatarImage ? <img className="dropdown-menu__avatar-photo" src={userAvatarImage} alt="Profile" /> : userAvatarLabel}
          </div>
          <div>
          <div className="dropdown-menu__summary-name">{dealerWelcome || loggedInUser?.dealerCode || 'User'}</div>
          <div className="dropdown-menu__summary-meta">
            <span>Package: {navbarPackageName}</span>
            <span>Valid Till: {formatDisplayDate(loggedInUser?.validTill) || '-'}</span>
            <span>Status: {userMenuStatusText}</span>
            <span className="dropdown-menu__summary-meta--accent">{renewalUrgencyLabel}</span>
          </div>
          </div>
        </div>
        <div className="dropdown-menu__summary-zone">Status</div>
      </div>
      <div className="dropdown-menu__progress">
        <div className="dropdown-menu__progress-label">
          <span>Account Setup</span>
          <strong>{profileCompletionPercent}%</strong>
        </div>
        <div className="dropdown-menu__progress-track">
          <span className="dropdown-menu__progress-fill" style={{ width: `${profileCompletionPercent}%` }} />
        </div>
      </div>
      <div className="dropdown-menu__summary-pills">
        {userMenuSummaryPills.map((pill) => (
          <span key={pill.label} className={`dropdown-menu__summary-pill dropdown-menu__summary-pill--${pill.tone}`}>
            {pill.label}
          </span>
        ))}
      </div>
      <div className="dropdown-menu__summary-note dropdown-menu__summary-note--secondary">
        Role: {userRole} | Missing: {incompleteProfileAreas.length > 0 ? incompleteProfileAreas.map((item) => item.label).join(', ') : 'None'}
      </div>
      <div className="dropdown-menu__summary-drilldown">
        {profileCompletenessChecks.map((item) => (
          <div key={item.key} className="dropdown-menu__summary-drilldown-item">
            <strong>{item.label}: {item.complete ? 'Available' : 'Missing'}</strong>
            <span>{item.complete ? `${item.label} setup ready hai.` : item.reason}</span>
          </div>
        ))}
      </div>
      {incompleteProfileActionItems.length > 0 && (
        <div className="dropdown-menu__summary-actions">
          {incompleteProfileActionItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className="dropdown-menu__summary-action"
              onClick={runUserMenuItem(item)}
              disabled={item.disabled}
              title={item.disabled ? getDisabledReason(item.viewKey) : `Open ${item.label}`}
              role="menuitem"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {(isPlanExpired || pendingRequestCount > 0 || contactReplyCount > 0) && (
        <div className="dropdown-menu__summary-note">
          {isPlanExpired
            ? 'Plan renew karte hi uploads, invoice aur requests dobara active ho jayenge.'
            : [
                pendingRequestCount > 0 ? `${pendingRequestCount} request pending` : '',
                contactReplyCount > 0 ? `${contactReplyCount} unread reply` : '',
                updateInboxCount > 0 ? `${updateInboxCount} total updates` : '',
              ].filter(Boolean).join(' | ')}
        </div>
      )}
      <div className="dropdown-menu__summary-note dropdown-menu__summary-note--tip">
        {userMenuPackageTips[0]?.text || ''}
      </div>
    </div>
    <div className="dropdown-menu__section">
      <div className="dropdown-menu__section-title">Search Menu</div>
      <div className="dropdown-menu__search-wrap">
        <input
          type="text"
          className="dropdown-menu__search-input"
          placeholder="Search actions..."
          value={menuSearch}
          onChange={(e) => setMenuSearch(e.target.value)}
        />
      </div>
    </div>
    {recommendedAction && (
      <div className="dropdown-menu__section dropdown-menu__section--recommended">
        <div className="dropdown-menu__section-title">Recommended Next Step</div>
        <button
          type="button"
          className="dropdown-menu__recommended-card"
          onClick={runUserMenuItem(recommendedAction)}
          disabled={recommendedAction.disabled}
          title={recommendedAction.disabled ? (recommendedAction.reason || '') : recommendedAction.description}
          role="menuitem"
        >
          <span className="dropdown-menu__recommended-label">{recommendedAction.label}</span>
          <strong>{recommendedAction.actionLabel}</strong>
          <span className="dropdown-menu__recommended-text">
            {recommendedAction.disabled ? (recommendedAction.reason || recommendedAction.description) : recommendedAction.description}
          </span>
        </button>
      </div>
    )}
    <div className="dropdown-menu__section">
      <button
        type="button"
        className="dropdown-menu__section-toggle"
        onClick={() => toggleSection('Package & Access')}
        aria-expanded={!collapsedSections['Package & Access']}
      >
        <span className="dropdown-menu__section-title">Package & Access</span>
        <span className="dropdown-menu__section-toggle-icon">{collapsedSections['Package & Access'] ? 'Show' : 'Hide'}</span>
      </button>
      {!collapsedSections['Package & Access'] && (
        <div className="dropdown-menu__insight-grid">
          <div className="dropdown-menu__insight-card">
            <strong>Available Now</strong>
            <span>{packageAccessBreakdown.availableNow.length > 0 ? packageAccessBreakdown.availableNow.join(', ') : 'No active tools right now.'}</span>
          </div>
          <div className="dropdown-menu__insight-card">
            <strong>Locked Until Renewal</strong>
            <span>{packageAccessBreakdown.lockedUntilRenewal.length > 0 ? packageAccessBreakdown.lockedUntilRenewal.join(', ') : 'Nothing locked by renewal.'}</span>
          </div>
          <div className="dropdown-menu__insight-card">
            <strong>Hindi Package Only</strong>
            <span>{packageAccessBreakdown.hindiPackageOnly.length > 0 ? packageAccessBreakdown.hindiPackageOnly.join(', ') : 'Hindi tools active in current package.'}</span>
          </div>
        </div>
      )}
    </div>
    <div className="dropdown-menu__section dropdown-menu__section--quick">
      <div className="dropdown-menu__section-title">Quick Actions</div>
      <div className="dropdown-menu__quick-actions">
        <button type="button" className="dropdown-menu__quick-action" onClick={runUserMenuItem(primaryQuickAction)} role="menuitem">
          {primaryQuickAction.label}
        </button>
        <button type="button" className="dropdown-menu__quick-action" onClick={runUserMenuItem(secondaryQuickAction)} role="menuitem">
          {secondaryQuickAction.label}
        </button>
      </div>
    </div>
    <div className="dropdown-menu__section">
      <button
        type="button"
        className="dropdown-menu__section-toggle"
        onClick={() => toggleSection('Recent Activity')}
        aria-expanded={!collapsedSections['Recent Activity']}
      >
        <span className="dropdown-menu__section-title">Recent Activity</span>
        <span className="dropdown-menu__section-toggle-icon">{collapsedSections['Recent Activity'] ? 'Show' : 'Hide'}</span>
      </button>
      {!collapsedSections['Recent Activity'] && (
        <div className="dropdown-menu__activity-list">
          {visibleRecentActivities.length === 0 ? (
            <div className="dropdown-menu__empty-state">Abhi recent activity available nahi hai.</div>
          ) : (
            visibleRecentActivities.map((item) => (
              <div key={item.id || `${item.message}-${item.createdAt}`} className="dropdown-menu__activity-item">
                <strong>{item.message}</strong>
                <span>{item.createdAt}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
    <div className="dropdown-menu__section">
      <button
        type="button"
        className="dropdown-menu__section-toggle"
        onClick={() => setShowTips((prev) => !prev)}
        aria-expanded={showTips}
        aria-controls="user-menu-tips-panel"
      >
        <span className="dropdown-menu__section-title">Tips</span>
        <span className="dropdown-menu__section-toggle-icon">{showTips ? 'Hide' : 'Show'}</span>
      </button>
      {showTips && (
        <>
          <div className="dropdown-menu__tips" id="user-menu-tips-panel">
            {userMenuPackageTips.map((tip) => (
              <button
                key={tip.text}
                type="button"
                className="dropdown-menu__tip dropdown-menu__tip--action"
                onClick={runUserMenuItem(tip)}
                disabled={tip.disabled}
                title={tip.disabled ? getDisabledReason(tip.viewKey) : tip.text}
                role="menuitem"
              >
                <span>{tip.text}</span>
                <strong>{tip.actionLabel}</strong>
              </button>
            ))}
          </div>
          <div className="dropdown-menu__empty-state">{userMenuEmptyGuidance}</div>
        </>
      )}
    </div>
    {filteredSections.map((section) => (
      <div key={section.title} className="dropdown-menu__section">
        <button
          type="button"
          className="dropdown-menu__section-toggle"
          onClick={() => toggleSection(section.title)}
          aria-expanded={!collapsedSections[section.title]}
        >
          <span className="dropdown-menu__section-title">{section.title}</span>
          <span className="dropdown-menu__section-toggle-icon">{collapsedSections[section.title] ? 'Show' : 'Hide'}</span>
        </button>
        {!collapsedSections[section.title] && section.items.map((item, itemIndex) => (
          <button
            key={item.label}
            type="button"
            className={item.active ? 'dropdown-menu__button dropdown-menu__button--active' : item.unread ? 'dropdown-menu__button dropdown-menu__button--unread' : 'dropdown-menu__button'}
            ref={itemIndex === 0 && section.title === filteredSections[0]?.title ? firstUserMenuActionRef : null}
            onClick={runUserMenuItem(item)}
            disabled={item.disabled}
            title={item.reason || item.hint || ''}
            role="menuitem"
            aria-current={item.active ? 'page' : undefined}
          >
            <span className="dropdown-menu__button-row">
              <span>{item.label}</span>
              <span className="dropdown-menu__badges">
                {item.unread && <span className="dropdown-menu__badge dropdown-menu__badge--unread dropdown-menu__badge--pulse">New</span>}
                {item.active && <span className="dropdown-menu__badge dropdown-menu__badge--active">Open</span>}
                {item.badge && <span className={`dropdown-menu__badge dropdown-menu__badge--${item.badge.tone}`}>{item.badge.label}</span>}
              </span>
            </span>
            {(item.reason || item.hint || item.active) && (
              <span className="dropdown-menu__button-subtext">
                {item.active ? 'You are viewing this section.' : (item.reason || item.hint)}
              </span>
            )}
          </button>
        ))}
      </div>
    ))}
    {filteredSections.length === 0 && (
      <div className="dropdown-menu__section">
        <div className="dropdown-menu__empty-state">No menu actions matched your search.</div>
      </div>
    )}
    <div className="dropdown-menu__section">
      <div className="dropdown-menu__section-title">Admin Contact</div>
      <div className="dropdown-menu__contact-actions">
        <a className="dropdown-menu__contact-link" href={`mailto:${adminContacts.email}`}>Email Admin</a>
        <a className="dropdown-menu__contact-link" href={adminContacts.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp Admin</a>
      </div>
    </div>
  </div>
  );
};

export default UserMenuDropdown;
