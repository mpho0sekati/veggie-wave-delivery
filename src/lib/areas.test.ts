import { describe, expect, it } from "vitest";
import { AREAS, searchAreas } from "./areas";

describe("areas", () => {
  it("covers Gauteng, Western Cape and KZN", () => {
    expect(new Set(AREAS.map((a) => a.province)).size).toBe(3);
  });
  it("finds Soweto by name and KZN townships by province", () => {
    expect(searchAreas("sow").map((a) => a.name)).toEqual(["Soweto"]);
    expect(searchAreas("kwazulu").map((a) => a.name)).toContain("Umlazi");
  });
});
