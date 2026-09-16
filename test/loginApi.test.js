import { describe, expect, it } from "vitest";

import { LOGIN_RATE_LIMIT, validateLoginInput } from "../api/login.js";

describe("validateLoginInput", () => {
  it("accepts a well-formed credential pair", () => {
    expect(
      validateLoginInput({ dealerCode: "410001", pin: "1234" }),
    ).toBeNull();
  });

  it("rejects a missing or non-object body", () => {
    expect(validateLoginInput(null)).toMatch(/JSON object/);
    expect(validateLoginInput("nope")).toMatch(/JSON object/);
  });

  it("rejects missing dealerCode or pin", () => {
    expect(validateLoginInput({ pin: "1234" })).toMatch(/dealerCode/);
    expect(validateLoginInput({ dealerCode: "410001" })).toMatch(/pin/);
    expect(validateLoginInput({ dealerCode: "", pin: "1234" })).toMatch(
      /dealerCode/,
    );
    expect(validateLoginInput({ dealerCode: "410001", pin: "" })).toMatch(
      /pin/,
    );
  });

  it("rejects non-string credentials instead of coercing them", () => {
    expect(validateLoginInput({ dealerCode: 410001, pin: "1234" })).toMatch(
      /dealerCode/,
    );
    expect(validateLoginInput({ dealerCode: "410001", pin: 1234 })).toMatch(
      /pin/,
    );
  });

  it("rejects oversized input to bound hashing cost", () => {
    expect(
      validateLoginInput({ dealerCode: "x".repeat(33), pin: "1234" }),
    ).toMatch(/dealerCode/);
    expect(
      validateLoginInput({ dealerCode: "410001", pin: "x".repeat(65) }),
    ).toMatch(/pin/);
  });

  it("rate-limits PIN guessing much more tightly than the translate endpoint", () => {
    expect(LOGIN_RATE_LIMIT.maxRequests).toBeLessThanOrEqual(10);
    expect(LOGIN_RATE_LIMIT.windowMs).toBeGreaterThanOrEqual(60 * 1000);
  });
});
