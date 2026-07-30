export const sanitizeUserForCache = (user = {}) => {
  if (!user || typeof user !== 'object') return user;
  const nextUser = { ...user };
  delete nextUser.pin;
  return nextUser;
};

export const sanitizeUsersForCache = (users = []) => (
  Array.isArray(users) ? users.map((user) => sanitizeUserForCache(user)) : []
);

export const maskSecret = (value = '', visibleCount = 0) => {
  const text = String(value || '').trim();
  if (!text) return 'Not stored';
  const safeVisibleCount = Math.max(0, Number(visibleCount) || 0);
  const maskedLength = Math.max(0, text.length - safeVisibleCount);
  return `${'*'.repeat(maskedLength)}${text.slice(-safeVisibleCount)}`;
};

export const toTagList = (value = '') => (
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

export const upsertStatusHistoryEntry = (history = [], entry = {}) => {
  const nextHistory = Array.isArray(history) ? [...history] : [];
  const entryKey = String(entry.key || '').trim();
  if (!entryKey) return nextHistory;
  const existingIndex = nextHistory.findIndex((item) => item?.key === entryKey);
  if (existingIndex >= 0) {
    nextHistory[existingIndex] = { ...nextHistory[existingIndex], ...entry };
  } else {
    nextHistory.push(entry);
  }
  return nextHistory;
};

export const getFeedbackSlaDaysValue = (item) => {
  const createdAt = item?.createdAt || item?.date || '';
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
};

export const getDrawerSummaryRows = ({
  drawer = {},
  users = [],
  formatDisplayDate = (value) => value || '-',
  formatDisplayDateTime = (value) => value || '-',
} = {}) => {
  const data = drawer?.data || {};
  if (drawer?.type === 'detail' && /^User - /.test(drawer?.title || '')) {
    const pendingUpdates = Object.entries(data?.pendingUpdates || {})
      .filter(([, value]) => String(value?.status || '').toLowerCase() === 'pending')
      .length;
    const feedbackEntries = Array.isArray(data?.feedbackEntries) ? data.feedbackEntries.length : 0;
    return [
      { label: 'Dealer Code', value: data?.dealerCode || '-' },
      { label: 'Role', value: data?.role || '-' },
      { label: 'Status', value: data?.status || '-' },
      { label: 'Package', value: data?.package || '-' },
      { label: 'Valid Till', value: formatDisplayDate(data?.validTill) },
      { label: 'Pending Requests', value: pendingUpdates || 0 },
      { label: 'Dictionary Queue', value: Number(data?.dictionaryPendingCount || 0) },
      { label: 'Support Messages', value: feedbackEntries },
    ];
  }
  if (drawer?.type === 'approval') {
    return [
      { label: 'Dealer Code', value: drawer?.dealerCode || data?.dealerCode || '-' },
      { label: 'Request Type', value: drawer?.typeLabel || drawer?.approvalType || drawer?.rawType || '-' },
      { label: 'Requested At', value: formatDisplayDateTime(drawer?.requestedAt || data?.requestedAt) },
      { label: 'Existing Users', value: users.filter((user) => String(user?.dealerCode || '').trim() === String(drawer?.dealerCode || '').trim()).length },
    ];
  }
  if (drawer?.type === 'request') {
    return [
      { label: 'Dealer Code', value: data?.dealerCode || '-' },
      { label: 'Dealer Name', value: data?.dealerName || '-' },
      { label: 'Package', value: data?.package || '-' },
      { label: 'Requested At', value: formatDisplayDateTime(data?.createdAt || data?.approvedAt) },
    ];
  }
  return Object.entries(data || {})
    .slice(0, 8)
    .map(([label, value]) => ({
      label,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value || '-'),
    }));
};

export const formatDrawerFieldLabel = (label = '') => (
  String(label || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

export const formatDrawerFieldValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === 'object') return 'Available';
  return String(value);
};

export const getDrawerDetailSections = (data = {}) => {
  const entries = Object.entries(data || {});
  const hiddenKeys = new Set(['approvalStatus', 'profileData', 'bankDetailsData', 'ratesData', 'hindiHeaderData', 'pendingUpdates', 'lastUploadedData']);
  const simpleFields = [];
  const groupedFields = [];
  const listFields = [];

  entries.forEach(([key, value]) => {
    if (hiddenKeys.has(key)) return;
    if (Array.isArray(value)) {
      listFields.push({ key, value });
      return;
    }
    if (value && typeof value === 'object') {
      groupedFields.push({ key, value });
      return;
    }
    simpleFields.push({ key, value });
  });

  return {
    simpleFields,
    groupedFields,
    listFields,
  };
};

const USER_DEVICE_STORAGE_KEY = 'cashmemoDeviceId';

const createBrowserDeviceId = () => {
  const randomPart = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `device-${randomPart}`;
};

const getCurrentDeviceId = () => {
  try {
    const savedId = localStorage.getItem(USER_DEVICE_STORAGE_KEY);
    if (savedId) return savedId;
    const nextId = createBrowserDeviceId();
    localStorage.setItem(USER_DEVICE_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return createBrowserDeviceId();
  }
};

export const getCurrentDeviceInfo = () => {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const screenInfo = typeof window !== 'undefined' && window.screen
    ? `${window.screen.width || 0}x${window.screen.height || 0}`
    : 'unknown-screen';
  const userAgent = String(nav.userAgent || 'Unknown browser');
  const platform = String(nav.platform || 'Unknown platform');
  const browserName = userAgent.includes('Edg/')
    ? 'Microsoft Edge'
    : userAgent.includes('Chrome/')
      ? 'Chrome'
      : userAgent.includes('Firefox/')
        ? 'Firefox'
        : userAgent.includes('Safari/')
          ? 'Safari'
          : 'Browser';

  return {
    deviceId: getCurrentDeviceId(),
    deviceName: `${browserName} on ${platform}`,
    browser: browserName,
    platform,
    screen: screenInfo,
    userAgent,
  };
};

export const normalizeLoginDevices = (devices = []) => (
  Array.isArray(devices)
    ? devices
      .filter((device) => device && typeof device === 'object')
      .map((device) => ({
        deviceId: String(device.deviceId || device.id || '').trim(),
        deviceName: String(device.deviceName || device.name || 'Unknown device').trim(),
        browser: String(device.browser || '').trim(),
        platform: String(device.platform || '').trim(),
        screen: String(device.screen || '').trim(),
        userAgent: String(device.userAgent || '').trim(),
        firstLoginAt: device.firstLoginAt || device.lastLoginAt || '',
        lastLoginAt: device.lastLoginAt || device.firstLoginAt || '',
        blocked: Boolean(device.blocked),
        blockedAt: device.blockedAt || '',
        unblockedAt: device.unblockedAt || '',
      }))
      .filter((device) => device.deviceId)
    : []
);

export const upsertLoginDevice = (devices = [], deviceInfo = {}, loggedInAt = new Date().toISOString()) => {
  const normalizedDevices = normalizeLoginDevices(devices);
  const deviceId = String(deviceInfo.deviceId || '').trim();
  if (!deviceId) return normalizedDevices;
  const existingDevice = normalizedDevices.find((device) => device.deviceId === deviceId);
  const nextDevice = {
    ...(existingDevice || {}),
    ...deviceInfo,
    deviceId,
    firstLoginAt: existingDevice?.firstLoginAt || loggedInAt,
    lastLoginAt: loggedInAt,
    blocked: Boolean(existingDevice?.blocked),
  };
  return [
    nextDevice,
    ...normalizedDevices.filter((device) => device.deviceId !== deviceId),
  ].slice(0, 12);
};

export const getDeviceStatusLabel = (device = {}) => (device.blocked ? 'Blocked' : 'Allowed');
