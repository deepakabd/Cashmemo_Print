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
  onLogin,
  onExplore,
  onStockRegister,
  onAttendance,
}) => (
  <div className="placeholder-container home-dashboard">
    <style>{homeDashboardStyles}</style>
    <HomeDashboardMarketing isLoggedIn={isLoggedIn} onLogin={onLogin} onExplore={onExplore} />
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
        onStockRegister={onStockRegister}
        onAttendance={onAttendance}
        recentActivities={recentActivities}
      />
    )}
  </div>
);

export default HomeDashboard;
