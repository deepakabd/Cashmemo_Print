const ACCOUNT_STATUSES = new Set(['active', 'pending', 'disabled', 'expired']);

export const getUserAccountStatus = (user, now = Date.now()) => {
  const explicitStatus = String(user?.status || '').trim().toLowerCase();
  // Account state comes exclusively from status. Missing/invalid state
  // requires admin approval; retired boolean flags cannot grant access.
  const status = ACCOUNT_STATUSES.has(explicitStatus) ? explicitStatus : 'pending';

  // Expiry never overrides a disabled or pending account.
  if (status === 'active' && user?.validTill) {
    const expiresAt = new Date(user.validTill).getTime();
    if (Number.isFinite(expiresAt) && Number(now) > expiresAt) return 'expired';
  }
  return status;
};
