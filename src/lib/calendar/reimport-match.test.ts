import { describe, expect, test } from "vitest";

import {
  matchReimport,
  type ExistingCalendarEvent,
  type ReimportCandidate,
} from "./reimport-match";
import fixture from "../../../docs/fixtures/beispiel-import-klausurplan.json";

/**
 * Nutzt die reale Fixture (`docs/fixtures/beispiel-import-klausurplan.json`)
 * als Grundlage, wie ADR 0016 D8 es vorsieht. Die Fixture kennt keine
 * `subjectId` – für diesen reinen Test genügt der Fachname als Ersatz,
 * `matchReimport()` vergleicht ihn nur auf Gleichheit, nie auf Bedeutung.
 */
const klassenarbeiten = fixture.events.filter(
  (event): event is typeof event & { fach: string } => event.typ === "klassenarbeit",
);

function alsKandidat(event: (typeof klassenarbeiten)[number]): ReimportCandidate {
  return { subjectId: event.fach, groups: event.gruppen, date: event.datum, title: event.titel };
}

describe("matchReimport", () => {
  test("Ersteinlese: ohne bestehende Termine ist jeder Entwurf 'neu'", () => {
    const result = matchReimport([], klassenarbeiten.map(alsKandidat));
    expect(result.drafts.every((d) => d.bucket === "neu")).toBe(true);
    expect(result.entfallen).toEqual([]);
  });

  test("Re-Import: unverändert, verschoben, neu und entfallen gleichzeitig", () => {
    const existing: ExistingCalendarEvent[] = klassenarbeiten.map((event, i) => ({
      id: `event-${i}`,
      subjectId: event.fach,
      groups: event.gruppen,
      date: event.datum,
      title: event.titel,
    }));

    const mathearbeit1 = existing.find(
      (e) => e.title === "Mathearbeit 8.5" && e.date === "2026-10-09",
    )!;
    const chemie = existing.find((e) => e.title === "Chemie")!;

    // Die Schule verschiebt die erste Mathearbeit um drei Tage (innerhalb ±7),
    // sagt die Chemiearbeit ganz ab (fehlt im neuen Plan) und kündigt eine
    // zusätzliche Arbeit an – der Rest bleibt wie er war.
    const drafts: ReimportCandidate[] = existing
      .filter((e) => e.id !== chemie.id)
      .map((e) =>
        e.id === mathearbeit1.id
          ? { subjectId: e.subjectId, groups: e.groups!, date: "2026-10-12", title: e.title }
          : { subjectId: e.subjectId, groups: e.groups!, date: e.date, title: e.title },
      );
    drafts.push({ subjectId: "Kunst", groups: ["8.5"], date: "2026-10-20", title: "Kunstmappe" });

    const result = matchReimport(existing, drafts);

    const nachTitel = (titel: string) =>
      result.drafts.find((d) => drafts[d.index]!.title === titel)!;

    expect(nachTitel("Mathearbeit 8.5").bucket).toBe("verschoben");
    expect(nachTitel("Kunstmappe").bucket).toBe("neu");
    expect(result.drafts.filter((d) => d.bucket === "unveraendert").length).toBe(
      existing.length - 2 /* Mathearbeit 8.5 verschoben, Chemie entfallen */,
    );
    expect(result.entfallen).toEqual([chemie.id]);
  });

  test("andere Gruppe gilt als anderer Termin, kein Update (ADR 0016 D7)", () => {
    const existing: ExistingCalendarEvent[] = [
      {
        id: "a",
        subjectId: "Mathematik",
        groups: ["8.5"],
        date: "2026-10-09",
        title: "Mathearbeit",
      },
    ];
    const drafts: ReimportCandidate[] = [
      { subjectId: "Mathematik", groups: ["8.1"], date: "2026-10-09", title: "Mathearbeit" },
    ];

    const result = matchReimport(existing, drafts);
    expect(result.drafts[0]!.bucket).toBe("neu");
    expect(result.entfallen).toEqual(["a"]);
  });

  test("außerhalb des ±7-Tage-Fensters gilt ein Treffer nicht mehr als Verschiebung", () => {
    const existing: ExistingCalendarEvent[] = [
      {
        id: "a",
        subjectId: "Mathematik",
        groups: ["8.5"],
        date: "2026-10-09",
        title: "Mathearbeit",
      },
    ];
    const drafts: ReimportCandidate[] = [
      { subjectId: "Mathematik", groups: ["8.5"], date: "2026-10-20", title: "Mathearbeit" },
    ];

    const result = matchReimport(existing, drafts);
    expect(result.drafts[0]!.bucket).toBe("neu");
    expect(result.entfallen).toEqual(["a"]);
  });

  test("Groß-/Kleinschreibung und diakritische Zeichen im Titel sind egal", () => {
    const existing: ExistingCalendarEvent[] = [
      {
        id: "a",
        subjectId: "Französisch",
        groups: ["8.5"],
        date: "2026-09-25",
        title: "Jg. 8 Frz. Arbeit",
      },
    ];
    const drafts: ReimportCandidate[] = [
      { subjectId: "Französisch", groups: ["8.5"], date: "2026-09-25", title: "JG. 8 FRZ. ARBEIT" },
    ];

    const result = matchReimport(existing, drafts);
    expect(result.drafts[0]!.bucket).toBe("unveraendert");
  });
});
