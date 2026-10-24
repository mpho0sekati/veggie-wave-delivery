import { describe, expect, it } from "vitest";
import { setBuyerLocation } from "./veggie-store";

describe("independent map locations", () => {
  it("does not move traders when the buyer moves", () => {
    const key = "veggieguy-state-v2";
    const runners = [{ id: "trader", lat: -33.9, lng: 18.4 }];
    localStorage.setItem(
      key,
      JSON.stringify({
        buyer: { lat: -33.9249, lng: 18.4241, located: false },
        runners,
      }),
    );
    setBuyerLocation({ lat: -26.2041, lng: 28.0473 });
    const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
    expect(saved.buyer).toEqual({ lat: -26.2041, lng: 28.0473, located: true });
    expect(saved.runners).toEqual(runners);
    localStorage.removeItem(key);
  });
});
