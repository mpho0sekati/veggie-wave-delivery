import { describe, it, expect } from "vitest";
import { waveView } from "./wave-view";
import type { Order, Wave } from "./mdeko.functions";
const wave = {
  id: "wave",
  items: [{ id: "carrots", qty: 1 }],
  wish: "",
  note: "",
  created_at: "2026-10-23T22:00:00Z",
  trader_id: null,
} as unknown as Wave;
const order = {
  id: "order",
  trader_id: "seller",
  amount: 22,
  payment_method: "cash",
  status: "delivering",
  cancelled_at: null,
} as unknown as Order;
describe("shared order readback", () => {
  it("keeps an approved prepaid order active until delivery and confirmation", () => {
    expect(
      waveView(wave, { ...order, payment_method: "mtn-momo", status: "preparing" }).status,
    ).toBe("accepted");
    expect(
      waveView(wave, { ...order, payment_method: "mtn-momo", status: "delivered" }).status,
    ).toBe("delivered");
    expect(
      waveView(wave, { ...order, payment_method: "mtn-momo", status: "completed" }).status,
    ).toBe("paid");
  });
  it("restores the buyer landmark for the trader after refresh", () => {
    expect(waveView({ ...wave, note: "Blue spaza gate" }, order).landmark).toBe("Blue spaza gate");
  });
  it("keeps the seller assignment and real order id after acceptance", () => {
    const view = waveView(wave, order);
    expect(view.runnerId).toBe("seller");
    expect(view.orderId).toBe("order");
    expect(view.total).toBe(22);
  });
  it("shows delivery rather than reverting to waving", () =>
    expect(waveView(wave, order).status).toBe("delivering"));
  it("reads cash completion from the saved order", () => {
    const view = waveView(wave, { ...order, status: "completed" });
    expect(view.status).toBe("paid");
    expect(view.paidWith).toBe("cash");
  });
  it("does not display cancelled orders as active", () =>
    expect(waveView(wave, { ...order, cancelled_at: "2026-10-23T22:00:00Z" }).status).toBe(
      "cancelled",
    ));
});
