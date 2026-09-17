import { sendJson } from "../server/translateProxy.js";
import { rateLimit, getClientIp } from "../server/rateLimiter.js";
import { LoginError, verifyDealerLogin } from "../server/loginService.js";

/**
 * POST /api/login
 *
 * Body: { dealerCode: string, pin: string }
 * 200:  { token, dealerCode, uid, userId }
 *
 * The PIN is verified server-side against a scrypt hash; the client never sees
 * a stored credential. The returned Firebase custom token is exchanged for a
 * real Auth session, which is what makes Security Rules enforceable.
 */

// PIN guessing is the whole attack surface here, so this limit is deliberately
// much tighter than the translation endpoint's default.
export const LOGIN_RATE_LIMIT = { windowMs: 5 * 60 * 1000, maxRequests: 10 };

export const validateLoginInput = (body) => {
  if (!body || typeof body !== "object")
    return "Request body must be a JSON object.";
  const { dealerCode, pin } = body;
  if (!dealerCode || typeof dealerCode !== "string")
    return 'Missing or invalid "dealerCode" field.';
  if (!pin || typeof pin !== "string") return 'Missing or invalid "pin" field.';
  if (dealerCode.trim().length > 32)
    return '"dealerCode" exceeds maximum length.';
  if (pin.length > 64) return '"pin" exceeds maximum length.';
  return null;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const clientIp = getClientIp(req);
  const limitResult = rateLimit(clientIp, LOGIN_RATE_LIMIT);
  if (!limitResult.allowed) {
    res.setHeader(
      "Retry-After",
      String(Math.ceil((limitResult.resetAt - Date.now()) / 1000)),
    );
    return sendJson(res, 429, {
      error: "Too many login attempts. Please try again later.",
      code: "rate-limited",
    });
  }

  try {
    const body =
      typeof req.body === "object" && req.body !== null
        ? req.body
        : JSON.parse((await readRawBody(req)) || "{}");

    const validationError = validateLoginInput(body);
    if (validationError) {
      return sendJson(res, 400, {
        error: validationError,
        code: "invalid-input",
      });
    }

    const result = await verifyDealerLogin({
      dealerCode: body.dealerCode,
      pin: body.pin,
    });

    return sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof LoginError) {
      return sendJson(res, error.status, {
        error: error.message,
        code: error.code,
      });
    }
    // Never surface internals (or the submitted PIN) to the client.
    console.error(
      "Login failed:",
      error instanceof Error ? error.message : error,
    );
    return sendJson(res, 500, {
      error: "Login failed. Please try again.",
      code: "server-error",
    });
  }
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks).toString("utf8") : "";
}
