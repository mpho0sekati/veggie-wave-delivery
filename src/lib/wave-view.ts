import type { Order, Wave } from "./mdeko.functions";
import type { WaveRequest } from "./veggie-store";
export function waveView(wave: Wave, order?: Order | null): WaveRequest {
  const items = Array.isArray(wave.items)
    ? wave.items.flatMap((line) => {
        if (
          !line ||
          typeof line !== "object" ||
          Array.isArray(line) ||
          typeof line.id !== "string" ||
          typeof line.qty !== "number"
        )
          return [];
        return [{ id: line.id, qty: line.qty }];
      })
    : [];
  return {
    id: wave.id,
    waveId: wave.id,
    orderId: order?.id,
    items,
    wish: wave.wish,
    note: wave.note,
    landmark: wave.note && !/^\d+ items$/.test(wave.note) ? wave.note : undefined,
    total: order ? Number(order.amount) : 0,
    runnerId: order?.trader_id ?? wave.trader_id,
    createdAt: new Date(wave.created_at).getTime(),
    status: order?.cancelled_at
      ? "cancelled"
      : order?.status === "completed"
        ? "paid"
        : order?.status === "delivered"
          ? "delivered"
          : order?.status === "delivering"
            ? "delivering"
            : order
              ? "accepted"
              : wave.status === "accepted"
                ? "accepted"
                : "waving",
    paidWith: order?.payment_method === "cash" ? "cash" : "wave-pay",
  };
}
