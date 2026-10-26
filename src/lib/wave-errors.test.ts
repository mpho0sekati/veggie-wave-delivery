import { describe, expect, it } from "vitest";
import { acceptFailureCode, confirmedWaveExpired } from "./wave-errors";

const now = Date.parse("2026-10-26T17:01:00Z");
const fresh = { status: "created" as const, expires_at: "2026-10-26T17:10:00Z" };
describe("authoritative wave expiry", () => {
  it("does not label a fresh wave expired on an unrelated failure", () => {
    expect(acceptFailureCode("network failed", fresh, now)).toBe("retry");
    expect(acceptFailureCode("wave-expired", fresh, now)).toBe("retry");
  });
  it("distinguishes insufficient stock from expiry", () => {
    expect(acceptFailureCode("insufficient-stock", fresh, now)).toBe("stock");
  });
  it("does not expire accepted deliveries after the wave deadline", () => {
    expect(confirmedWaveExpired({ ...fresh, status: "accepted" }, now + 3600000)).toBe(false);
    expect(acceptFailureCode("wave-expired", { ...fresh, status: "declined" }, now)).toBe("unavailable");
  });
  it("confirms expiry at the saved deadline", () => {
    expect(confirmedWaveExpired(fresh, Date.parse(fresh.expires_at) - 1)).toBe(false);
    expect(acceptFailureCode("wave-expired", fresh, Date.parse(fresh.expires_at))).toBe("expired");
  });
});