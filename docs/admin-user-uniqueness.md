# Admin user writes

Manual creation, registration approval, import, dealer-code edits and recycle-bin
restore use `POST /api/admin-users`. The endpoint verifies a Firebase ID token,
including revocation, and requires the `admin` custom claim.

The server normalizes dealer codes with trim/uppercase. A transaction reads
`dealerCodeReservations/{sha256(code)}`, queries `users` for that dealer code,
and writes the reservation and user together. This detects existing users even
without a reservation. Concurrent writes share the reservation document and
must retry rather than creating separate users. Existing duplicate codes are
rejected and require admin cleanup; records are never silently deleted.

Editing a dealer code releases its old reservation in the same transaction.
Deleted owners leave a reservation that can be reclaimed after the transaction
checks that the owner no longer exists. Approval updates the existing matching
user while preserving its role. A rejected edit or restore never succeeds locally.

Deploy the application/API and `firestore.rules` together. The rules deny direct
client user creation and dealer-code changes, preventing bypass of the endpoint.
The endpoint uses the existing Firebase Admin service-account configuration.
The Vite development server mounts the same handler.

Tests exercise legacy collisions, transaction retries for concurrent creates,
renames, restore collisions and authorization using an in-memory transaction
harness. Production Firestore and rule deployment have not been exercised.
