import { describe, expect, it } from "vitest";

import { hashPin, isHashedPin, verifyPin } from "../server/pinCredentials.js";
import { buildPinHashPatch, migrateUserPin } from "../server/pinAdmin.js";

describe("pinCredentials", () => {
  it("hashes a PIN into the scrypt format and never stores the plaintext", async () => {
    const hash = await hashPin("1234");

    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash.split("$")).toHaveLength(6);
    expect(hash).not.toContain("1234");
    expect(isHashedPin(hash)).toBe(true);
  });

  it("produces a different hash for the same PIN (unique salt)", async () => {
    const [a, b] = await Promise.all([hashPin("1234"), hashPin("1234")]);
    expect(a).not.toBe(b);
  });

  it("verifies the correct PIN and rejects the wrong one", async () => {
    const hash = await hashPin("4321");

    expect((await verifyPin("4321", hash)).matches).toBe(true);
    expect((await verifyPin("1234", hash)).matches).toBe(false);
    expect((await verifyPin("", hash)).matches).toBe(false);
  });

  it("flags legacy plaintext values instead of trusting them silently", async () => {
    const legacy = await verifyPin("1234", "1234");
    expect(legacy.matches).toBe(true);
    expect(legacy.legacy).toBe(true);

    const wrong = await verifyPin("9999", "1234");
    expect(wrong.matches).toBe(false);
    expect(wrong.legacy).toBe(true);
  });

  it("rejects malformed stored values without throwing", async () => {
    const cases = ["scrypt$bad", "scrypt$a$b$c$d$e", "", "not-a-hash"];

    for (const stored of cases) {
      await expect(verifyPin("1234", stored)).resolves.toMatchObject({
        matches: false,
      });
    }
  });

  it("treats a non-hash string as legacy rather than crashing", async () => {
    await expect(verifyPin("1234", "x")).resolves.toEqual({
      matches: false,
      legacy: true,
    });
  });
});

describe("pinAdmin", () => {
  it("builds a patch that wipes the readable PIN field", async () => {
    const patch = await buildPinHashPatch("5678");

    expect(patch.pin).toBeNull();
    expect(isHashedPin(patch.pinHash)).toBe(true);
    expect(patch.pinHash).not.toContain("5678");
  });

  it("rejects an empty or oversized PIN", async () => {
    await expect(buildPinHashPatch("")).rejects.toThrow(/PIN is required/);
    await expect(buildPinHashPatch("x".repeat(65))).rejects.toThrow(/too long/);
  });

  it("normalises a hash stored in the legacy field name", async () => {
    const hash = await hashPin("1234");
    const patch = await migrateUserPin({ pin: hash });

    expect(patch.pin).toBeNull();
    expect(patch.pinHash).toBe(hash);
  });

  it("clears an unmigratable plaintext PIN and forces a reset", async () => {
    const patch = await migrateUserPin({ pin: "1234" });

    expect(patch.pin).toBeNull();
    expect(patch.pinHash).toBeNull();
    expect(patch.pinResetRequired).toBe(true);
  });

  it("is a no-op for a document already in hash form", async () => {
    const hash = await hashPin("1234");
    expect(await migrateUserPin({ pinHash: hash })).toBeNull();
  });

  it("is a no-op for a document with no PIN at all", async () => {
    expect(await migrateUserPin({})).toBeNull();
    expect(await migrateUserPin(null)).toBeNull();
  });
});
