# Admin PIN reference audit

Audited `user.pin`, `pin:`, `pinHash`, and other PIN display references.

- Removed the PIN column from the admin table in `src/App.jsx`. The unused alternate `src/AdminPage.jsx` was subsequently removed after a project-wide reference search confirmed that only tests imported it. Admin UI now uses `App.jsx` with `useAdminData`; regression tests exercise the production snapshot and repository projections.
- Both user-cache helpers omit `pin`, `pinHash`, and `confirmPin`. Generic drawer summaries and details omit these fields too.
- Live registration requests are sanitized before publishing the admin snapshot, as well as before caching. User list/detail repository projections and `mapFirestoreUserDoc()` already omit credentials.
- Login, registration, create, edit, and import flows still need transient PIN inputs or request payloads. Edit inputs use password masking and clear after save/cancel; existing credentials are never prefilled.
- Server verification, hashing, migration, Firestore rule restrictions, and credential test fixtures retain intentional references. Restore supports validated hashes in its write payload; these are excluded from admin list/detail state.
- Static demo PIN instructions remain public demo information.

## Credential writes fixed

`buildPinWritePatch()` now calls `/api/pin-hash` and returns only `{ pin: null, pinHash, pinUpdatedAt }`. Blank PIN edits return `{}`. Failed hashing or unsafe responses throw; there is no plaintext fallback. Registration, create, edit, and import use this helper.

The authenticated admin API independently hashes raw PIN inputs and rejects malformed hashes. Approval copies credentials from the stored registration request, hashing and clearing a legacy plaintext PIN atomically with approval. Registration rules reject plaintext `pin` and `confirmPin` writes.

Existing database records are not automatically migrated by this code change. Deploy the API/client and Firestore rules; audit and migrate historical plaintext records separately. No remote deployment or migration was performed during this fix.
