import { readJsonBody, sendJson } from '../server/translateProxy.js';
import { LoginError } from '../server/loginService.js';
import { consumerDatabaseWorkspace } from '../server/consumerDatabaseWorkspace.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || await readJsonBody(req);
    return sendJson(res, 200, await consumerDatabaseWorkspace(req.headers.authorization, body));
  } catch (error) {
    return sendJson(res, error instanceof LoginError ? error.status : 500, { error: error instanceof LoginError ? error.message : 'Consumer Database operation failed.' });
  }
}
