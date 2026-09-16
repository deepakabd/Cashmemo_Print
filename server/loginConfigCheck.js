import { existsSync } from "node:fs";

/**
 * Startup diagnostics for the login API.
 *
 * A missing service account used to surface only as a 503 at login time, which
 * gives no clue what to fix. This prints the exact problem (and the fix) when the
 * dev server boots, so it is caught before anyone tries to sign in.
 *
 * @param {(message: string) => void} log
 * @returns {{ ok: boolean, reason?: string }}
 */
export const checkLoginServiceConfig = (log = console.warn) => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error("missing client_email/private_key");
      }
      return { ok: true };
    } catch (error) {
      const reason = `FIREBASE_SERVICE_ACCOUNT is not valid JSON for a service account (${error.message}).`;
      log(`[login] ${reason}`);
      return { ok: false, reason };
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    if (!existsSync(credentialsPath)) {
      const reason = `GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist: ${credentialsPath}`;
      log(`[login] ${reason}`);
      return { ok: false, reason };
    }
    return { ok: true };
  }

  // On Cloud Functions / Cloud Run the platform provides credentials, so absence
  // of the env vars is only a problem for local development.
  if (
    process.env.K_SERVICE ||
    process.env.FUNCTION_TARGET ||
    process.env.GOOGLE_CLOUD_PROJECT
  ) {
    return { ok: true };
  }

  const reason = [
    "No Firebase Admin credentials configured, so dealer login will fail with 503.",
    "Fix: download a service account key for this Firebase",
    "     (Firebase Console -> Project Settings -> Service Accounts -> Generate new private key),",
    "     save it OUTSIDE the repo, then add to .env:",
    "       GOOGLE_APPLICATION_CREDENTIALS=C:\\path\\to\\service-account.json",
    `       FIREBASE_PROJECT_ID=${process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "<your-project-id>"}`,
  ].join("\n         ");

  log(`[login] ${reason}`);
  return { ok: false, reason };
};
