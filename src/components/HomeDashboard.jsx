import HomeDashboardLoggedIn from './home/HomeDashboardLoggedIn';
import HomeDashboardMarketing from './home/HomeDashboardMarketing';
import HomeKnowledgeHub from './home/HomeKnowledgeHub';
import { homeDashboardStyles } from './home/homeDashboardStyles';
import BrandMark from './BrandMark';

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
    {!isLoggedIn && <div className="home-dashboard__brand"><BrandMark size="large" /></div>}
    <HomeKnowledgeHub>
      <HomeDashboardMarketing isLoggedIn={isLoggedIn} onLogin={onLogin} onExplore={onExplore} />
    </HomeKnowledgeHub>
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
