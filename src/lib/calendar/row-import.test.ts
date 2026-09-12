import { describe, expect, test } from "vitest";

import {
  classifyEventType,
  draftFromRow,
  parseDate,
  resolveSubjectGuess,
  splitGroupsText,
} from "./row-import";

const FAECHER = ["Französisch", "Englisch", "Deutsch", "Mathematik", "Biologie"];

describe("parseDate", () => {
  test("liest deutsches Format", () => {
    expect(parseDate("25.09.2026")).toBe("2026-09-25");
    expect(parseDate("5.9.2026")).toBe("2026-09-05");
  });

  test("liest ISO-Format", () => {
    expect(parseDate("2026-09-25")).toBe("2026-09-25");
  });

  test("lehnt ein nicht existierendes Datum ab", () => {
    expect(parseDate("31.02.2026")).toBeNull();
  });

  test("lehnt Unsinn und leer ab", () => {
    expect(parseDate("nächste Woche")).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe("splitGroupsText", () => {
  test("teilt an Komma und Semikolon, trimmt", () => {
    expect(splitGroupsText("8.5, 8.5 Eng; 8.5 Mat")).toEqual(["8.5", "8.5 Eng", "8.5 Mat"]);
  });

  test("leer/null → betrifft alle", () => {
    expect(splitGroupsText("")).toEqual([]);
    expect(splitGroupsText(null)).toEqual([]);
  });
});

describe("classifyEventType", () => {
  test("erkennt Blocker vor allem anderen", () => {
    expect(classifyEventType("Projektwoche")).toBe("blocker");
    expect(classifyEventType("Herbstferien")).toBe("blocker");
    expect(classifyEventType("Musikfahrt")).toBe("blocker");
  });

  test("erkennt die vier Klausurplan-Typen", () => {
    expect(classifyEventType("Klassenarbeit Mathe")).toBe("klassenarbeit");
    expect(classifyEventType("Vokabeltest")).toBe("test");
    expect(classifyEventType("Mündliche Prüfung")).toBe("muendlich");
    expect(classifyEventType("Abgabe Portfolio")).toBe("abgabe");
  });

  test("fällt ohne Treffer auf sonstiges zurück, kein Raten", () => {
    expect(classifyEventType("Tag der offenen Tür CvO")).toBe("sonstiges");
    expect(classifyEventType(null)).toBe("sonstiges");
  });
});

describe("resolveSubjectGuess", () => {
  test("findet den vollen Namen, groß-/kleinschreibungs- und akzentunabhängig", () => {
    expect(resolveSubjectGuess("FRANZÖSISCH", FAECHER)).toBe("Französisch");
    expect(resolveSubjectGuess("franzosisch", FAECHER)).toBe("Französisch");
  });

  test("findet ein eindeutiges Präfix (Abkürzung, ADR 0016 D4)", () => {
    expect(resolveSubjectGuess("Eng", FAECHER)).toBe("Englisch");
    expect(resolveSubjectGuess("Mat", FAECHER)).toBe("Mathematik");
  });

  test("rät nicht bei mehrdeutigem oder zu kurzem Präfix", () => {
    expect(resolveSubjectGuess("De", FAECHER)).toBe("unklar"); // zu kurz (< 3 Zeichen)
    expect(resolveSubjectGuess("xyz", FAECHER)).toBe("unklar");
  });

  test("leer/kein Fach → unklar", () => {
    expect(resolveSubjectGuess(null, FAECHER)).toBe("unklar");
  });
});

describe("draftFromRow", () => {
  test("baut einen vollständigen Entwurf", () => {
    const draft = draftFromRow(
      {
        date: "25.09.2026",
        subjectText: "Französisch",
        typeText: "Klassenarbeit",
        title: "Jg. 8 Frz. Arbeit",
        displayName: null,
        groupsText: "8.1, 8.2, 8.3, 8.4, 8.5",
        note: "Jahrgangsarbeit",
      },
      FAECHER,
    );
    expect(draft).toEqual({
      type: "klassenarbeit",
      subjectGuess: "Französisch",
      title: "Jg. 8 Frz. Arbeit",
      displayName: null,
      date: "2026-09-25",
      groups: ["8.1", "8.2", "8.3", "8.4", "8.5"],
      relevant: true,
      confidence: "hoch",
      note: "Jahrgangsarbeit",
    });
  });

  test("Blocker hat kein Fach, auch wenn eins in der Spalte stünde", () => {
    const draft = draftFromRow(
      {
        date: "12.10.2026",
        subjectText: "Französisch",
        typeText: "Projektwoche",
        title: "Projektwoche",
        displayName: null,
        groupsText: null,
        note: null,
      },
      FAECHER,
    );
    expect(draft?.type).toBe("blocker");
    expect(draft?.subjectGuess).toBeNull();
    expect(draft?.relevant).toBe(true);
  });

  test("ohne Typ-Spalte fällt die Erkennung auf den Titel zurück", () => {
    const draft = draftFromRow(
      {
        date: "19.10.2026",
        subjectText: null,
        typeText: null,
        title: "Herbstferien",
        displayName: null,
        groupsText: null,
        note: null,
      },
      FAECHER,
    );
    expect(draft?.type).toBe("blocker");
  });

  test("fehlendes Datum oder fehlender Titel → kein Entwurf", () => {
    expect(
      draftFromRow(
        {
          date: null,
          subjectText: null,
          typeText: null,
          title: "Etwas",
          displayName: null,
          groupsText: null,
          note: null,
        },
        FAECHER,
      ),
    ).toBeNull();
    expect(
      draftFromRow(
        {
          date: "25.09.2026",
          subjectText: null,
          typeText: null,
          title: null,
          displayName: null,
          groupsText: null,
          note: null,
        },
        FAECHER,
      ),
    ).toBeNull();
  });
});
