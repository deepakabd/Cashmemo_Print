/**
 * Simple in-memory rate limiter for the translation API.
 *
 * Tracks requests per client IP within a sliding time window.
 * When the limit is exceeded, the caller should respond with HTTP 429.
 *
 * NOTE: In-memory storage means the limit resets on each serverless
 * function cold start. For production multi-instance deployments,
 * consider using a shared store like Redis.
 */

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 10; // max requests per window per IP

const store = new Map();

/**
 * Cleans up expired entries from the store.
 * Called automatically on each check, but can also be called manually.
 */
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > DEFAULT_WINDOW_MS) {
      store.delete(key);
    }
  }
}

/**
 * Checks if a client IP is within the rate limit.
 *
 * @param {string} ip - The client IP address.
 * @param {object} [options] - Optional configuration.
 * @param {number} [options.windowMs] - Time window in milliseconds.
 * @param {number} [options.maxRequests] - Max requests allowed per window.
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
function checkRateLimit(ip, options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
  const now = Date.now();

  const existing = store.get(ip);
  if (!existing || now - existing.windowStart > windowMs) {
    store.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existing.windowStart + windowMs };
  }

  existing.count += 1;
  return { allowed: true, remaining: maxRequests - existing.count, resetAt: existing.windowStart + windowMs };
}

/**
 * Middleware-style helper that returns rate limit info for a given IP.
 * Call cleanup periodically to prevent memory growth.
 */
export function rateLimit(ip, options = {}) {
  cleanup();
  return checkRateLimit(ip, options);
}

/**
 * Extracts the client IP from a request object.
 * Handles common proxy headers (X-Forwarded-For, X-Real-IP).
 */
export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return String(first).split(',')[0].trim();
  }
  if (req.headers?.['x-real-ip']) {
    return String(req.headers['x-real-ip']).trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

/**
 * Validates translation request input.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateTranslationInput(body) {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object.';
  }

  const { text, source, target } = body;

  if (!text || typeof text !== 'string') {
    return 'Missing or invalid "text" field.';
  }

  if (text.length > 5000) {
    return 'Text exceeds maximum length of 5000 characters.';
  }

  if (source && typeof source !== 'string') {
    return 'Invalid "source" field.';
  }

  if (target && typeof target !== 'string') {
    return 'Invalid "target" field.';
  }

  return null;
}
