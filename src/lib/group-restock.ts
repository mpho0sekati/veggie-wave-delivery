// Planning estimates for pooled Joburg Market restocks. Presentation-only: no orders or money move.
export const RESTOCK_ASSUMPTIONS = {
  bulkDiscount: 0.25, // pallet price vs walk-in price
  traderShare: 0.1, // part of spend passed back to the trader
  soloTransportPerTrip: 200, // own shared bakkie to City Deep
  tripsPerWeek: 3,
  mdekoFee: 0.09, // what keeps the pooled bakkie running
} as const;

export function estimateGroupRestock(dailySpend: number, traders: number) {
  const spend = Math.max(0, dailySpend);
  const group = Math.max(1, Math.round(traders));
  const weeklySpend = spend * 6;
  const productSaving = weeklySpend * RESTOCK_ASSUMPTIONS.traderShare;
  const transportSaving =
    RESTOCK_ASSUMPTIONS.soloTransportPerTrip * RESTOCK_ASSUMPTIONS.tripsPerWeek;
  const weeklySaving = spend > 0 ? productSaving + transportSaving : 0;
  return {
    weeklySpend,
    weeklySaving,
    monthlySaving: weeklySaving * 4,
    groupMonthlyOrder: weeklySpend * 4 * group,
    mdekoMonthlyFee: weeklySpend * 4 * group * RESTOCK_ASSUMPTIONS.mdekoFee,
  };
}
