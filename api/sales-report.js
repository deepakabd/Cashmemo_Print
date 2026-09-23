import { readJsonBody, sendJson } from '../server/translateProxy.js';
import { LoginError } from '../server/loginService.js';
import { handleSalesReportRequest } from '../server/salesReportService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body && typeof req.body === 'object' ? req.body : await readJsonBody(req));

    const result = await handleSalesReportRequest(req.headers?.authorization, body);
    return sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof LoginError) {
      return sendJson(res, error.status, { error: error.message, code: error.code });
    }
    console.error('SalesReport API error:', error);
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Sales report operation failed.',
      code: 'server-error',
    });
  }
}
