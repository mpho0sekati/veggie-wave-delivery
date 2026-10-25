export type BuyerJourneyStatus = "waving" | "accepted" | "delivering" | "delivered" | "paid";

export function buyerJourneyStep(hasItems: boolean, status?: BuyerJourneyStatus): number {
  if (status === "paid") return 4;
  if (status === "delivered") return 3;
  if (status === "accepted" || status === "delivering") return 2;
  if (status === "waving" || hasItems) return 1;
  return 0;
}

export function traderJourneyStep(
  hasStock: boolean,
  online: boolean,
  orderStatus?: string,
): number {
  if (orderStatus === "delivered" || orderStatus === "completed") return 4;
  if (orderStatus) return 3;
  if (!hasStock) return 0;
  return online ? 2 : 1;
}
