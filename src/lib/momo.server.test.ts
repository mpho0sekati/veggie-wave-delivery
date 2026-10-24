import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanMomoCredential, readMomoConfig } from "./momo.server";

// Synthetic fixtures only; never read deployed credentials in these tests.
const key = "abcdef0123456789abcdef0123456789";
const user = "12345678-abcd-1234-abcd-123456789abc";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("MoMo copy-paste cleanup", () => {
  it("removes a directly attached copied line number from a subscription key", () => {
    expect(cleanMomoCredential(`10${key}`, "key")).toBe(key);
  });

  it("removes a directly attached copied line number from an API user", () => {
    expect(cleanMomoCredential(`7${user}`, "user")).toBe(user);
  });

  it("removes a separated line label and surrounding whitespace", () => {
    expect(cleanMomoCredential(`  10: ${key}\n`, "key")).toBe(key);
  });

  it("preserves valid keys and UUIDs that begin with digits", () => {
    const numericKey = "12345678901234567890123456789012";
    expect(cleanMomoCredential(numericKey, "key")).toBe(numericKey);
    expect(cleanMomoCredential(user, "user")).toBe(user);
  });

  it("does not guess at malformed or differently formatted credentials", () => {
    expect(cleanMomoCredential("10not-a-valid-key", "key")).toBe("10not-a-valid-key");
    expect(cleanMomoCredential(`label ${key}`, "key")).toBe(`label ${key}`);
    expect(cleanMomoCredential(`1234${key}`, "key")).toBe(`1234${key}`);
  });

  it("uses cleaned values for the payment client configuration", () => {
    vi.stubEnv("MOMO_SUBSCRIPTION_KEY", `10${key}`);
    vi.stubEnv("MOMO_API_USER", `7${user}`);
    vi.stubEnv("MOMO_API_KEY", ` ${key}\n`);
    vi.stubEnv("MOMO_BASE_URL", " https://proxy.momoapi.mtn.com/ ");
    vi.stubEnv("MOMO_TARGET_ENVIRONMENT", " mtnsouthafrica ");
    vi.stubEnv("MOMO_CURRENCY", " ZAR ");
    vi.stubEnv("MOMO_CALLBACK_URL", " ");
    expect(readMomoConfig()).toEqual({
      baseUrl: "https://proxy.momoapi.mtn.com",
      subscriptionKey: key,
      apiUser: user,
      apiKey: key,
      targetEnvironment: "mtnsouthafrica",
      currency: "ZAR",
      callbackUrl: undefined,
    });
  });

  it("rejects empty required credentials without including credential values", () => {
    vi.stubEnv("MOMO_SUBSCRIPTION_KEY", " ");
    vi.stubEnv("MOMO_API_USER", " ");
    vi.stubEnv("MOMO_API_KEY", " ");
    expect(() => readMomoConfig()).toThrow(
      "momo-not-configured: missing MOMO_SUBSCRIPTION_KEY, MOMO_API_USER, MOMO_API_KEY",
    );
  });
});
