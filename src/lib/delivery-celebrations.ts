export type CelebrationMoment = "arrival" | "confirmation";
export type DeliverySnapshot = {
  id: string;
  status: string;
  delivered_at: string | null;
  cancelled_at: string | null;
};

export function hasArrived(order: DeliverySnapshot | null | undefined): boolean {
  return Boolean(
    order && !order.cancelled_at &&
    (order.delivered_at || order.status === "delivered" || order.status === "completed"),
  );
}

/** Presentation-only gate: never changes order or payment state. */
export class DeliveryCelebrationGate {
  private orders = new Map<string, Set<CelebrationMoment>>();

  claim(id: string, moment: CelebrationMoment): boolean {
    const seen = this.orders.get(id) ?? new Set<CelebrationMoment>();
    this.orders.set(id, seen);
    if (seen.has(moment)) return false;
    seen.add(moment);
    return true;
  }

  observe(order: DeliverySnapshot): CelebrationMoment[] {
    if (order.cancelled_at) return [];
    const arrived = hasArrived(order);
    const confirmed = order.status === "completed";
    // Existing history on opening is a baseline, not a new delivery event.
    if (!this.orders.has(order.id)) {
      this.orders.set(order.id, new Set([
        ...(arrived ? ["arrival" as const] : []),
        ...(confirmed ? ["confirmation" as const] : []),
      ]));
      return [];
    }
    const moments: CelebrationMoment[] = [];
    if (arrived && this.claim(order.id, "arrival")) moments.push("arrival");
    if (confirmed && this.claim(order.id, "confirmation")) moments.push("confirmation");
    return moments;
  }
}