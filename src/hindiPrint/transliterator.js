const INDEPENDENT_VOWELS = {
  a: 'अ',
  aa: 'आ',
  i: 'इ',
  ee: 'ई',
  ii: 'ई',
  u: 'उ',
  oo: 'ऊ',
  uu: 'ऊ',
  e: 'ए',
  ai: 'ऐ',
  o: 'ओ',
  au: 'औ',
  ri: 'ऋ',
};

const VOWEL_SIGNS = {
  a: '',
  aa: 'ा',
  i: 'ि',
  ee: 'ी',
  ii: 'ी',
  u: 'ु',
  oo: 'ू',
  uu: 'ू',
  e: 'े',
  ai: 'ै',
  o: 'ो',
  au: 'ौ',
  ri: 'ृ',
};

const CONSONANTS = {
  ksh: 'क्ष',
  ज्ञ: 'ज्ञ',
  shr: 'श्र',
  chh: 'छ',
  kh: 'ख',
  gh: 'घ',
  ch: 'च',
  jh: 'झ',
  th: 'थ',
  dh: 'ध',
  ph: 'फ',
  bh: 'भ',
  sh: 'श',
  ng: 'ङ',
  ny: 'ञ',
  tr: 'त्र',
  gy: 'ज्ञ',
  q: 'क',
  x: 'क्स',
  k: 'क',
  g: 'ग',
  c: 'क',
  j: 'ज',
  t: 'ट',
  d: 'ड',
  n: 'न',
  p: 'प',
  b: 'ब',
  m: 'म',
  y: 'य',
  r: 'र',
  l: 'ल',
  v: 'व',
  w: 'व',
  s: 'स',
  h: 'ह',
  f: 'फ',
  z: 'ज',
};

const VOWEL_PATTERNS = ['aa', 'ai', 'au', 'ee', 'ii', 'oo', 'uu', 'ri', 'a', 'i', 'u', 'e', 'o'];
const CONSONANT_PATTERNS = ['ksh', 'shr', 'chh', 'kh', 'gh', 'ch', 'jh', 'th', 'dh', 'ph', 'bh', 'sh', 'ng', 'ny', 'tr', 'gy', 'q', 'x', 'k', 'g', 'c', 'j', 't', 'd', 'n', 'p', 'b', 'm', 'y', 'r', 'l', 'v', 'w', 's', 'h', 'f', 'z'];

function startsWithAny(text, startIndex, patterns) {
  for (const pattern of patterns) {
    if (text.startsWith(pattern, startIndex)) {
      return pattern;
    }
  }
  return null;
}

function transliterateAlphaToken(token) {
  const source = token.toLowerCase();
  let index = 0;
  let output = '';
  let previousWasConsonant = false;

  while (index < source.length) {
    const char = source[index];

    if (!/[a-z]/.test(char)) {
      output += token[index];
      previousWasConsonant = false;
      index += 1;
      continue;
    }

    const vowel = startsWithAny(source, index, VOWEL_PATTERNS);
    if (vowel) {
      output += previousWasConsonant ? VOWEL_SIGNS[vowel] : INDEPENDENT_VOWELS[vowel];
      previousWasConsonant = false;
      index += vowel.length;
      continue;
    }

    const consonant = startsWithAny(source, index, CONSONANT_PATTERNS);
    if (consonant) {
      output += CONSONANTS[consonant] || token[index];
      previousWasConsonant = true;
      index += consonant.length;
      continue;
    }

    output += token[index];
    previousWasConsonant = false;
    index += 1;
  }

  if (previousWasConsonant && /[nrmdtsyvwlkgpbhfjxzq]$/i.test(source)) {
    return output;
  }

  return output;
}

export function transliterateLatinToHindi(input) {
  if (input === null || input === undefined) return '';

  return String(input).replace(/[A-Za-z]+/g, (token) => transliterateAlphaToken(token));
}
