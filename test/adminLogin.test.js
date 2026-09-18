import { expect, it, vi } from 'vitest';
vi.mock('../src/auth/userAuth', () => ({ adminSignIn: vi.fn(), adminSignOut: vi.fn() }));
import { adminSignIn as signIn, adminSignOut } from '../src/auth/userAuth';
import { adminSignIn } from '../src/auth/adminAuth';

it('accepts the fresh sign-in admin claim without a forced refresh', async () => {
  const credential = { user: { getIdTokenResult: vi.fn().mockResolvedValue({ claims: { role: 'admin' } }) } };
  signIn.mockResolvedValue(credential);
  await expect(adminSignIn('admin@example.com', 'test')).resolves.toBe(credential);
  expect(credential.user.getIdTokenResult).toHaveBeenCalledOnce();
  expect(credential.user.getIdTokenResult).toHaveBeenCalledWith();
});

it('refreshes missing claims once to support a recently assigned admin role', async () => {
  const getIdTokenResult = vi.fn().mockResolvedValueOnce({ claims: {} })
    .mockResolvedValueOnce({ claims: { role: 'admin' } });
  const credential = { user: { getIdTokenResult } };
  signIn.mockResolvedValue(credential);
  await expect(adminSignIn('admin@example.com', 'test')).resolves.toBe(credential);
  expect(getIdTokenResult).toHaveBeenNthCalledWith(2, true);
});

it('signs out an account without the required admin claim', async () => {
  signIn.mockResolvedValue({ user: { getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }) } });
  adminSignOut.mockResolvedValue();
  await expect(adminSignIn('user@example.com', 'test')).rejects.toMatchObject({ code: 'auth/admin-role-required' });
  expect(adminSignOut).toHaveBeenCalled();
});
