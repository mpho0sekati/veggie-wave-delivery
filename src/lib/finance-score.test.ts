import { describe, expect, it } from "vitest";
import { computeCommunityScore } from "./finance-score";
import { summarizeTraderLedger } from "./trader-finance";

describe("score follows verified sale activity", () => {
  const now = new Date("2026-10-25T15:32:00Z");
  const settlement = {
    order_id: "order",
    payment_id: "payment",
    net: 22,
    status: "pending",
    created_at: now.toISOString(),
  };

  it("a pending MoMo request earns no sale or active points", () => {
    const ledger = summarizeTraderLedger(
      [settlement],
      [{ id: "payment", provider: "mtn-momo", status: "pending" }],
      now,
    );
    expect(computeCommunityScore(ledger.settledCount, 0, ledger.hasRecentSale, 0, 500).total).toBe(0);
  });

  it("verified MoMo payment updates sale, payment and activity points", () => {
    const ledger = summarizeTraderLedger(
      [settlement],
      [{ id: "payment", provider: "mtn-momo", status: "successful" }],
      now,
    );
    const score = computeCommunityScore(ledger.settledCount, 1, ledger.hasRecentSale, 1.1, 500);
    expect(score.orderVolumePts).toBe(1);
    expect(score.paymentReliabilityPts).toBe(30);
    expect(score.activityConsistencyPts).toBe(20);
    expect(score.total).toBe(51);
  });

  it("savings progress changes points using the current saved goal", () => {
    expect(computeCommunityScore(1, 1, true, 250, 500).savingsBehaviourPts).toBe(10);
    expect(computeCommunityScore(1, 1, true, 500, 500).savingsBehaviourPts).toBe(20);
  });

  it("inactivity removes activity points without removing recorded sales", () => {
    expect(computeCommunityScore(1, 1, false, 0, 500).total).toBe(31);
  });
});