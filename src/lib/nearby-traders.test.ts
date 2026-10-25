import { describe, expect, it } from "vitest";
import { nearbyTraders } from "./nearby-traders";
import type { Runner } from "./veggie-data";

const buyer = { lat: -26.2041, lng: 28.0473, located: true };
const trader: Runner = {
  id: "near",
  name: "Trader",
  lat: -26.205,
  lng: 28.048,
  online: true,
  rating: 5,
  earnings: 0,
  stock: [],
};

describe("nearby traders at real locations", () => {
  it("preserves a nearby trader's actual coordinates", () => {
    const result = nearbyTraders([trader], buyer);
    expect(result).toEqual([trader]);
    expect(result[0]).toBe(trader);
    expect(result[0]?.lat).toBe(-26.205);
    expect(result[0]?.lng).toBe(28.048);
  });

  it("does not bring distant traders near the buyer", () => {
    const distant = { ...trader, id: "far", lat: -33.9249, lng: 18.4241 };
    expect(nearbyTraders([distant, trader], buyer).map((r) => r.id)).toEqual(["near"]);
    expect(distant.lat).toBe(-33.9249);
    expect(distant.lng).toBe(18.4241);
  });

  it("does not show offline traders as nearby", () => {
    expect(nearbyTraders([{ ...trader, online: false }], buyer)).toEqual([]);
  });

  it("does not discover traders around the default unlocated pin", () => {
    expect(nearbyTraders([trader], { ...buyer, located: false })).toEqual([]);
  });

  it("drops invalid coordinates without changing valid coordinates", () => {
    expect(
      nearbyTraders([{ ...trader, lat: NaN }, { ...trader, lng: 181 }, trader], buyer),
    ).toEqual([trader]);
  });
});
