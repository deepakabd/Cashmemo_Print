import { CASHMEMO_LABEL_OPTIONS, CASHMEMO_PAGE_TYPES, DEFAULT_HIDDEN_LABELS_BY_PAGE_TYPE } from './appConfig';

export const getCashMemoPerPage = (pageType) => {
  if (pageType === '2 Cashmemo/Page') return 2;
  if (pageType === '4 Cashmemo/Page') return 4;
  return 3;
};

export const createDefaultCashMemoLabelSettings = () => {
  const settings = {};
  CASHMEMO_PAGE_TYPES.forEach((type) => {
    const hiddenLabels = DEFAULT_HIDDEN_LABELS_BY_PAGE_TYPE[type] || new Set();
    settings[type] = CASHMEMO_LABEL_OPTIONS.reduce((acc, item) => {
      acc[item.key] = !hiddenLabels.has(item.key);
      return acc;
    }, {});
  });
  return settings;
};

export const mergeCashMemoLabelSettings = (savedSettings = {}) => {
  const defaults = createDefaultCashMemoLabelSettings();
  CASHMEMO_PAGE_TYPES.forEach((type) => {
    defaults[type] = {
      ...defaults[type],
      ...(savedSettings?.[type] || {}),
    };
  });
  return defaults;
};

export const getCashMemoLabelSettingsStorageKey = (dealerCode = '') => (
  dealerCode ? `cashMemoLabelSettings_${String(dealerCode).trim()}` : 'cashMemoLabelSettings'
);