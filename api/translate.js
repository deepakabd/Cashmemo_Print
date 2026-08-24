import { readJsonBody, sendJson, translateText } from '../server/translateProxy.js';
import { rateLimit, getClientIp, validateTranslationInput } from '../server/rateLimiter.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIp = getClientIp(req);
  const limitResult = rateLimit(clientIp);
  if (!limitResult.allowed) {
    res.setHeader('Retry-After', String(Math.ceil((limitResult.resetAt - Date.now()) / 1000)));
    return sendJson(res, 429, { error: 'Rate limit exceeded. Please try again later.' });
  }

  try {
    const body = await readJsonBody(req);

    // Input validation
    const validationError = validateTranslationInput(body);
    if (validationError) {
      return sendJson(res, 400, { error: validationError });
    }

    const translatedText = await translateText({
      apiKey: process.env.GOOGLE_CLOUD_API_KEY,
      text: body.text,
      source: body.source,
      target: body.target,
      format: body.format,
    });

    return sendJson(res, 200, { translatedText });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Translation failed';
    return sendJson(res, 500, { error: message });
  }
}
