# Admin user mutation path

Admin user create, partial update, dealer-code rename, registration approval/rejection, restore, delete, approval reply, and dictionary completion use `adminUserRepository` → `POST /api/admin-users` → verified admin token → server validation → Admin SDK transaction.

Partial updates omit `dealerCode` when unchanged. The server requires an existing user and applies field paths with transaction `update`, preserving unrelated nested fields. Account configuration and its singleton subdocument copies commit together. Renames retain the existing uniqueness reservations. Timestamps and rate counts are generated on the server.

`adminUserValidation.js` checks account field types, mobile format, supported packages, roles/statuses, and supported dotted approval field paths for both full and partial writes. Dictionary matching runs on the server with stable approval/client request IDs, preserving the missing-user guard and atomic reply/completion writes.

Direct dealer self-service writes remain separate from admin mutations. `firestore.rules` denies client-side admin writes/deletes to user documents and configuration subdocuments, so modifying the browser code cannot bypass the API. Admin SDK server writes bypass client rules as intended.

Deploy the API/client changes and updated Firestore rules together. Rules have been edited locally; they are not published automatically. The existing Firebase Admin credentials and admin role claims are still required.

Confirmed registration actions update the pending queue immediately and remain completed during stale or failed refreshes. Rejection persists the real request document and its audit atomically, regardless of ID prefix. Legacy Demo/Basic packages are accepted only when approving a stored registration with that exact package; new user writes retain current package validation.

Scope: this centralizes user mutations. Shared dictionary content, standalone audit events, registration submissions, and standalone approval-document maintenance retain their existing paths. The plaintext credential persistence finding recorded in `ADMIN_PIN_AUDIT.md` remains separate.

Transaction behavior follows [Firestore transactions documentation](https://firebase.google.com/docs/firestore/manage-data/transactions).
