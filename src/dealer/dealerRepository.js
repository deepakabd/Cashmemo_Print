import { normalizeDealerCode } from "../utils/storageHelpers";
import {
  mergeCashMemoLabelSettings,
  getCashMemoLabelSettingsStorageKey,
} from "../utils/cashmemoHelpers";
import { readUsersCache, writeUsersCache } from "../services/storage";

export const mergeDealerIntoCache = (firestoreUser) => {
  const users = readUsersCache();
  const normalizedCode = normalizeDealerCode(firestoreUser?.dealerCode);
  const existingIdx = users.findIndex(
    (u) => normalizeDealerCode(u?.dealerCode) === normalizedCode,
  );
  const localUser =
    existingIdx >= 0
      ? { ...users[existingIdx], ...firestoreUser, id: firestoreUser.id }
      : {
          ...firestoreUser,
          id: firestoreUser.id,
          createdAt: new Date().toISOString(),
        };
  if (existingIdx >= 0) {
    users[existingIdx] = localUser;
  } else {
    users.push(localUser);
  }
  writeUsersCache(users);
  return localUser;
};

export const mergeDealerLabelSettings = (
  firestoreUser,
  setCashMemoLabelSettings,
) => {
  let cachedLabelSettings = {};
  try {
    cachedLabelSettings = JSON.parse(
      localStorage.getItem(
        getCashMemoLabelSettingsStorageKey(firestoreUser.dealerCode),
      ) || "{}",
    );
  } catch {
    cachedLabelSettings = {};
  }
  const userLabelSettings = mergeCashMemoLabelSettings(
    firestoreUser.cashMemoLabelSettings || cachedLabelSettings,
  );
  try {
    localStorage.setItem(
      getCashMemoLabelSettingsStorageKey(firestoreUser.dealerCode),
      JSON.stringify(userLabelSettings),
    );
  } catch {
    // best effort
  }
  writeUsersCache(
    readUsersCache().map((user) =>
      user.id === firestoreUser.id
        ? { ...user, cashMemoLabelSettings: userLabelSettings }
        : user,
    ),
  );
  setCashMemoLabelSettings(userLabelSettings);
  return userLabelSettings;
};
