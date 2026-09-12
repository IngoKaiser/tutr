import { describe, expect, it } from "vitest";

import { calendarExtractionSchema } from "./calendar-extraction";

const ARBEIT = {
  typ: "klassenarbeit" as const,
  fach: "Mathematik",
  titel: "Mathearbeit 8.5",
  anzeigename: null,
  datum: "2026-10-09",
  gruppen: ["8.5"],
  hatLernbezug: true,
  hinweis: null,
  confidence: "hoch" as const,
};

describe("calendarExtractionSchema", () => {
  it("lässt jeden übergebenen Fachnamen und „unklar“ für das Fach durch", () => {
    const schema = calendarExtractionSchema(["Mathematik", "Französisch"]);
    expect(schema.safeParse({ events: [ARBEIT] }).success).toBe(true);
    expect(schema.safeParse({ events: [{ ...ARBEIT, fach: "unklar" }] }).success).toBe(true);
  });

  it("lehnt einen Fachnamen ab, der nicht in der Liste stand – die Auswahl ist geschlossen", () => {
    const schema = calendarExtractionSchema(["Mathematik"]);
    expect(schema.safeParse({ events: [{ ...ARBEIT, fach: "Chemie" }] }).success).toBe(false);
  });

  it("erlaubt fach: null für Blocker", () => {
    const schema = calendarExtractionSchema(["Mathematik"]);
    const blocker = {
      ...ARBEIT,
      typ: "blocker" as const,
      fach: null,
      titel: "Herbstferien",
      gruppen: [],
      hatLernbezug: true,
    };
    expect(schema.safeParse({ events: [blocker] }).success).toBe(true);
  });

  it("funktioniert auch mit einer leeren Fächerliste – dann bleibt beim Fach nur „unklar“ oder null", () => {
    const schema = calendarExtractionSchema([]);
    expect(schema.safeParse({ events: [{ ...ARBEIT, fach: "unklar" }] }).success).toBe(true);
    expect(schema.safeParse({ events: [{ ...ARBEIT, fach: "irgendwas" }] }).success).toBe(false);
  });

  it("verlangt jedes Pflichtfeld – ein unvollständiges Ereignis scheitert", () => {
    const schema = calendarExtractionSchema(["Mathematik"]);
    const ohneLernbezug: Partial<typeof ARBEIT> = { ...ARBEIT };
    delete ohneLernbezug.hatLernbezug;
    expect(schema.safeParse({ events: [ohneLernbezug] }).success).toBe(false);
  });

  it("eine leere Ereignisliste ist gültig (nichts erkannt)", () => {
    const schema = calendarExtractionSchema(["Mathematik"]);
    expect(schema.safeParse({ events: [] }).success).toBe(true);
  });
});
