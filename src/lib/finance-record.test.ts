import { describe, expect, it } from "vitest";
import { createLenderRecordCsv } from "./finance-record";
import type { ExportRecord } from "./finance.functions";

const record: ExportRecord = {
  userId: "test-user", name: "Trader", memberSince: "2026-10-01", totalOrders: 1,
  totalTraded: 15, momoSuccessRate: 1, savingsBalance: 0.75,
  exportedAt: "2026-10-26", format: "banklink-compatible",
  transactions: [{ date: "2026-10-26", type: "credit", description: "Veggie sale", amount: 15, reference: "MDEKO-1" }],
};

describe("lender record export", () => {
  it("exports the saved order amounts without creating a bank submission", () => {
    const csv = createLenderRecordCsv(record, null);
    expect(csv).toContain('"Recorded order value (ZAR)","15"');
    expect(csv).toContain('"Recorded savings (ZAR)","0.75"');
    expect(csv).toContain('"For your own lender review; not sent to FNB"');
    expect(csv).toContain('"2026-10-26","Sale","Veggie sale","15","MDEKO-1"');
  });
  it("does not invent a record when no account data is available", () => {
    expect(createLenderRecordCsv(null, null)).toBeNull();
  });
  it("neutralizes spreadsheet formulas in transaction fields", () => {
    const csv = createLenderRecordCsv({ ...record, transactions: [{ ...record.transactions[0], description: '=HYPERLINK("bad")' }] }, null);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  });
});