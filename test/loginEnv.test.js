import { afterEach, expect, it, vi } from 'vitest';

vi.mock('vite', () => ({
  defineConfig: (config) => config,
  loadEnv: () => ({
    GOOGLE_APPLICATION_CREDENTIALS: '/private/service-account.json',
    FIREBASE_PROJECT_ID: 'test-project',
    GOOGLE_CLOUD_API_KEY: 'unrelated-secret',
  }),
}));

import configureVite from '../vite.config.js';

afterEach(() => vi.unstubAllEnvs());

it('makes .env Admin credentials available to the login server only', () => {
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', undefined);
  vi.stubEnv('FIREBASE_PROJECT_ID', undefined);
  vi.stubEnv('GOOGLE_CLOUD_API_KEY', undefined);

  const config = configureVite({ mode: 'development' });

  expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe('/private/service-account.json');
  expect(process.env.FIREBASE_PROJECT_ID).toBe('test-project');
  expect(process.env.GOOGLE_CLOUD_API_KEY).toBeUndefined();
  expect(config.define).toBeUndefined();
});

it('preserves credentials supplied by the server environment', () => {
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '/deployment/credentials.json');
  vi.stubEnv('FIREBASE_PROJECT_ID', 'deployment-project');

  configureVite({ mode: 'development' });

  expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe('/deployment/credentials.json');
  expect(process.env.FIREBASE_PROJECT_ID).toBe('deployment-project');
});
