# PIN Security Migration

## What was wrong

The PIN was stored as a **plaintext `pin` field** on each Firestore `users`
document and compared **in the browser**:

```js
// OLD — src/auth/userAuth.js
if (String(docData?.pin || "") === pin) {
  /* logged in */
}
```

Three consequences:

1. Anyone able to read `users` could dump every PIN.
2. The registration form queried `users` **unauthenticated** to detect duplicate
   dealer codes, so the collection was publicly enumerable.
3. The verification logic shipped inside the JS bundle and could be bypassed.

Worse, user login never established a Firebase Auth session at all — it just set
a React flag. So `request.auth` was always `null` for dealers, which made
Firestore Security Rules impossible to use as a real boundary.

## What it looks like now

```
Browser (dealerCode + PIN)
   ↓  POST /api/login
Trusted layer: scrypt comparison against `pinHash`
   ↓  status / expiry checks
Firebase custom token (claims: dealerCode, role, accountActive, planActive)
   ↓  signInWithCustomToken
Real Firebase Auth session
   ↓
Firestore Security Rules (enforce the claims)
```

- The PIN is stored as a **scrypt hash** (`scrypt$N$r$p$salt$hash`).
- The plaintext `pin` field is **never written** by any code path.
- Verification happens on the trusted layer only.
- Login now produces a real Auth session, so rules can be enforced.

## Files

| File                           | Role                                                     |
| ------------------------------ | -------------------------------------------------------- |
| `server/pinCredentials.js`     | scrypt `hashPin` / `verifyPin` (server only)             |
| `server/loginService.js`       | dealer lookup → verify → mint custom token               |
| `server/pinAdmin.js`           | builds the hashed patch for PIN writes                   |
| `api/login.js`                 | `POST /api/login` (rate-limited)                         |
| `api/pin-hash.js`              | `POST /api/pin-hash` (client asks for a hash to persist) |
| `firestore.rules`              | the actual security boundary                             |
| `scripts/migratePinHashes.mjs` | clears legacy plaintext PINs                             |

## Deploy steps

1. **Install the server dependency** (not a client dependency):

   ```bash
   npm install firebase-admin --save-optional
   ```

2. **Provide the service account** — one of:

   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   # or
   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   ```

   Get the key from **Firebase Console → Project Settings → Service Accounts →
   Generate new private key**, for the project in `VITE_FIREBASE_PROJECT_ID`.
   Save it **outside** the repo (it is in `.gitignore` as a safety net).

   Without it, `/api/login` returns `503 server-not-configured` and login fails
   **closed** (users cannot sign in but nothing is exposed).

   The dev server prints the exact fix at boot if this is missing — see
   `server/loginConfigCheck.js`. Note that `gcloud auth application-default login`
   only works if that account has Admin access to *this* project.

3. **Mark admins with a custom claim.** Admin status is read from the token, not
   from the client:

   ```js
   await admin.auth().setCustomUserClaims(uid, { role: "admin" });
   ```

4. **Deploy the rules:**

   ```bash
   firebase deploy --only firestore:rules
   ```

5. **Migrate legacy accounts** (dry-run first):

   ```bash
   node scripts/migratePinHashes.mjs --dry-run
   node scripts/migratePinHashes.mjs --apply
   ```

   A plaintext PIN cannot be converted to a hash, so those accounts are cleared
   and flagged `pinResetRequired` — issue new PINs for them.

## Rolling back

`git revert` the commit and redeploy rules. Note the migrated PINs are hashes;
reverting the app without reverting the migration leaves accounts that expect a
re-issued PIN.

## Still open

- **Admin auth** is still Firebase Auth email/password with no role check beyond
  the custom claim. Confirm every admin account has `role: 'admin'` before
  deploying the rules, or admins will lose access.
- **`registerLoginDevice`** remains a client-side convenience check (see its
  comment in `src/auth/userAuth.js`); it is not a security boundary.
