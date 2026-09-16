import { readFileSync } from 'node:fs';

// Explicit service-account credentials let the SDK sign custom tokens locally.
// applicationDefault() uses IAM signing, even when its file contains a key.
export const resolveAdminCredential = ({ cert, applicationDefault }, env = process.env) => {
  if (env.FIREBASE_SERVICE_ACCOUNT) {
    return cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT));
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credentials = JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    if (credentials.type === 'service_account') return cert(credentials);
  }
  // Preserve ADC for managed runtimes and other credential file types.
  return applicationDefault();
};
