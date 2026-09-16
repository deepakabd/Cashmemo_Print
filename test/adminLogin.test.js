import { expect, it, vi } from 'vitest';
vi.mock('../src/auth/userAuth', () => ({ adminSignIn: vi.fn(), adminSignOut: vi.fn() }));
import { adminSignIn as signIn, adminSignOut } from '../src/auth/userAuth';
import { adminSignIn } from '../src/auth/adminAuth';

it('refreshes claims before accepting an admin session', async () => {
  const credential = { user: { getIdTokenResult: vi.fn().mockResolvedValue({ claims: { role: 'admin' } }) } };
  signIn.mockResolvedValue(credential);
  await expect(adminSignIn('admin@example.com', 'test')).resolves.toBe(credential);
  expect(credential.user.getIdTokenResult).toHaveBeenCalledWith(true);
});

it('signs out an account without the required admin claim', async () => {
  signIn.mockResolvedValue({ user: { getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }) } });
  adminSignOut.mockResolvedValue();
  await expect(adminSignIn('user@example.com', 'test')).rejects.toMatchObject({ code: 'auth/admin-role-required' });
  expect(adminSignOut).toHaveBeenCalled();
});
