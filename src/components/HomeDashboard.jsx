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
    {!isLoggedIn && <div className="demo-access-banner"><strong>🔒 Demo Access Available</strong><span>ID: 41099999 | PIN: 0000</span><small>डेमो अकाउंट देखने के लिए ID - 41099999, Pin - 0000 का उपयोग करें।</small></div>}
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
