import { describe, expect, it } from "vitest";
import { savingsFor, toPaymentStatus } from "./payment-status";

describe("payment status", () => {
  it("only SUCCESSFUL marks a payment paid", () => {
    expect(toPaymentStatus("SUCCESSFUL")).toBe("successful");
    expect(toPaymentStatus("PENDING")).toBe("pending");
    expect(toPaymentStatus(null)).toBe("pending");
    expect(toPaymentStatus("successful")).toBe("pending");
  });
  it("failed outcomes are failed", () => {
    expect(toPaymentStatus("FAILED")).toBe("failed");
    expect(toPaymentStatus("REJECTED")).toBe("failed");
  });
});

describe("5% savings", () => {
  it("saves 5% of the settled amount", () => {
    expect(savingsFor(100)).toBe(5);
    expect(savingsFor(45.5)).toBe(2.28);
  });
  it("saves nothing for zero or invalid amounts", () => {
    expect(savingsFor(0)).toBe(0);
    expect(savingsFor(-10)).toBe(0);
    expect(savingsFor(Number.NaN)).toBe(0);
  });
});
