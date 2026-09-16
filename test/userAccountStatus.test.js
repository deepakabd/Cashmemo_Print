import { describe, expect, it } from 'vitest';
import { getUserAccountStatus } from '../src/utils/userAccountStatus';
import { getAccessState } from '../src/app/permissions';
import { getAdminUserStatistics } from '../src/services/adminUserRepository';

const now = Date.parse('2026-09-16T12:00:00Z');
const past = '2026-09-15T12:00:00Z';
const future = '2099-09-17T12:00:00Z';

describe('canonical account status', () => {
  it.each(['active', 'pending', 'disabled', 'expired'])('prioritizes %s over contradictory legacy flags', (status) => {
    expect(getUserAccountStatus({ status, active: true, approved: false,
      blocked: true, disabled: true, expired: true, validTill: future }, now)).toBe(status);
  });

  it('does not consider a status-only active user pending', () => {
    expect(getUserAccountStatus({ status: 'active' }, now)).toBe('active');
    expect(getUserAccountStatus({ status: ' ACTIVE ' }, now)).toBe('active');
  });

  it.each([
    [{ blocked: true, active: true, approved: true }, 'pending'],
    [{ disabled: true, expired: true }, 'pending'],
    [{ approved: false, active: true, expired: true }, 'pending'],
    [{ expired: true, approved: true }, 'pending'],
    [{ active: true }, 'pending'],
    [{ approved: true }, 'pending'],
    [{}, 'pending'],
    [null, 'pending'],
    [{ status: 'unknown' }, 'pending'],
    [{ blocked: 'false', expired: 'false' }, 'pending'],
  ])('handles legacy records %j as %s', (user, expected) => {
    expect(getUserAccountStatus(user, now)).toBe(expected);
  });

  it('expires active accounts by validity without overriding disabled or pending', () => {
    expect(getUserAccountStatus({ status: 'active', validTill: past }, now)).toBe('expired');
    expect(getUserAccountStatus({ status: 'active', validTill: 'invalid' }, now)).toBe('active');
    expect(getUserAccountStatus({ status: 'active', validTill: new Date(now).toISOString() }, now)).toBe('active');
    for (const status of ['disabled', 'pending']) {
      expect(getUserAccountStatus({ status, validTill: past }, now)).toBe(status);
    }
  });

  it('keeps update approval workflows separate from account status', () => {
    expect(getUserAccountStatus({ status: 'active', approvalStatus: { profile: 'pending' },
      pendingUpdates: { profile: { status: 'pending' } } }, now)).toBe('active');
  });

  it('uses the same mutually exclusive status for counters and access', () => {
    const users = [
      { id: 'active', status: 'active', approved: false, blocked: true },
      { id: 'disabled', status: 'disabled', approved: true },
      { id: 'pending', status: 'pending', approved: true },
      { id: 'expired', status: 'active', validTill: past },
    ];
    expect(getAdminUserStatistics(users).byStatus).toEqual({ active: 1, disabled: 1, pending: 1, expired: 1 });
    for (const user of users) {
      const access = getAccessState(user, { isLoggedIn: true, hasWorkingData: true });
      expect(access.status).toBe(getUserAccountStatus(user));
      expect(access.canUpload).toBe(access.status === 'active');
      expect(access.canPrint).toBe(access.status === 'active');
    }
  });
});
