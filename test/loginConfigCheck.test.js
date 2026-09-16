import { afterEach, describe, expect, it } from "vitest";

import { checkLoginServiceConfig } from "../server/loginConfigCheck.js";

const KEYS = [
  "FIREBASE_SERVICE_ACCOUNT",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "K_SERVICE",
  "FUNCTION_TARGET",
  "GOOGLE_CLOUD_PROJECT",
  "FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_PROJECT_ID",
];

const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  KEYS.forEach((key) => {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  });
});

const clearAll = () => KEYS.forEach((key) => delete process.env[key]);

describe("checkLoginServiceConfig", () => {
  it("reports not-configured when nothing is set locally", () => {
    clearAll();
    const messages = [];

    const result = checkLoginServiceConfig((m) => messages.push(m));

    expect(result.ok).toBe(false);
    expect(messages.join("\n")).toContain("GOOGLE_APPLICATION_CREDENTIALS");
    expect(messages.join("\n")).toContain("503");
  });

  it("accepts a valid inline service account", () => {
    clearAll();
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      client_email: "svc@example.iam.gserviceaccount.com",
      private_key:
        "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
    });

    expect(checkLoginServiceConfig(() => {}).ok).toBe(true);
  });

  it("rejects inline JSON that is not a service account", () => {
    clearAll();
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ hello: "world" });

    const messages = [];
    expect(checkLoginServiceConfig((m) => messages.push(m)).ok).toBe(false);
    expect(messages.join()).toContain("not valid JSON for a service account");
  });

  it("rejects malformed inline JSON", () => {
    clearAll();
    process.env.FIREBASE_SERVICE_ACCOUNT = "{not json";

    expect(checkLoginServiceConfig(() => {}).ok).toBe(false);
  });

  it("flags a credentials path that does not exist", () => {
    clearAll();
    process.env.GOOGLE_APPLICATION_CREDENTIALS =
      "C:\\definitely\\not\\here.json";

    const messages = [];
    expect(checkLoginServiceConfig((m) => messages.push(m)).ok).toBe(false);
    expect(messages.join()).toContain("does not exist");
  });

  it("accepts an existing credentials file", () => {
    clearAll();
    process.env.GOOGLE_APPLICATION_CREDENTIALS = new URL(
      import.meta.url,
    ).pathname.replace(/^\//, "");

    expect(checkLoginServiceConfig(() => {}).ok).toBe(true);
  });

  it("treats a managed runtime as configured (platform-provided creds)", () => {
    clearAll();
    process.env.K_SERVICE = "my-function";

    expect(checkLoginServiceConfig(() => {}).ok).toBe(true);
  });
});
