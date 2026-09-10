# Architecture Refactor — Progress & Roadmap

App.jsx (~9,400 lines) को target module structure में तोड़ने का काम phases में हो रहा है,
ताकि हर step के बाद `npm run build` से verify किया जा सके।

## Done (extracted)

| File                             | Responsibility                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/app/routes.jsx`             | सारे lazy-loaded page/panel imports                                                                            |
| `src/app/permissions.js`         | `buildMenuAccessRules`, `canAccessMenuFeature`, `buildPackageAccessBreakdown`, `getAdminTabAccess`             |
| `src/auth/userAuth.js`           | dealer lookup, Firestore user mapping, login-device registration, expiry marking, `adminSignIn`/`adminSignOut` |
| `src/auth/adminAuth.js`          | admin credentials validation + re-exports                                                                      |
| `src/dealer/dealerRepository.js` | users local-cache merge (`mergeDealerIntoCache`), label-settings sync (`mergeDealerLabelSettings`)             |
| `src/services/storage.js`        | users cache (`readUsersCache`/`writeUsersCache`), session persist/clear/read                                   |
| `src/services/logging.js`        | audit trail entry build, local + Firestore audit writes                                                        |

## Remaining (roadmap)

1. `src/auth/AuthProvider.jsx` — login state (`loggedInUser`, `isLoggedIn`, session restore)
   एक Context में ले जाना। ये सबसे बड़ा step है क्योंकि 50+ state variables App में हैं।
2. `src/app/App.jsx` — जब App component छोटा हो जाए तो isko `src/app/` में move करना।
3. `src/cashmemo/` — `handlePrintCashmemo*` (line ~6400+) को `cashmemoPrintService.js` में।
4. `src/booking/` — parsed-data filters/upload flow को `bookingFilters.js` + `bookingService.js` में।
5. `src/approvals/` + `src/admin/` — AdminPanel JSX block (~line 1510–4300) अलग करना,
   `useApprovalQueue` hook पहले से `src/hooks/` में है, उसी के आसपास `approvalService.js` बनेगा।
6. `src/employee/` — AttendancePage/SalarySlipPage जैसी pages को folder में re-export करना
   (lazy imports तब `routes.jsx` के paths update होंगे)।

## Notes

- हर extraction के बाद build पास होता है (वेरिफाई किया गया)।
- `npm run lint` में जो errors हैं वे पहले से repo-wide हैं (CashMemoEnglish, Attendance आदि);
  refactor से जुड़ी files के नए errors fix कर दिए गए हैं।
