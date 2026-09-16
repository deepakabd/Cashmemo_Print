const ACCOUNT_STATUSES = new Set(['active', 'pending', 'disabled', 'expired']);

export const getUserAccountStatus = (user, now = Date.now()) => {
  const explicitStatus = String(user?.status || '').trim().toLowerCase();
  let status;
  if (ACCOUNT_STATUSES.has(explicitStatus)) {
    // Canonical writes supersede stale legacy flags (including approved).
    status = explicitStatus;
  } else if (user?.blocked === true || user?.disabled === true) {
    status = 'disabled';
  } else if (user?.approved === false) {
    status = 'pending';
  } else if (user?.expired === true) {
    status = 'expired';
  } else if (user?.active === true || user?.approved === true) {
    status = 'active';
  } else {
    status = 'pending';
  }

  // Expiry never overrides a disabled or unapproved account.
  if (status === 'active' && user?.validTill) {
    const expiresAt = new Date(user.validTill).getTime();
    if (Number.isFinite(expiresAt) && Number(now) > expiresAt) return 'expired';
  }
  return status;
};
