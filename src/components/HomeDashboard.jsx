import HomeDashboardLoggedIn from './home/HomeDashboardLoggedIn';
import HomeDashboardMarketing from './home/HomeDashboardMarketing';
import { homeDashboardStyles } from './home/homeDashboardStyles';

const HomeDashboard = ({
  isLoggedIn,
  todayOrders,
  pendingEkycCount,
  activePackageStatus,
  homeQuickActions,
  homeTodayFocus,
  homeSupportPoints,
  homeAccountDetails,
  announcements,
  actionCenterCards,
  recentActivities,
  onQuickAction,
}) => (
  <div className="placeholder-container home-dashboard">
    <style>{homeDashboardStyles}</style>
    <HomeDashboardMarketing isLoggedIn={isLoggedIn} />
    {isLoggedIn && (
      <HomeDashboardLoggedIn
        homeQuickActions={homeQuickActions}
        homeAccountDetails={homeAccountDetails}
        actionCenterCards={actionCenterCards}
        onQuickAction={onQuickAction}
        todayOrders={todayOrders}
        pendingEkycCount={pendingEkycCount}
        activePackageStatus={activePackageStatus}
        announcements={announcements}
        homeTodayFocus={homeTodayFocus}
        homeSupportPoints={homeSupportPoints}
        recentActivities={recentActivities}
      />
    )}
  </div>
);

export default HomeDashboard;
