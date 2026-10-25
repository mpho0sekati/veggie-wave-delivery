import { describe, expect, it } from "vitest";
import { isValidPin, normaliseSaCell } from "./phone-auth";

describe("Cell and PIN sign-in rules", () => {
  it("accepts the same SA cell in local and international form", () => {
    expect(normaliseSaCell("082 123 4567")).toBe("27821234567");
    expect(normaliseSaCell("+27 82 123 4567")).toBe("27821234567");
    expect(normaliseSaCell("+1 555 123 4567")).toBeNull();
  });
  it("requires exactly four numeric PIN digits", () => {
    expect(isValidPin("1234")).toBe(true);
    for (const value of ["123", "12345", "abcd", "12 4", ""]) expect(isValidPin(value)).toBe(false);
  });
});