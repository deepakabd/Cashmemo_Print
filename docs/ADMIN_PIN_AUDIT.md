# Admin PIN reference audit

Audited `user.pin`, `pin:`, `pinHash`, and other PIN display references.

- Removed the PIN column from the admin table in `src/App.jsx`. The unused alternate `src/AdminPage.jsx` was subsequently removed after a project-wide reference search confirmed that only tests imported it. Admin UI now uses `App.jsx` with `useAdminData`; regression tests exercise the production snapshot and repository projections.
- Both user-cache helpers omit `pin`, `pinHash`, and `confirmPin`. Generic drawer summaries and details omit these fields too.
- Live registration requests are sanitized before publishing the admin snapshot, as well as before caching. User list/detail repository projections and `mapFirestoreUserDoc()` already omit credentials.
- Login, registration, create, edit, and import flows still need transient PIN inputs or request payloads. Edit inputs use password masking and clear after save/cancel; existing credentials are never prefilled.
- Server verification, hashing, migration, Firestore rule restrictions, and credential test fixtures retain intentional references. Restore supports validated hashes in its write payload; these are excluded from admin list/detail state.
- Static demo PIN instructions remain public demo information.

## Remaining credential storage issue

`src/auth/userAuth.js` currently returns `{ pin: value, pinHash: null, ... }` from `buildPinWritePatch()`. Registration spreads that patch into a Firestore write, and admin create/edit/import sends it to `server/adminUsers.js`, which currently preserves plaintext `pin` for those modes. Consequently, the older claim in `PIN_SECURITY.md` that plaintext PINs are never written does not describe the current implementation. The presence of `api/pin-hash.js` does not change this: this client helper does not call it.

This needs a separate credential-write migration to trusted hashing and removal of plaintext persistence. The UI changes here prevent these stored credentials from being displayed or retained in admin user/request state; they do not resolve plaintext database storage.
