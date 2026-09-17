// Only supported account data is restored. Session identifiers, device access,
// pending approvals, legacy flags, plaintext PINs and deletion metadata are not.
const RESTORE_FIELDS = [
  'dealerCode', 'dealerName', 'name', 'mobile', 'email', 'package', 'packageDays',
  'validFrom', 'validTill', 'role', 'status', 'profileData', 'bankDetailsData',
  'ratesData', 'hindiHeaderData', 'cashMemoLabelSettings',
  'deliveryAreaUpdates', 'deliveryStaffUpdates', 'pinHash',
  'restoreCount', 'restoredBy', 'restoreReason',
];

export const buildAdminUserRestoreData = (record) => Object.fromEntries(
  RESTORE_FIELDS.filter((field) => Object.hasOwn(record, field) && record[field] !== undefined)
    .map((field) => [field, record[field]]),
);
