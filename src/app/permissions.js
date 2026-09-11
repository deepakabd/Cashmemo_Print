import { ADMIN_ROLE_PERMISSIONS } from "../utils/appConfig";
import { isHindiEnterprisePackage, isUserExpired } from "../utils/packageHelpers";

// ---------------------------------------------------------------------------
// getAccessState — CENTRAL permission engine.
//
// Ek hi jagah se poora access picture. UI kabhi bhi individual conditions
// (isPlanExpired, status checks, validTill comparisons) nahi banayegi —
// yahan se state object le kar use karegi.
//
//  {
//    authenticated,      // user logged in hai
//    accountActive,      // status 'disabled'/'pending' nahi hai
//    planActive,         // plan expire nahi hua (status ya validTill se)
//    canUpload,          // CSV/data upload
//    canPrint,           // cashmemo print
//    canInvoice,         // invoice tools
//    canRequestUpdate,   // profile/bank/rates/header update requests
//    isPlanExpired,      // backward-compat derived flag
//    hasHindiPackageAccess,
//  }
// ---------------------------------------------------------------------------
export const getAccessState = (user, { isLoggedIn = false, hasWorkingData = false } = {}) => {
  const authenticated = Boolean(isLoggedIn && user && user.id);
  const status = String(user?.status || "").toLowerCase();
  const planActive = authenticated
    && status !== "expired"
    && !isUserExpired(user);
  const accountActive = authenticated && status !== "disabled" && status !== "pending";
  const allowed = authenticated && planActive;
  const hasHindiPackageAccess = isHindiEnterprisePackage(user?.package);

  return {
    authenticated,
    accountActive,
    planActive,
    isPlanExpired: authenticated && !planActive,
    hasHindiPackageAccess,
    hasWorkingData: Boolean(hasWorkingData),
    canUpload: allowed,
    canPrint: allowed,
    canInvoice: allowed && Boolean(hasWorkingData),
    canRequestUpdate: allowed,
    canViewData: allowed && Boolean(hasWorkingData),
    status,
  };
};

export const buildMenuAccessRules = ({
  isPlanExpired,
  hasHindiPackageAccess,
}) => ({
  profileOverview: () => true,
  requestHistory: () => true,
  about: () => !isPlanExpired,
  invoice: () => !isPlanExpired,
  profileUpdate: () => !isPlanExpired,
  bankUpdate: () => !isPlanExpired,
  rateUpdate: () => !isPlanExpired,
  labelUpdate: () => !isPlanExpired,
  dictionaryUpdate: () => !isPlanExpired && hasHindiPackageAccess,
  deliveryAreaUpdate: () => !isPlanExpired && hasHindiPackageAccess,
  deliveryStaffUpdate: () => !isPlanExpired && hasHindiPackageAccess,
  headerUpdate: () => !isPlanExpired && hasHindiPackageAccess,
  upgradePlan: () => true,
  support: () => true,
});

export const canAccessMenuFeature = (menuAccessRules, featureKey) => {
  const rule = menuAccessRules?.[featureKey];
  return typeof rule === "function" ? rule() : true;
};

export const buildPackageAccessBreakdown = ({
  canAccessMenuFeature: canAccess,
  hasWorkingData,
  isPlanExpired,
  hasHindiPackageAccess,
}) => ({
  availableNow: [
    canAccess("profileUpdate") ? "Profile update" : "",
    canAccess("bankUpdate") ? "Bank update" : "",
    canAccess("rateUpdate") ? "Rate update" : "",
    hasWorkingData && canAccess("invoice") ? "Invoice tools" : "",
    hasWorkingData && !isPlanExpired ? "Data view" : "",
    canAccess("support") ? "Support & replies" : "",
  ].filter(Boolean),
  lockedUntilRenewal: [
    !canAccess("invoice") ? "Invoice tools" : "",
    !canAccess("rateUpdate") ? "Rate update" : "",
    !canAccess("labelUpdate") ? "Label update" : "",
    !canAccess("profileUpdate") ? "Profile update" : "",
    !canAccess("bankUpdate") ? "Bank update" : "",
  ].filter(Boolean),
  hindiPackageOnly: [
    !hasHindiPackageAccess ? "Dictionary update" : "",
    !hasHindiPackageAccess ? "Delivery area update" : "",
    !hasHindiPackageAccess ? "Delivery staff update" : "",
    !hasHindiPackageAccess ? "Header update" : "",
  ].filter(Boolean),
});

export const getAdminTabAccess = () => {
  const currentRolePermissions = ADMIN_ROLE_PERMISSIONS["super-admin"];
  return {
    canAccessTab: (tabKey) => currentRolePermissions.tabs.includes(tabKey),
    canMutateAdminData: Boolean(currentRolePermissions.mutate),
  };
};
