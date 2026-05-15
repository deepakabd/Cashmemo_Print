import { describe, expect, it } from 'vitest';

import {
  buildDictionaryEntriesForSave,
  DICTIONARY_TEMPLATE_ROWS,
  mergeDictionaryWithEntries,
} from '../src/utils/dictionaryWorkflow.js';

describe('dictionaryWorkflow helpers', () => {
  it('normalizes supported dictionary headers and removes invalid rows', () => {
    expect(buildDictionaryEntriesForSave([
      { 'English Word': ' Gaurav ', 'Hindi Translation': ' गौरव ' },
      { English: 'Rajesh', Hindi: 'राजेश' },
      { englishWord: '', hindiTranslation: 'अमान्य' },
    ])).toEqual([
      { englishWord: 'Gaurav', hindiTranslation: 'गौरव' },
      { englishWord: 'Rajesh', hindiTranslation: 'राजेश' },
    ]);
  });

  it('dedupes dictionary rows case-insensitively with latest value winning', () => {
    expect(buildDictionaryEntriesForSave([
      { englishWord: 'Khera Bazar', hindiTranslation: 'खेड़ा बाजार' },
      { englishWord: 'khera bazar', hindiTranslation: 'खेड़ा बाज़ार' },
    ])).toEqual([
      { englishWord: 'khera bazar', hindiTranslation: 'खेड़ा बाज़ार' },
    ]);
  });

  it('merges entries into the existing runtime dictionary', () => {
    expect(mergeDictionaryWithEntries(
      { Gaurav: 'गौरव' },
      [{ englishWord: 'Rajesh', hindiTranslation: 'राजेश' }],
    )).toEqual({
      Gaurav: 'गौरव',
      Rajesh: 'राजेश',
    });
  });

  it('provides a sample template with expected upload headers', () => {
    expect(DICTIONARY_TEMPLATE_ROWS[0]).toHaveProperty('English Word');
    expect(DICTIONARY_TEMPLATE_ROWS[0]).toHaveProperty('Hindi Translation');
  });
});
