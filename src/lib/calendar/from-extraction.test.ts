import { describe, expect, test } from "vitest";

import type { ExtractedCalendarEvent } from "@/ai/schemas/calendar-extraction";

import { extractedEventsToDrafts } from "./from-extraction";

function event(patch: Partial<ExtractedCalendarEvent>): ExtractedCalendarEvent {
  return {
    typ: "klassenarbeit",
    fach: "Mathematik",
    titel: "Mathearbeit 8.5",
    anzeigename: null,
    datum: "2026-10-09",
    gruppen: ["8.5"],
    hatLernbezug: true,
    hinweis: null,
    confidence: "hoch",
    ...patch,
  };
}

describe("extractedEventsToDrafts", () => {
  test("bildet die Felder ab und trimmt Titel/Anzeigename/Hinweis", () => {
    const drafts = extractedEventsToDrafts([
      event({ titel: "  Mathearbeit 8.5  ", anzeigename: " Mathe Nr. 1 ", hinweis: "  " }),
    ]);
    expect(drafts).toEqual([
      {
        type: "klassenarbeit",
        subjectGuess: "Mathematik",
        title: "Mathearbeit 8.5",
        displayName: "Mathe Nr. 1",
        date: "2026-10-09",
        groups: ["8.5"],
        relevant: true,
        confidence: "hoch",
        note: null, // nur Leerraum → null, kein leerer Hinweis
      },
    ]);
  });

  test("relevant trägt nur die Lernbezug-Hälfte, nicht den Gruppenabgleich (ADR 0016 D3)", () => {
    // Eine Zeile, die eine fremde Klasse betrifft, bleibt trotzdem
    // `relevant: true` – ob sie zum Kind passt, entscheidet der Aufrufer
    // separat über `matchesOwnGroups()`.
    const [drei] = extractedEventsToDrafts([
      event({ gruppen: ["8.1", "8.2"], hatLernbezug: true }),
    ]);
    expect(drei!.relevant).toBe(true);

    const [ohneLernbezug] = extractedEventsToDrafts([
      event({ typ: "sonstiges", hatLernbezug: false }),
    ]);
    expect(ohneLernbezug!.relevant).toBe(false);
  });

  test("Blocker haben kein Fach und meist keine Gruppen", () => {
    const [blocker] = extractedEventsToDrafts([
      event({
        typ: "blocker",
        fach: null,
        titel: "Herbstferien",
        gruppen: [],
        hinweis: "Enddatum fehlt in der Quelle",
      }),
    ]);
    expect(blocker!.type).toBe("blocker");
    expect(blocker!.subjectGuess).toBeNull();
    expect(blocker!.groups).toEqual([]);
    expect(blocker!.note).toBe("Enddatum fehlt in der Quelle");
  });

  test("eine leere Liste bleibt leer", () => {
    expect(extractedEventsToDrafts([])).toEqual([]);
  });
});
