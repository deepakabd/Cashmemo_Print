export const USER_SESSION_STORAGE_KEY = 'cashmemoUserSession';
export const APPROVAL_REPLIES_STORAGE_KEY = 'approvalReplies';
export const ADMIN_AUDIT_COLLECTION = 'adminAuditTrail';
export const FILTER_PRESET_STORAGE_KEY_PREFIX = 'cashmemoFilterPresets_';
export const RECENT_ACTIVITY_STORAGE_KEY_PREFIX = 'cashmemoRecentActivity_';
export const USER_LAST_UPLOADED_DATA_LIMIT = 10;
export const ONBOARDING_TOUR_STORAGE_KEY_PREFIX = 'cashmemoOnboardingTourSeen_';
export const WORKSPACE_MODE_STORAGE_KEY_PREFIX = 'cashmemoWorkspaceMode_';
export const ANNOUNCEMENTS_STORAGE_KEY = 'cashmemoAnnouncements';

export const createDefaultAnnouncementDraft = () => ({
  title: '',
  message: '',
  targetScope: 'all',
  noticeType: 'notice',
  expiresAt: '',
});

export const getPlanUpgradeReplyStorageKey = ({ userId = '', dealerCode = '', dealerName = '' } = {}) => {
  const userKey = String(userId || dealerCode || dealerName || '').trim();
  return userKey ? `planUpgrade-${userKey}` : 'planUpgrade';
};

export const getOnboardingTourStorageKey = (dealerCode = '') => (
  `${ONBOARDING_TOUR_STORAGE_KEY_PREFIX}${String(dealerCode || 'guest').trim() || 'guest'}`
);

export const getWorkspaceModeStorageKey = (dealerCode = '') => (
  `${WORKSPACE_MODE_STORAGE_KEY_PREFIX}${String(dealerCode || 'guest').trim() || 'guest'}`
);

export const getRecentActivityStorageKey = (dealerCode = '') => (
  `${RECENT_ACTIVITY_STORAGE_KEY_PREFIX}${String(dealerCode || 'guest').trim() || 'guest'}`
);

export const getAnnouncementScopeLabel = (scope = 'all') => {
  const normalized = String(scope || 'all').toLowerCase();
  if (normalized === 'all') return 'All Users';
  if (normalized === 'active') return 'Active Users';
  if (normalized === 'expiring') return 'Expiring Soon';
  if (normalized === 'expired') return 'Expired Users';
  return scope;
};

export const sanitizeFilenamePart = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'all';

export const normalizeDealerCode = (value = '') => String(value || '').trim().toUpperCase();

export const findUsersByDealerCode = (users = [], dealerCode = '') => {
  const normalizedDealerCode = normalizeDealerCode(dealerCode);
  if (!normalizedDealerCode) return [];
  return (Array.isArray(users) ? users : []).filter((user) => (
    normalizeDealerCode(user?.dealerCode) === normalizedDealerCode
  ));
};

export const readImageFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!(file instanceof File)) {
    reject(new Error('Invalid file.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => reject(new Error('Image read failed.'));
  reader.readAsDataURL(file);
});