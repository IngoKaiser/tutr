import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { icsToDrafts } from "./ics-import";

const fixtureIcs = readFileSync(
  join(import.meta.dirname, "../../../docs/fixtures/beispiel-import-klausurplan.ics"),
  "utf-8",
);

const FAECHER = ["Französisch", "Englisch", "Deutsch", "Mathematik", "Biologie"];

describe("icsToDrafts", () => {
  test("ohne VEVENT gibt es eine Fehlermeldung, keine stille leere Liste", () => {
    const result = icsToDrafts("BEGIN:VCALENDAR\nEND:VCALENDAR", FAECHER);
    expect(result.drafts).toEqual([]);
    expect(result.fehler).toHaveLength(1);
  });

  test("liest die Beispiel-Fixture", () => {
    const result = icsToDrafts(fixtureIcs, FAECHER);
    expect(result.fehler).toEqual([]);
    expect(result.drafts).toHaveLength(5);

    const frz = result.drafts.find((d) => d.date === "2026-09-25");
    expect(frz).toMatchObject({
      type: "klassenarbeit",
      subjectGuess: "Französisch",
      note: "Jahrgangsarbeit",
      relevant: true,
    });

    // Fach steckt nur im SUMMARY-Freitext ("Klassenarbeit Eng: …") – Abkürzung erkannt (ADR 0016 D4).
    const eng = result.drafts.find((d) => d.date === "2026-09-30");
    expect(eng?.subjectGuess).toBe("Englisch");

    const blocker = result.drafts.filter((d) => d.type === "blocker");
    expect(blocker.map((b) => b.title).sort()).toEqual(["Herbstferien", "Projektwoche"]);

    // Escaping (\,) in DESCRIPTION wird entschärft.
    const tdot = result.drafts.find((d) => d.date === "2027-01-21");
    expect(tdot).toMatchObject({
      type: "sonstiges",
      relevant: false,
      note: "Schulveranstaltung, kein Lernbezug",
    });
  });

  test("Zeilenfaltung (RFC 5545) wird rückgängig gemacht", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260925",
      "SUMMARY:Klassenarbeit Mathematik: Ein sehr langer Titel, der",
      "  über zwei Zeilen umgebrochen wurde",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const result = icsToDrafts(ics, FAECHER);
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.title).toBe(
      "Klassenarbeit Mathematik: Ein sehr langer Titel, der über zwei Zeilen umgebrochen wurde",
    );
  });

  test("Termin ohne Datum oder SUMMARY zählt als Fehler, nicht als stiller Verlust", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "SUMMARY:Ohne Datum",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const result = icsToDrafts(ics, FAECHER);
    expect(result.drafts).toEqual([]);
    expect(result.fehler).toHaveLength(1);
  });
});
