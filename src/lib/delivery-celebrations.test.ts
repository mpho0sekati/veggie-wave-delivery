import { describe, expect, it } from "vitest";
import { DeliveryCelebrationGate, hasArrived } from "./delivery-celebrations";

const delivery = { id: "order-1", status: "delivering", delivered_at: null, cancelled_at: null };
describe("delivery celebrations", () => {
  it("celebrates the trader marking delivered once despite polling", () => {
    const gate = new DeliveryCelebrationGate();
    gate.observe(delivery);
    const arrived = { ...delivery, status: "delivered" };
    expect(gate.observe(arrived)).toEqual(["arrival"]);
    expect(gate.observe(arrived)).toEqual([]);
  });
  it("celebrates confirmed receipt separately and never repeats after readback", () => {
    const gate = new DeliveryCelebrationGate();
    gate.observe(delivery);
    expect(gate.claim(delivery.id, "confirmation")).toBe(true);
    expect(gate.claim(delivery.id, "confirmation")).toBe(false);
    expect(gate.observe({ ...delivery, status: "completed" })).toEqual(["arrival"]);
  });
  it("celebrates completion from the other phone", () => {
    const gate = new DeliveryCelebrationGate();
    gate.observe({ ...delivery, status: "delivered" });
    expect(gate.observe({ ...delivery, status: "completed" })).toEqual(["confirmation"]);
  });
  it("does not replay completed history when reopening", () => {
    const gate = new DeliveryCelebrationGate();
    expect(gate.observe({ ...delivery, status: "completed" })).toEqual([]);
  });
  it("does not clock the pin for a prepaid or cancelled delivery", () => {
    expect(hasArrived({ ...delivery, status: "accepted" })).toBe(false);
    expect(hasArrived({ ...delivery, status: "delivered", cancelled_at: "2026-10-25" })).toBe(false);
    expect(hasArrived({ ...delivery, status: "delivered" })).toBe(true);
  });
  it("gives each new order its own two moments", () => {
    const gate = new DeliveryCelebrationGate();
    gate.observe(delivery);
    gate.observe({ ...delivery, id: "order-2" });
    expect(gate.observe({ ...delivery, status: "completed" })).toEqual(["arrival", "confirmation"]);
    expect(gate.observe({ ...delivery, id: "order-2", status: "completed" })).toEqual(["arrival", "confirmation"]);
  });
});