import { ADMIN_ROLE_PERMISSIONS } from "../utils/appConfig";

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
