import { expect, it, vi } from 'vitest';
import { mapAdminUserList, mapAdminUserDetail } from '../src/services/adminUserRepository';
import { getDrawerDetailSections, getDrawerSummaryRows, sanitizeUserForCache } from '../src/utils/adminUiHelpers';

vi.mock('../src/firebase', () => ({ auth: {}, db: {} }));

const credentials = { pin: 'secret-pin', pinHash: 'secret-hash', confirmPin: 'secret-confirmation' };

it('excludes credentials from the production admin list and detail projections', () => {
  const source = { id: 'dealer', dealerCode: '123', status: 'active', ...credentials };
  for (const project of [mapAdminUserList, mapAdminUserDetail]) {
    const user = project(source);
    expect(user).toMatchObject({ id: 'dealer', dealerCode: '123', status: 'active' });
    for (const field of Object.keys(credentials)) expect(user).not.toHaveProperty(field);
  }
});

it('removes credentials from caches and generic drawer fields without mutating the source', () => {
  const user = { dealerCode: '123', ...credentials };
  expect(sanitizeUserForCache(user)).toEqual({ dealerCode: '123' });
  expect(getDrawerDetailSections(user).simpleFields).toEqual([{ key: 'dealerCode', value: '123' }]);
  expect(getDrawerSummaryRows({ drawer: { data: user } })).toEqual([{ label: 'dealerCode', value: '123' }]);
  expect(user).toEqual({ dealerCode: '123', ...credentials });
});
