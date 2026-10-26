import { describe, expect, it } from "vitest";
import { demoBalanceCents, demoCashOutCents } from "./ewallet-demo";

describe("balance-based eWallet simulation", () => {
  it("uses the recorded Mdeko balance without inventing funds", () => {
    expect(demoBalanceCents(5)).toBe(500);
    expect(demoBalanceCents(undefined)).toBe(0);
  });
  it("rejects a withdrawal above the recorded balance", () => {
    expect(demoCashOutCents("15", demoBalanceCents(5))).toBeNull();
  });
  it("allows withdrawing the exact balance including cents", () => {
    expect(demoCashOutCents("1.10", demoBalanceCents(1.1))).toBe(110);
  });
  it("deducts simulated withdrawals and prevents spending them again", () => {
    const remaining = demoBalanceCents(50, 2000);
    expect(remaining).toBe(3000);
    expect(demoCashOutCents("50", remaining)).toBeNull();
    expect(demoCashOutCents("30", remaining)).toBe(3000);
  });
  it("rejects zero, negative and fractional-cent amounts", () => {
    for (const amount of ["0", "-5", "0.001", "NaN", ""]) {
      expect(demoCashOutCents(amount, 5000)).toBeNull();
    }
  });
});