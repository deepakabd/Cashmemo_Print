import { LoginError } from './loginService.js';
import { PACKAGE_OPTIONS } from '../src/utils/appConfig.js';

const invalid = (message) => { throw new LoginError('invalid-input', message, 400); };
export const LEGACY_REGISTRATION_PACKAGES = { 'Demo Package - 1 Day': 1, 'Basic Package - 7 Days': 7 };
export const validateAdminUserPatch = (patch, { legacyRegistration = false } = {}) => {
  for (const key of Object.keys(patch)) {
    if (key.includes('.') && !/^pendingUpdates\.[A-Za-z]+\.(status|approvedAt|rejectedAt|adminReply|adminReplyAt)$/.test(key)) {
      invalid(`Unsupported user field path: ${key}`);
    }
  }
  for (const field of ['dealerCode', 'dealerName', 'name', 'mobile', 'email', 'package', 'role', 'status']) {
    if (Object.hasOwn(patch, field) && typeof patch[field] !== 'string') invalid(`${field} must be a string.`);
  }
  if (patch.mobile && !/^\d{10}$/.test(patch.mobile)) invalid('Mobile must be 10 digits.');
  if (Object.hasOwn(patch, 'package') && !PACKAGE_OPTIONS.includes(patch.package)
      && !(legacyRegistration && Object.hasOwn(LEGACY_REGISTRATION_PACKAGES, patch.package))) invalid('Invalid package.');
  if (Object.hasOwn(patch, 'status') && !['active', 'disabled', 'expired', 'pending'].includes(patch.status)) invalid('Invalid account status.');
  if (Object.hasOwn(patch, 'role') && !['operator', 'viewer', 'manager', 'admin'].includes(patch.role)) invalid('Invalid user role.');
  for (const field of ['ratesData', 'loginDevices', 'pendingDictionaryRequests', 'deliveryAreaUpdates', 'deliveryStaffUpdates']) {
    if (Object.hasOwn(patch, field) && !Array.isArray(patch[field])) invalid(`${field} must be an array.`);
  }
  for (const field of ['profileData', 'bankDetailsData', 'hindiHeaderData', 'approvalStatus', 'cashMemoLabelSettings', 'userAccess']) {
    if (Object.hasOwn(patch, field) && (!patch[field] || typeof patch[field] !== 'object' || Array.isArray(patch[field]))) invalid(`${field} must be an object.`);
  }
  if (Object.hasOwn(patch, 'packageDays') && (!Number.isInteger(patch.packageDays) || patch.packageDays < 0)) invalid('Invalid package duration.');
};
