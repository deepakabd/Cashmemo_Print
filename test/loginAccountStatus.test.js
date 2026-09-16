import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), claims: vi.fn(), token: vi.fn().mockResolvedValue('token'),
}));
vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}], initializeApp: vi.fn(), cert: vi.fn(), applicationDefault: vi.fn(),
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({
  setCustomUserClaims: mocks.claims, createCustomToken: mocks.token,
}) }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({
  collection: () => ({ where: () => ({ limit: () => ({ get: mocks.get }) }) }),
}) }));
vi.mock('../server/pinCredentials.js', () => ({
  verifyPin: async () => ({ matches: true, legacy: false }), hashPin: vi.fn(), isHashedPin: vi.fn(),
}));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const login = async (data) => {
  vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
  mocks.get.mockResolvedValue({ size: 1, empty: false,
    docs: [{ id: 'user', data: () => ({ authUid: 'uid', ...data }) }],
  });
  const { verifyDealerLogin } = await import('../server/loginService.js');
  return verifyDealerLogin({ dealerCode: '123', pin: '1234' });
};

it('rejects a blocked legacy account even when approved', async () => {
  await expect(login({ blocked: true, approved: true })).rejects.toMatchObject({ code: 'disabled' });
  expect(mocks.token).not.toHaveBeenCalled();
});

it('sets expired claims for explicit expiry even without validTill', async () => {
  await login({ status: 'expired' });
  expect(mocks.claims).toHaveBeenCalledWith('uid', expect.objectContaining({ accountActive: false, planActive: false }));
});

it('honors canonical active status over stale approval and blocked flags', async () => {
  await login({ status: 'active', approved: false, blocked: true });
  expect(mocks.claims).toHaveBeenCalledWith('uid', expect.objectContaining({ accountActive: true, planActive: true }));
});
