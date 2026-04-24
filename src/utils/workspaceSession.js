const WORKSPACE_SESSION_STORAGE_KEY_PREFIX = 'cashmemoWorkspaceSession:';

export const getWorkspaceSessionStorageKey = (dealerCode = '') => (
  `${WORKSPACE_SESSION_STORAGE_KEY_PREFIX}${String(dealerCode || 'guest').trim() || 'guest'}`
);

export const readWorkspaceSession = (dealerCode = '') => {
  try {
    const raw = localStorage.getItem(getWorkspaceSessionStorageKey(dealerCode));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const writeWorkspaceSession = (dealerCode = '', session = {}) => {
  try {
    localStorage.setItem(
      getWorkspaceSessionStorageKey(dealerCode),
      JSON.stringify(session && typeof session === 'object' ? session : {}),
    );
    return true;
  } catch {
    return false;
  }
};
