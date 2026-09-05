import { describe, expect, it } from "vitest";
import { DEFAULT_GRADE_SCALE, percentToGrade, pointsToPercent } from "./grades";

describe("percentToGrade", () => {
  it("mappt Grenzwerte auf die richtige Note", () => {
    expect(percentToGrade(100)).toBe(1);
    expect(percentToGrade(92)).toBe(1);
    expect(percentToGrade(91.9)).toBe(2);
    expect(percentToGrade(50)).toBe(4);
    expect(percentToGrade(49.9)).toBe(5);
    expect(percentToGrade(0)).toBe(6);
  });

  it("klemmt Werte außerhalb 0–100", () => {
    expect(percentToGrade(140)).toBe(1);
    expect(percentToGrade(-5)).toBe(6);
  });

  it("nutzt einen eigenen Schlüssel aus dem Schulprofil", () => {
    const strenger = { ...DEFAULT_GRADE_SCALE, 1: 96 };
    expect(percentToGrade(93, strenger)).toBe(2);
  });

  it("lehnt NaN ab", () => {
    expect(() => percentToGrade(Number.NaN)).toThrow(RangeError);
  });
});

describe("pointsToPercent", () => {
  it("rundet auf eine Nachkommastelle", () => {
    expect(pointsToPercent(23, 30)).toBe(76.7);
  });
  it("lehnt 0 Maximalpunkte ab", () => {
    expect(() => pointsToPercent(1, 0)).toThrow(RangeError);
  });
});
