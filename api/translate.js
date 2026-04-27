import { readJsonBody, sendJson, translateText } from '../server/translateProxy.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
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
