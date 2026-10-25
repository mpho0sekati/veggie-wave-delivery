import { describe, expect, it } from "vitest";
import { summarizeTraderLedger } from "./trader-finance";

describe("trader money ledger", () => {
  const now = new Date("2026-10-25T13:21:00Z");
  const payments = [
    { id: "cash", provider: "cash", status: "successful" },
    { id: "momo", provider: "mtn-momo", status: "successful" },
    { id: "waiting", provider: "mtn-momo", status: "pending" },
  ];
  it("counts confirmed cash and MoMo sales, not waiting payments", () => {
    const result = summarizeTraderLedger(
      [
        {
          order_id: "1",
          payment_id: "cash",
          net: 100,
          status: "settled",
          created_at: now.toISOString(),
        },
        {
          order_id: "2",
          payment_id: "momo",
          net: 40,
          status: "settled",
          created_at: now.toISOString(),
        },
        {
          order_id: "3",
          payment_id: "waiting",
          net: 90,
          status: "pending",
          created_at: now.toISOString(),
        },
      ],
      payments,
      now,
    );
    expect(result.settledEarnings).toBe(140);
    expect(result.cashSales).toBe(100);
    expect(result.momoSales).toBe(40);
    expect(result.settledCount).toBe(2);
    expect(result.pendingEarnings).toBe(90);
  });
  it("uses Johannesburg midnight for today's sales", () => {
    const result = summarizeTraderLedger(
      [
        {
          order_id: "1",
          payment_id: "cash",
          net: 100,
          status: "settled",
          created_at: "2026-10-24T22:30:00Z",
        },
        {
          order_id: "2",
          payment_id: "cash",
          net: 30,
          status: "settled",
          created_at: "2026-10-24T21:30:00Z",
        },
      ],
      payments,
      now,
    );
    expect(result.todayEarnings).toBe(100);
    expect(result.weekEarnings).toBe(130);
  });
  it("records verified MoMo revenue separately from final settlement", () => {
    const result = summarizeTraderLedger(
      [{ order_id: "1", payment_id: "momo", net: 95, status: "pending", created_at: now.toISOString() }],
      payments,
      now,
    );
    expect(result.recordedEarnings).toBe(95);
    expect(result.momoSales).toBe(95);
    expect(result.settledEarnings).toBe(0);
    expect(result.pendingEarnings).toBe(95);
  });
  it("does not treat an unverified settlement as earnings", () => {
    const result = summarizeTraderLedger(
      [
        {
          order_id: "1",
          payment_id: "waiting",
          net: 100,
          status: "settled",
          created_at: now.toISOString(),
        },
      ],
      payments,
      now,
    );
    expect(result.settledEarnings).toBe(0);
    expect(result.settledCount).toBe(0);
    expect(result.hasRecentSale).toBe(false);
  });
});
