import { describe, expect, it } from "vitest";
import { sellerPosition, nearbySellerWaves, wavePinLabel } from "./seller-view";

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

describe("wave pin labels on the trader map", () => {
  const catalog = [
    { id: "tomato", name: "Tomatoes" },
    { id: "spinach", name: "Spinach" },
  ];
  it("lists quantities and catalog names", () => {
    const label = wavePinLabel(
      {
        items: [
          { id: "tomato", qty: 2 },
          { id: "spinach", qty: 1 },
        ],
        wish: null,
      },
      catalog,
    );
    expect(label).toBe("2× Tomatoes, 1× Spinach");
  });
  it("falls back to the wish text, then a generic label", () => {
    expect(wavePinLabel({ items: [], wish: "  blueberries " }, catalog)).toBe("blueberries");
    expect(wavePinLabel({ items: "not-an-array", wish: null }, catalog)).toBe("Veggie request");
  });
  it("skips malformed item lines instead of crashing", () => {
    const label = wavePinLabel(
      { items: [{ id: "tomato" }, null, { id: "tomato", qty: 3 }], wish: null },
      catalog,
    );
    expect(label).toBe("3× Tomatoes");
  });
});
