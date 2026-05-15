export const DICTIONARY_TEMPLATE_ROWS = [
  { 'English Word': 'Gaurav', 'Hindi Translation': 'गौरव' },
  { 'English Word': 'Khera Bazar', 'Hindi Translation': 'खेड़ा बाजार' },
  { 'English Word': 'Rajesh', 'Hindi Translation': 'राजेश' },
];

export const normalizeDictionaryText = (value = '') => String(value || '').trim();

export const buildDictionaryEntriesForSave = (rows = []) => {
  const deduped = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const englishWord = normalizeDictionaryText(
      row?.englishWord || row?.['English Word'] || row?.English || row?.english || row?.Word || row?.word || ''
    );
    const hindiTranslation = normalizeDictionaryText(
      row?.hindiTranslation || row?.['Hindi Translation'] || row?.Hindi || row?.hindi || row?.Translation || row?.translation || ''
    );

    if (!englishWord || !hindiTranslation) return;

    deduped.set(englishWord.toLowerCase(), {
      englishWord,
      hindiTranslation,
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
