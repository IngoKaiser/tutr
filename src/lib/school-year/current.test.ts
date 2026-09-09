import { describe, expect, it } from "vitest";

import { currentSchoolYear } from "./current";

describe("currentSchoolYear", () => {
  it("mitten im Schuljahr: 9. September 2026 gehört zu 2026/27", () => {
    expect(currentSchoolYear(new Date("2026-09-09T12:00:00Z"))).toEqual({
      label: "2026/27",
      startDate: "2026-08-01",
      endDate: "2027-07-31",
    });
  });

  it("am 31. Juli gehört das Datum noch zum alten Schuljahr", () => {
    expect(currentSchoolYear(new Date("2027-07-31T23:59:59Z"))).toEqual({
      label: "2026/27",
      startDate: "2026-08-01",
      endDate: "2027-07-31",
    });
  });

  it("am 1. August beginnt schon das neue Schuljahr", () => {
    expect(currentSchoolYear(new Date("2027-08-01T00:00:00Z"))).toEqual({
      label: "2027/28",
      startDate: "2027-08-01",
      endDate: "2028-07-31",
    });
  });

  it("rechnet über einen Jahrhundertwechsel des Folgejahres richtig (zweistellig, mit führender Null)", () => {
    expect(currentSchoolYear(new Date("2099-09-01T00:00:00Z"))).toEqual({
      label: "2099/00",
      startDate: "2099-08-01",
      endDate: "2100-07-31",
    });
  });
});
