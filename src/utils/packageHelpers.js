import { HINDI_ENTERPRISE_PACKAGE_NAMES, PACKAGE_PRICING } from './appConfig';

export const getPackageValidityDays = (packageName = '') => {
  const normalized = String(packageName || '').toLowerCase();
  if (
    normalized.includes('enterprise package with (हिंदी)')
  ) return 365;
  if (normalized.includes('premium')) return 30;
  if (normalized.includes('enterprise')) return 365;
  return 0;
};

export const isHindiEnterprisePackage = (packageName = '') => HINDI_ENTERPRISE_PACKAGE_NAMES.includes(packageName);

export const computeValidityDates = (packageName = '', baseDate = new Date()) => {
  const days = getPackageValidityDays(packageName);
  const validFrom = new Date(baseDate);
  const validTill = new Date(baseDate);
  if (days > 0) {
    validTill.setDate(validTill.getDate() + days);
  }
  return {
    packageDays: days,
    validFrom: validFrom.toISOString(),
    validTill: validTill.toISOString(),
  };
};

export const isUserExpired = (user) => {
  const validTillRaw = user?.validTill;
  if (!validTillRaw) return false;
  const validTillDate = new Date(validTillRaw);
  if (Number.isNaN(validTillDate.getTime())) return false;
  return new Date().getTime() > validTillDate.getTime();
};

export const formatPackageNameForNavbar = (packageName = '') => {
  const name = String(packageName || '')
    .trim();
  if (!name) return 'N/A';
  return name.replace(/\s*-\s*\d+\s*Days?\s*$/i, '').trim();
};

export const formatPackageOptionLabel = (packageName = '') => {
  const days = getPackageValidityDays(packageName);
  const validityText = days > 0 ? `${days} ${days === 1 ? 'Day' : 'Days'}` : 'N/A';
  return `${formatPackageNameForNavbar(packageName)} - ${PACKAGE_PRICING[packageName] || '-'} - Validity: ${validityText}`;
};