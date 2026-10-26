import { describe, expect, it } from "vitest";
import { waveInputSchema } from "./mdeko.functions";

describe("deliverable waves", () => {
  const input = { items: [{ id: "carrots", qty: 1 }], lat: -26.025, lng: 28.1873 };
  it("requires a real delivery pin instead of sending invisible waves", () => {
    expect(waveInputSchema.safeParse({ ...input, lat: null, lng: null }).success).toBe(false);
    expect(waveInputSchema.safeParse(input).success).toBe(true);
  });
  it("requires an itemized veggie even when an extra wish is supplied", () => {
    expect(waveInputSchema.safeParse({ ...input, items: [], wish: "Blueberries" }).success).toBe(
      false,
    );
  });
});
