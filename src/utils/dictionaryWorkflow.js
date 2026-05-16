export const DICTIONARY_TEMPLATE_ROWS = [
  { 'English Word': 'Gaurav', 'Hindi Translation': 'गौरव' },
  { 'English Word': 'Khera Bazar', 'Hindi Translation': 'खेड़ा बाज़ार' },
  { 'English Word': 'Rajesh', 'Hindi Translation': 'राजेश' },
];

export const normalizeDictionaryText = (value = '') => String(value || '').trim();

export const normalizeDictionaryKey = (value = '') => normalizeDictionaryText(value).toLowerCase();

export const buildDictionaryEntriesForSave = (rows = [], options = {}) => {
  const deduped = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const englishWord = normalizeDictionaryText(
      row?.englishWord || row?.['English Word'] || row?.English || row?.english || row?.Word || row?.word || ''
    );
    const hindiTranslation = normalizeDictionaryText(
      row?.hindiTranslation || row?.['Hindi Translation'] || row?.Hindi || row?.hindi || row?.Translation || row?.translation || ''
    );

    if (!englishWord || !hindiTranslation) return;

    const phraseKind = row?.phraseKind || 'token';
    const dedupeKey = options.dedupeByPhraseKind ? `${phraseKind}:${englishWord.toLowerCase()}` : englishWord.toLowerCase();

    deduped.set(dedupeKey, {
      englishWord,
      hindiTranslation,
      phraseKind,
      requestSource: row?.requestSource || '',
      queueLabel: row?.queueLabel || '',
      requestedFrom: row?.requestedFrom || '',
      matchedExistingEntry: row?.matchedExistingEntry || '',
    });
  });

  return Array.from(deduped.values());
};

export const mergeDictionaryWithEntries = (dictionary = {}, rows = []) => {
  const nextDictionary = { ...(dictionary || {}) };
  buildDictionaryEntriesForSave(rows).forEach(({ englishWord, hindiTranslation }) => {
    nextDictionary[englishWord] = hindiTranslation;
  });
  return nextDictionary;
};

export const getExistingDictionaryEntry = (dictionary = {}, englishWord = '') => {
  const normalized = normalizeDictionaryKey(englishWord);
  if (!normalized) return null;
  const existingKey = Object.keys(dictionary || {}).find((key) => normalizeDictionaryKey(key) === normalized);
  if (!existingKey) return null;
  return {
    englishWord: existingKey,
    hindiTranslation: dictionary[existingKey],
  };
};

export const getDictionaryTranslation = (dictionary = {}, englishWord = '') => (
  getExistingDictionaryEntry(dictionary, englishWord)?.hindiTranslation || ''
);

export const filterChangedDictionaryEntries = (dictionary = {}, rows = []) => (
  buildDictionaryEntriesForSave(rows).filter((entry) => (
    normalizeDictionaryText(getDictionaryTranslation(dictionary, entry.englishWord)) !== entry.hindiTranslation
  ))
);

export const buildDictionaryApprovalPayload = (entry = {}, options = {}, index = 0) => ({
  englishWord: normalizeDictionaryText(entry.englishWord),
  hindiTranslation: normalizeDictionaryText(entry.hindiTranslation),
  clientRequestId: options.clientRequestIdPrefix
    ? `${options.clientRequestIdPrefix}-${index}`
    : `admin-dict-${Date.now()}-${index}`,
  importMode: options.importMode || 'duplicate-review',
  requestSource: options.requestSource || entry.requestSource || 'manual',
  queueLabel: options.queueLabel || entry.queueLabel || 'Dictionary',
  requestedFrom: options.requestedFrom || entry.requestedFrom || '',
  phraseKind: options.phraseKind || entry.phraseKind || 'token',
  matchedExistingEntry: options.matchedExistingEntry || entry.matchedExistingEntry || '',
});

export const splitDictionaryImportEntries = (dictionary = {}, rows = []) => {
  const entries = buildDictionaryEntriesForSave(rows);
  return {
    entries,
    newEntries: entries.filter((entry) => !getExistingDictionaryEntry(dictionary, entry.englishWord)),
    duplicateEntries: entries.filter((entry) => getExistingDictionaryEntry(dictionary, entry.englishWord)),
  };
};
