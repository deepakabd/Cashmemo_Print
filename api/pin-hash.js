import { sendJson } from "../server/translateProxy.js";
import { rateLimit, getClientIp } from "../server/rateLimiter.js";
import { LoginError } from "../server/loginService.js";
import { buildPinHashPatch } from "../server/pinAdmin.js";

/**
 * POST /api/pin-hash
 *
 * Body: { pin: string }
 * 200:  { pinHash, pinUpdatedAt }
 *
 * Returns the field patch a client should persist instead of a plaintext PIN.
 * The plaintext is used only to derive the hash and is never stored or logged.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const limitResult = rateLimit(getClientIp(req), {
    windowMs: 60 * 1000,
    maxRequests: 30,
  });
  if (!limitResult.allowed) {
    res.setHeader(
      "Retry-After",
      String(Math.ceil((limitResult.resetAt - Date.now()) / 1000)),
    );
    return sendJson(res, 429, {
      error: "Too many requests.",
      code: "rate-limited",
    });
  }

  try {
    const body =
      typeof req.body === "object" && req.body !== null
        ? req.body
        : JSON.parse((await readRawBody(req)) || "{}");

    if (!body?.pin || typeof body.pin !== "string") {
      return sendJson(res, 400, {
        error: 'Missing or invalid "pin" field.',
        code: "invalid-input",
      });
    }

    return sendJson(res, 200, await buildPinHashPatch(body.pin));
  } catch (error) {
    if (error instanceof LoginError) {
      return sendJson(res, error.status, {
        error: error.message,
        code: error.code,
      });
    }
    console.error(
      "PIN hash failed:",
      error instanceof Error ? error.message : error,
    );
    return sendJson(res, 500, {
      error: "PIN hashing failed.",
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
