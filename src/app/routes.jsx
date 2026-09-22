import { lazy } from "react";

export const LazyInvoicePage = lazy(() => import("../InvoicePage"));
export const LazyHomeDashboard = lazy(
  () => import("../components/HomeDashboard"),
);
export const LazyDataWorkspace = lazy(
  () => import("../components/DataWorkspace"),
);
export const LazyRateUpdatePage = lazy(() => import("../RateUpdatePage"));
export const LazyRegisterPanel = lazy(() =>
  import("../components/AuthPanels").then((module) => ({
    default: module.RegisterPanel,
  })),
);
export const LazyAdminLoginPanel = lazy(() =>
  import("../components/AuthPanels").then((module) => ({
    default: module.AdminLoginPanel,
  })),
);
export const LazyUserLoginPanel = lazy(() =>
  import("../components/AuthPanels").then((module) => ({
    default: module.UserLoginPanel,
  })),
);
export const LazyProfileUpdatePanel = lazy(() =>
  import("../components/UserPanels").then((module) => ({
    default: module.ProfileUpdatePanel,
  })),
);
export const LazyBankDetailsPanel = lazy(() =>
  import("../components/UserPanels").then((module) => ({
    default: module.BankDetailsPanel,
  })),
);
export const LazyUserProfilePanel = lazy(() =>
  import("../components/UserPanels").then((module) => ({
    default: module.UserProfilePanel,
  })),
);
export const LazyContactSupportPanel = lazy(() =>
  import("../components/UserPanels").then((module) => ({
    default: module.ContactSupportPanel,
  })),
);
export const LazyDictionaryRequestPanel = lazy(() =>
  import("../components/UserPanels").then((module) => ({
    default: module.DictionaryRequestPanel,
  })),
);
export const LazyAttendancePage = lazy(() => import("../AttendancePage"));
export const LazyIdCardPage = lazy(() => import("../IdCardPage"));
export const LazyEmployeeProfilePage = lazy(
  () => import("../EmployeeProfilePage"),
);
export const LazySalarySlipPage = lazy(() => import("../SalarySlipPage"));
export const LazyAttendanceReportPage = lazy(
  () => import("../AttendanceReportPage"),
);
export const LazyEmployeeReportPage = lazy(
  () => import("../EmployeeReportPage"),
);
export const LazyStockRegisterPage = lazy(() => import("../StockRegisterPage"));
export const LazySalesReportPage = lazy(() => import("../SalesReportPage"));
