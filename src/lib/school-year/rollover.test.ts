import { describe, expect, it } from "vitest";

import { suggestNextSchoolYear } from "./rollover";

describe("suggestNextSchoolYear", () => {
  it("schlägt das Folgejahr mit Jahrgang +1 vor, Klasse unverändert", () => {
    const next = suggestNextSchoolYear({
      startDate: "2026-08-01",
      gradeLevel: 8,
      className: "8b",
    });
    expect(next).toEqual({
      label: "2027/28",
      startDate: "2027-08-01",
      endDate: "2028-07-31",
      gradeLevel: 9,
      className: "8b",
    });
  });

  it("deckelt den Jahrgang bei 13", () => {
    const next = suggestNextSchoolYear({
      startDate: "2026-08-01",
      gradeLevel: 13,
      className: null,
    });
    expect(next.gradeLevel).toBe(13);
  });

  it("lässt eine fehlende Klasse fehlend", () => {
    const next = suggestNextSchoolYear({ startDate: "2026-08-01", gradeLevel: 5, className: null });
    expect(next.className).toBeNull();
  });
});
