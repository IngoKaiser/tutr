import { describe, expect, it } from "vitest";

import { countdownLabel, daysUntil, splitByHorizon, type CalendarEvent } from "./upcoming";

const HEUTE = new Date("2026-09-10T09:00:00Z");

function ev(id: string, date: string, status: "geplant" | "abgesagt" = "geplant"): CalendarEvent {
  return {
    id,
    subjectId: "s",
    subjectName: "Mathe",
    type: "klassenarbeit",
    title: id,
    date,
    status,
  };
}

describe("daysUntil", () => {
  it("zählt ganze Tage, unabhängig von der Uhrzeit", () => {
    expect(daysUntil("2026-09-10", HEUTE)).toBe(0);
    expect(daysUntil("2026-09-11", HEUTE)).toBe(1);
    expect(daysUntil("2026-09-25", HEUTE)).toBe(15);
    expect(daysUntil("2026-09-08", HEUTE)).toBe(-2);
  });

  it("rechnet über einen Monatswechsel richtig", () => {
    expect(daysUntil("2026-10-01", HEUTE)).toBe(21);
  });
});

describe("countdownLabel", () => {
  it("benennt die nahen Tage besonders", () => {
    expect(countdownLabel(0)).toBe("heute");
    expect(countdownLabel(1)).toBe("morgen");
    expect(countdownLabel(-1)).toBe("gestern");
  });

  it("zählt sonst in Tagen, vor wie nach", () => {
    expect(countdownLabel(5)).toBe("in 5 Tagen");
    expect(countdownLabel(-3)).toBe("vor 3 Tagen");
  });
});

describe("splitByHorizon", () => {
  it("trennt kommend (4 Wochen), später und vergangen und sortiert jedes", () => {
    const { kommend, spaeter, vergangen } = splitByHorizon(
      [
        ev("b", "2026-09-25"),
        ev("a", "2026-09-12"),
        ev("weit", "2026-11-30"),
        ev("alt", "2026-09-01"),
        ev("aelter", "2026-08-20"),
      ],
      HEUTE,
    );
    expect(kommend.map((e) => e.id)).toEqual(["a", "b"]);
    expect(spaeter.map((e) => e.id)).toEqual(["weit"]);
    // Historie: neueste zuerst.
    expect(vergangen.map((e) => e.id)).toEqual(["alt", "aelter"]);
  });

  it("ein abgesagter Termin ist immer Historie, auch wenn er in der Zukunft liegt", () => {
    const { kommend, vergangen } = splitByHorizon([ev("x", "2026-09-20", "abgesagt")], HEUTE);
    expect(kommend).toHaveLength(0);
    expect(vergangen.map((e) => e.id)).toEqual(["x"]);
  });

  it("die Fenstergröße ist einstellbar", () => {
    const { kommend, spaeter } = splitByHorizon([ev("x", "2026-09-24")], HEUTE, 1);
    expect(kommend).toHaveLength(0);
    expect(spaeter.map((e) => e.id)).toEqual(["x"]);
  });
});
