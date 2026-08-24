export const getApiDictionaryPreviewEntry = (entry = {}) => {
  const payload = entry?.payload || {};
  return {
    approvalId: entry?.id || entry?.approvalId || payload?.approvalId || '',
    englishWord: String(entry?.englishWord || payload?.englishWord || payload?.eng || '').trim(),
    hindiTranslation: String(entry?.hindiTranslation || payload?.hindiTranslation || payload?.hin || '').trim(),
    phraseKind: String(entry?.phraseKind || payload?.phraseKind || 'token').trim(),
    requestSource: String(entry?.requestSource || payload?.requestSource || '').trim(),
    queueLabel: String(entry?.queueLabel || payload?.queueLabel || '').trim(),
    requestedFrom: String(entry?.requestedFrom || payload?.requestedFrom || '').trim(),
    status: String(entry?.status || payload?.status || 'pending').trim(),
  };
};

export const getDictionaryDocId = (englishWord = '') => (
  encodeURIComponent(String(englishWord || '').trim().toLowerCase()).replace(/\./g, '%2E') || `word-${Date.now()}`
);

export const normalizePendingTypeLabel = (type) => {
  const raw = String(type || '').toLowerCase().trim();
  if (raw === 'profile' || raw === 'profiledata') return 'profile';
  if (raw === 'bank' || raw === 'bankdetails' || raw === 'bankdetailsdata') return 'bank';
  if (raw === 'rates' || raw === 'rate' || raw === 'ratesdata') return 'rates';
  if (raw === 'header' || raw === 'hindiheader' || raw === 'hindiheaderdata') return 'header';
  if (raw === 'planupgrade' || raw === 'plan' || raw === 'package') return 'plan upgrade';
  if (raw === 'deliveryarea' || raw === 'delivery area') return 'Delivery Area';
  if (raw === 'deliverystaff' || raw === 'delivery staff') return 'Delivery Staff';
  return raw;
};