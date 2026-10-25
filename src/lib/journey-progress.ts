import type { WaveStatus } from "./veggie-store";

export function buyerJourneyStep(hasItems: boolean, status?: WaveStatus): number {
  if (status === "cancelled" || status === "failed" || status === "refunded") return 0;
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
