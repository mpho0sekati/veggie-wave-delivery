import { describe, expect, it } from "vitest";
import { discoveryBox } from "./use-marketplace";
import { withBackoff } from "./momo.server";

describe("scale guards", () => {
  it("discovery box covers ~6 km around the buyer", () => {
    const b = discoveryBox({ lat: -26.1, lng: 28.1 });
    expect((b.maxLat - b.minLat) * 111).toBeCloseTo(12, 0);
  });
  it("retries MoMo throttling then stops at 3 attempts", async () => {
    let n = 0;
    const res = await withBackoff(async () => (n++, new Response(null, { status: 429 })), {
      baseMs: 1,
    });
    expect(n).toBe(3);
    expect(res.status).toBe(429);
  });
  it("does not retry a successful request", async () => {
    let n = 0;
    await withBackoff(async () => (n++, new Response(null, { status: 202 })), { baseMs: 1 });
    expect(n).toBe(1);
  });
});
