export type LedgerSettlement = {
  order_id: string;
  net: number | string;
  status: string;
  created_at: string;
  payment_id: string;
};

/** Confirmed settlements, not order totals or pending payments, are earnings. */
export function summarizeTraderLedger(
  settlements: LedgerSettlement[],
  payments: { id: string; provider: string; status: string }[],
  now = new Date(),
) {
  const byId = new Map(payments.map((payment) => [payment.id, payment]));
  const day = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(date);
  const today = day(now);
  const weekStart = now.getTime() - 7 * 864e5;
  const paid = settlements.filter(
    (settlement) => (settlement.status === "settled" || settlement.status === "pending") &&
      byId.get(settlement.payment_id)?.status === "successful",
  );
  const sum = (rows: LedgerSettlement[]) =>
    Math.round(rows.reduce((total, row) => total + Number(row.net), 0) * 100) / 100;
  return {
    todayEarnings: sum(paid.filter((row) => day(new Date(row.created_at)) === today)),
    weekEarnings: sum(paid.filter((row) => new Date(row.created_at).getTime() >= weekStart)),
    recordedEarnings: sum(paid),
    settledEarnings: sum(paid.filter((row) => row.status === "settled")),
    pendingEarnings: sum(settlements.filter((row) => row.status === "pending")),
    momoSales: sum(paid.filter((row) => byId.get(row.payment_id)?.provider === "mtn-momo")),
    cashSales: sum(paid.filter((row) => byId.get(row.payment_id)?.provider === "cash")),
    settledCount: new Set(paid.map((row) => row.order_id)).size,
    hasRecentSale: paid.some((row) => new Date(row.created_at).getTime() >= now.getTime() - 30 * 864e5),
  };
}