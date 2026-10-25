import { describe, expect, it } from "vitest";
import { buyerJourneyStep, traderJourneyStep } from "./journey-progress";

describe("buyer journey", () => {
  it("advances from selection to waving after adding produce", () => {
    expect(buyerJourneyStep(false)).toBe(0);
    expect(buyerJourneyStep(true)).toBe(1);
  });
  it("waits for acceptance before showing delivery as current", () => {
    expect(buyerJourneyStep(true, "waving")).toBe(1);
    expect(buyerJourneyStep(true, "accepted")).toBe(2);
    expect(buyerJourneyStep(true, "delivering")).toBe(2);
  });
  it("keeps receipt confirmation current until the order is closed", () => {
    expect(buyerJourneyStep(false, "delivered")).toBe(3);
    expect(buyerJourneyStep(false, "paid")).toBe(4);
  });
});

describe("trader journey", () => {
  it("keeps stock current even when an empty stall is online", () => {
    expect(traderJourneyStep(false, true)).toBe(0);
  });
  it("advances to going online only after stock is saved", () => {
    expect(traderJourneyStep(true, false)).toBe(1);
    expect(traderJourneyStep(true, true)).toBe(2);
  });
  it("preserves delivery progress even when the trader goes offline", () => {
    expect(traderJourneyStep(true, false, "accepted")).toBe(3);
    expect(traderJourneyStep(true, false, "delivering")).toBe(3);
    expect(traderJourneyStep(true, false, "delivered")).toBe(4);
  });
});
