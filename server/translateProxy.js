const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

export async function translateText({ apiKey, text, source = 'en', target = 'hi', format = 'text' }) {
  if (!apiKey) {
    throw new Error('Missing GOOGLE_CLOUD_API_KEY');
  }

  if (!text || typeof text !== 'string') {
    throw new Error('Missing text to translate');
  }

  const response = await fetch(`${GOOGLE_TRANSLATE_API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source,
      target,
      format,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'Google Translate request failed';
    throw new Error(message);
  }

  const translatedText = data?.data?.translations?.[0]?.translatedText;
  if (!translatedText) {
    throw new Error('Translation response did not include translated text');
  }

  return translatedText;
}

export async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}
