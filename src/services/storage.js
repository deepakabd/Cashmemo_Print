import { sanitizeUsersForCache } from "../utils/adminUiHelpers";
import { USER_SESSION_STORAGE_KEY } from "../utils/storageHelpers";

const USERS_CACHE_KEY = "usersData";

export const readUsersCache = () => {
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeUsersCache = (users) => {
  try {
    localStorage.setItem(
      USERS_CACHE_KEY,
      JSON.stringify(sanitizeUsersForCache(users)),
    );
  } catch {
    // cache write is best effort
  }
};

export const persistUserSession = (user) => {
  if (!user) return;
  try {
    localStorage.setItem(
      USER_SESSION_STORAGE_KEY,
      JSON.stringify({
        id: user.id || "",
        dealerCode: user.dealerCode || "",
      }),
    );
  } catch {
    // best effort
  }
};

export const clearUserSession = () => {
  localStorage.removeItem(USER_SESSION_STORAGE_KEY);
};

export const readStoredSession = () => {
  try {
    const raw = localStorage.getItem(USER_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
