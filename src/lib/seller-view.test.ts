import { describe, expect, it } from "vitest";
import { sellerPosition, nearbySellerWaves } from "./seller-view";

describe("seller location and incoming waves", () => {
  const saved = { lat: -26.0407868, lng: 28.1751337 };
  it("shows nearby requests using a saved location before GPS responds", () => {
    const position = sellerPosition(null, saved);
    const waves = [
      { id: "near", lat: -26.038712, lng: 28.175175 },
      { id: "far", lat: -26.2041, lng: 28.0473 },
    ];
    expect(nearbySellerWaves(waves, position).map((wave) => wave.id)).toEqual(["near"]);
  });
  it("prefers the new device location over saved coordinates", () => {
    const live = { lat: -26.2041, lng: 28.0473 };
    expect(sellerPosition(live, saved)).toEqual(live);
  });
  it("never invents a location for a new seller", () => {
    expect(sellerPosition(null, { lat: null, lng: null })).toBeNull();
    expect(nearbySellerWaves([{ lat: -26.038712, lng: 28.175175 }], null)).toEqual([]);
  });
});
