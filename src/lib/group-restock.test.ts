import { describe, expect, it } from "vitest";
import { estimateGroupRestock } from "./group-restock";

describe("group restock", () => {
  it("R400/day saves R240 on stock plus R600 transport a week", () => {
    expect(estimateGroupRestock(400, 100).weeklySaving).toBe(840);
  });
  it("100 traders at R400/day pool about R960k a month", () => {
    expect(estimateGroupRestock(400, 100).groupMonthlyOrder).toBe(960000);
  });
  it("no spend means no saving", () => {
    expect(estimateGroupRestock(0, 100).weeklySaving).toBe(0);
  });
});
