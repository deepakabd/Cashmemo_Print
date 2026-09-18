export const sanitizeUserForCache = (user = {}) => {
  if (!user || typeof user !== 'object') return user;
  const nextUser = { ...user };
  delete nextUser.pin;
  delete nextUser.pinHash;
  delete nextUser.confirmPin;
  delete nextUser.approved;
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
    return [
      { label: 'Dealer Code', value: data?.dealerCode || '-' },
      { label: 'Role', value: data?.role || '-' },
      { label: 'Status', value: data?.status || '-' },
      { label: 'Package', value: data?.package || '-' },
      { label: 'Valid Till', value: formatDisplayDate(data?.validTill) },
      { label: 'Pending Requests', value: pendingUpdates || 0 },
      { label: 'Dictionary Queue', value: Number(data?.dictionaryPendingCount || 0) },
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
  return Object.entries(sanitizeUserForCache(data))
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
  const entries = Object.entries(sanitizeUserForCache(data));
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

// DEVICE IDENTITY — CONVENIENCE ONLY, NOT A SECURITY BOUNDARY.
//
// deviceId ek localStorage-persisted random UUID hai. Ye:
//   - localStorage clear karne se turant regenerate ho jata hai (naya device ban jata hai)
//   - browser profile copy/clone par duplicate ho jata hai
//   - client-supplied hai, cryptographically trustworthy nahi
//
// USE CASE: admin panel me "is browser ko block/unblock karo" (abuse
// management, incident response convenience).
// NOT A USE CASE: "ye cryptographically trusted device hai" — uske liye
// App Check / Play Integrity / WebAuthn jaisa mechanism chahiye.
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

export const getLoginDeviceName = (device = {}) => {
  const savedName = String(device.deviceName || device.name || '').trim();
  if (savedName && savedName !== 'Unknown device' && !/ on /i.test(savedName)) return savedName;
  if (device.model) return String(device.model).trim();
  const ua = String(device.userAgent || '');
  const platform = String(device.platform || '');
  if (/iPad/i.test(ua) || (/Mac/i.test(platform) && device.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/Android/i.test(`${ua} ${platform}`)) {
    const model = ua.match(/Android[^;)]*;\s*(?:[a-z]{2}[-_][A-Z]{2};\s*)?([^;)]+?)(?:\s+Build\/[^;)]*)?\)/)?.[1]?.trim();
    if (model && model !== 'K') return model;
    return /Mobile/i.test(ua) || device.mobile ? 'Android Phone' : 'Android Device';
  }
  if (/Win/i.test(`${ua} ${platform}`)) return 'Windows PC';
  if (/CrOS/i.test(ua)) return 'Chromebook';
  if (/Mac/i.test(`${ua} ${platform}`)) return 'Mac';
  if (/Linux/i.test(`${ua} ${platform}`)) return 'Linux PC';
  return savedName || 'Unknown device';
};

export const getCurrentDeviceInfo = async () => {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  let hints = {};
  let hintsTimeout;
  try {
    if (nav.userAgentData?.getHighEntropyValues) {
      hints = await Promise.race([
        nav.userAgentData.getHighEntropyValues(['model']),
        new Promise((resolve) => { hintsTimeout = setTimeout(() => resolve({}), 700); }),
      ]);
    }
  } catch {
    // Fall back to the available platform when model hints are unavailable.
  } finally {
    clearTimeout(hintsTimeout);
  }
  const screenInfo = typeof window !== 'undefined' && window.screen
    ? `${window.screen.width || 0}x${window.screen.height || 0}`
    : 'unknown-screen';
  const userAgent = String(nav.userAgent || 'Unknown browser');
  const platform = String(hints.platform || nav.userAgentData?.platform || nav.platform || 'Unknown platform');
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
    deviceName: getLoginDeviceName({ userAgent, platform, model: hints.model, mobile: nav.userAgentData?.mobile, maxTouchPoints: nav.maxTouchPoints }),
    model: String(hints.model || ''),
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
        deviceName: getLoginDeviceName(device),
        model: String(device.model || '').trim(),
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
