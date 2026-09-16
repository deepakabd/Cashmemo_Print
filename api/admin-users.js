import { readJsonBody, sendJson } from '../server/translateProxy.js';
import { LoginError } from '../server/loginService.js';
import { saveAdminUser } from '../server/adminUsers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body)
      : req.body && typeof req.body === 'object' ? req.body : await readJsonBody(req);
    return sendJson(res, 200, await saveAdminUser(req.headers.authorization, body));
  } catch (error) {
    if (error instanceof LoginError) return sendJson(res, error.status, { error: error.message, code: error.code });
    return sendJson(res, 500, { error: 'User write failed. No local user was created.', code: 'server-error' });
  }
}
