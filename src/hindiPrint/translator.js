import { HINDI_FIELD_BEHAVIOR, PASSTHROUGH_TOKEN_PATTERN } from './fieldConfig';
import { HINDI_EXACT_OVERRIDES, HINDI_TOKEN_OVERRIDES, HINDI_VALUE_DICTIONARY } from './overrides';
import { HINDI_FIELD_LABELS } from './labels';
import { transliterateLatinToHindi } from './transliterator';

let runtimeHindiDictionary = {};

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function titleCaseFromFieldName(fieldName) {
  return String(fieldName || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeRuntimeDictionary(dictionary = {}) {
  return Object.entries(dictionary || {}).reduce((acc, [key, value]) => {
    const englishWord = String(key || '').trim();
    const hindiTranslation = String(value || '').trim();
    if (englishWord && hindiTranslation) {
      acc[englishWord] = hindiTranslation;
    }
    return acc;
  }, {});
}

function findRuntimeDictionaryMatch(rawValue) {
  const normalized = normalizeKey(rawValue);
  const match = Object.entries(runtimeHindiDictionary).find(([key]) => normalizeKey(key) === normalized);
  return match ? match[1] : '';
}

function applyExactOverride(rawValue, overrideGroupNames = []) {
  const normalized = normalizeKey(rawValue);

  for (const groupName of overrideGroupNames) {
    const group = HINDI_EXACT_OVERRIDES[groupName];
    if (!group) continue;

    const match = Object.entries(group).find(([key]) => normalizeKey(key) === normalized);
    if (match) return match[1];
  }

  const generalMatch = Object.entries(HINDI_EXACT_OVERRIDES.general || {}).find(
    ([key]) => normalizeKey(key) === normalized
  );

  return generalMatch ? generalMatch[1] : '';
}

function applyValueDictionary(rawValue) {
  const normalized = normalizeKey(rawValue);
  const match = Object.entries(HINDI_VALUE_DICTIONARY).find(([key]) => normalizeKey(key) === normalized);
  return match ? match[1] : '';
}

function mapToken(token) {
  const normalized = normalizeKey(token);
  if (HINDI_TOKEN_OVERRIDES[normalized]) {
    return HINDI_TOKEN_OVERRIDES[normalized];
  }

  if (/^\d+$/.test(token)) return token;
  if (PASSTHROUGH_TOKEN_PATTERN.test(token) && !/[a-z]/i.test(token)) return token;

  return transliterateLatinToHindi(token);
}

function applyTokenMapping(rawValue) {
  return String(rawValue)
    .split(/(\s+|,|\/|-|\(|\))/)
    .map((part) => {
      if (!part || /^(\s+|,|\/|-|\(|\))$/.test(part)) return part;
      return mapToken(part);
    })
    .join('');
}

function formatDateValue(rawValue) {
  if (!rawValue) return '';

  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    const day = String(rawValue.getDate()).padStart(2, '0');
    const month = String(rawValue.getMonth() + 1).padStart(2, '0');
    const year = rawValue.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return String(rawValue);
}

function convertDynamicValue(fieldName, rawValue, overrideGroups) {
  const runtimeMatch = findRuntimeDictionaryMatch(rawValue);
  if (runtimeMatch) return runtimeMatch;

  const exactOverride = applyExactOverride(rawValue, overrideGroups);
  if (exactOverride) return exactOverride;

  const mappedPhrase = applyValueDictionary(rawValue);
  if (mappedPhrase) return mappedPhrase;

  const tokenMapped = applyTokenMapping(rawValue);
  if (tokenMapped && normalizeKey(tokenMapped) !== normalizeKey(rawValue)) return tokenMapped;

  const transliterated = transliterateLatinToHindi(rawValue);
  if (transliterated && normalizeKey(transliterated) !== normalizeKey(rawValue)) return transliterated;

  return String(rawValue);
}

export function setHindiRuntimeDictionary(dictionary = {}) {
  runtimeHindiDictionary = sanitizeRuntimeDictionary(dictionary);
}

export function getHindiLabel(fieldName) {
  return HINDI_FIELD_LABELS[fieldName] || titleCaseFromFieldName(fieldName);
}

export function getHindiValue(fieldName, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return '';

  const behavior = HINDI_FIELD_BEHAVIOR[fieldName] || HINDI_FIELD_BEHAVIOR.default;

  if (behavior === 'passthrough') {
    return String(rawValue);
  }

  if (behavior === 'date_value') {
    return formatDateValue(rawValue);
  }

  if (behavior === 'mapped_value') {
    return applyValueDictionary(rawValue) || String(rawValue);
  }

  if (behavior === 'dynamic_place') {
    return convertDynamicValue(fieldName, rawValue, ['villages', 'areas']);
  }

  if (behavior === 'dynamic_address') {
    return convertDynamicValue(fieldName, rawValue, ['addresses', 'villages', 'areas']);
  }

  if (behavior === 'dynamic_text') {
    return convertDynamicValue(fieldName, rawValue, ['names']);
  }

  return String(rawValue);
}

export function translateCashMemoRecordToHindi(record) {
  const source = record || {};
  const translated = {};

  Object.entries(source).forEach(([fieldName, fieldValue]) => {
    translated[fieldName] = {
      label: getHindiLabel(fieldName),
      value: getHindiValue(fieldName, fieldValue),
      originalValue: fieldValue,
    };
  });

  return translated;
}

export function createHindiPrintAdapter(record) {
  return new Proxy(record || {}, {
    get(target, property) {
      if (typeof property !== 'string') return target[property];
      return getHindiValue(property, target[property]);
    },
  });
}
