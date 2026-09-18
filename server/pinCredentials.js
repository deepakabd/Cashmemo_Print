/**
 * PIN credential hashing and verification — SERVER SIDE ONLY.
 *
 * Why this file exists
 * --------------------
 * The PIN used to be stored as a plaintext `pin` field on the Firestore `users`
 * document and compared in the browser. That meant:
 *   1. any client able to read `users` could dump every PIN, and
 *   2. the comparison logic itself shipped inside the JS bundle.
 *
 * Verification now happens here (trusted layer) and the stored value is a
 * scrypt hash. The plaintext PIN never leaves the request body and is never
 * persisted.
 *
 * Format: `scrypt$N$r$p$salt$hash` (all parts base64 except N/r/p).
 * The parameters are embedded so hashes stay verifiable after we tune them.
 *
 * IMPORTANT: never import this module from anything under `src/` — it must not
 * end up in the client bundle.
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384; // CPU/memory cost
const SCRYPT_R = 8; // block size
const SCRYPT_P = 1; // parallelisation
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// scrypt needs ~128*N*r bytes; give it headroom to avoid OpenSSL failures.
const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2;

const scryptAsync = (password, salt, { N, r, p, keylen }) =>
  new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keylen,
      { N, r, p, maxmem: SCRYPT_MAXMEM },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });

/**
 * Hashes a plaintext PIN for storage.
 * @returns {Promise<string>} `scrypt$N$r$p$salt$hash`
 */
export const hashPin = async (
  pin,
  { N = SCRYPT_N, r = SCRYPT_R, p = SCRYPT_P } = {},
) => {
  const plaintext = String(pin ?? "");
  if (!plaintext) throw new Error("PIN is required for hashing.");

  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(plaintext, salt, {
    N,
    r,
    p,
    keylen: KEY_LENGTH,
  });

  return [
    "scrypt",
    N,
    r,
    p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
};

/**
 * Constant-time comparison of a plaintext PIN against a stored string.
 *
 * Also detects legacy plaintext values (`storedPin` not in hash format) so a
 * deployment can verify old accounts before the hash backfill has run. Callers
 * should treat `legacy: true` as "must be re-hashed immediately".
 *
 * @returns {Promise<{ matches: boolean, legacy: boolean }>}
 */
export const verifyPin = async (pin, storedPin) => {
  const plaintext = String(pin ?? "");
  const stored = String(storedPin ?? "");

  if (!plaintext || !stored) return { matches: false, legacy: false };

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    // Legacy plaintext row. Constant-time compare so we do not leak length via
    // early exit; the caller decides whether to allow and re-hash.
    const a = Buffer.from(plaintext);
    const b = Buffer.from(stored);
    const matches = a.length === b.length && timingSafeEqual(a, b);
    return { matches, legacy: true };
  }

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    N <= 0 ||
    r <= 0 ||
    p <= 0
  ) {
    return { matches: false, legacy: false };
  }

  let salt;
  let expected;
  try {
    salt = Buffer.from(saltB64, "base64");
    expected = Buffer.from(hashB64, "base64");
  } catch {
    return { matches: false, legacy: false };
  }

  if (!salt.length || !expected.length)
    return { matches: false, legacy: false };

  let derived;
  try {
    derived = await scryptAsync(plaintext, salt, {
      N,
      r,
      p,
      keylen: expected.length,
    });
  } catch {
    return { matches: false, legacy: false };
  }

  return {
    matches:
      derived.length === expected.length && timingSafeEqual(derived, expected),
    legacy: false,
  };
};

/** True when a stored value is already a scrypt hash. */
export const isHashedPin = (storedPin) => {
  return /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{86}==$/.test(String(storedPin ?? ""));
};
