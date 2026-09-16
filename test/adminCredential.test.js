import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAdminCredential } from '../server/adminCredential.js';

const directories = [];
const credentialFile = (value) => {
  const directory = mkdtempSync(join(tmpdir(), 'cashmemo-credential-test-'));
  directories.push(directory);
  const path = join(directory, 'credentials.json');
  writeFileSync(path, JSON.stringify(value));
  return path;
};
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })));

describe('Admin credential signing', () => {
  it('uses a service account file for local signing instead of IAM', () => {
    const account = { type: 'service_account', private_key: 'test-key', client_email: 'test@example.com' };
    const sdk = { cert: vi.fn(() => 'local-signer'), applicationDefault: vi.fn() };
    expect(resolveAdminCredential(sdk, { GOOGLE_APPLICATION_CREDENTIALS: credentialFile(account) })).toBe('local-signer');
    expect(sdk.cert).toHaveBeenCalledWith(account);
    expect(sdk.applicationDefault).not.toHaveBeenCalled();
  });

  it('prefers inline credentials over a file', () => {
    const account = { type: 'service_account' };
    const sdk = { cert: vi.fn(() => 'inline'), applicationDefault: vi.fn() };
    expect(resolveAdminCredential(sdk, { FIREBASE_SERVICE_ACCOUNT: JSON.stringify(account), GOOGLE_APPLICATION_CREDENTIALS: 'missing.json' })).toBe('inline');
  });

  it('preserves default credentials for other file types and managed runtimes', () => {
    const sdk = { cert: vi.fn(), applicationDefault: vi.fn(() => 'adc') };
    expect(resolveAdminCredential(sdk, { GOOGLE_APPLICATION_CREDENTIALS: credentialFile({ type: 'authorized_user' }) })).toBe('adc');
    expect(resolveAdminCredential(sdk, {})).toBe('adc');
    expect(sdk.cert).not.toHaveBeenCalled();
  });
});
