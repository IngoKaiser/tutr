import { describe, expect, it } from "vitest";

import { filtereGespraeche, normalisiere } from "./gespraechs-suche";

const GESPRAECHE = [
  { title: "Lineare Gleichungen", subjectName: "Mathematik" },
  { title: "Reflexive Verben", subjectName: "Französisch" },
  { title: "Photosynthese", subjectName: "Biologie" },
  { title: "Was sind Mitochondrien?", subjectName: "Biologie" },
  { title: "Hallo", subjectName: null },
];

describe("normalisiere", () => {
  it("macht Groß-/Kleinschreibung und Akzente gleichgültig", () => {
    expect(normalisiere("Französisch")).toBe("franzosisch");
    expect(normalisiere("MATHEMATIK")).toBe("mathematik");
    expect(normalisiere("  Übung  ")).toBe("ubung");
  });

  it("behandelt „ß“ als „ss“ – NFD zerlegt es nicht", () => {
    expect(normalisiere("Straße")).toBe("strasse");
  });
});

describe("filtereGespraeche", () => {
  it("findet über den Titel", () => {
    expect(filtereGespraeche(GESPRAECHE, "gleichungen").map((g) => g.title)).toEqual([
      "Lineare Gleichungen",
    ]);
  });

  it("findet über das Fach, auch wenn kein Titel das Wort enthält", () => {
    expect(filtereGespraeche(GESPRAECHE, "Biologie").map((g) => g.title)).toEqual([
      "Photosynthese",
      "Was sind Mitochondrien?",
    ]);
  });

  it("sucht ohne Rücksicht auf Schreibung – hier sucht ein Mensch, keine Maschine", () => {
    // Das Gegenstück zu `loeseFachZuordnungAuf()`, das genau nicht raten darf.
    expect(filtereGespraeche(GESPRAECHE, "franzosisch").map((g) => g.title)).toEqual([
      "Reflexive Verben",
    ]);
    expect(filtereGespraeche(GESPRAECHE, "MITOCHONDRIEN")).toHaveLength(1);
  });

  it("gibt bei leerem Begriff alles zurück – „nichts gesucht“ ist nicht „nichts gefunden“", () => {
    expect(filtereGespraeche(GESPRAECHE, "")).toHaveLength(GESPRAECHE.length);
    expect(filtereGespraeche(GESPRAECHE, "   ")).toHaveLength(GESPRAECHE.length);
  });

  it("gibt eine leere Liste zurück, wenn nichts passt", () => {
    expect(filtereGespraeche(GESPRAECHE, "Chemie")).toEqual([]);
  });

  it("stolpert nicht über ein Gespräch ohne Fach", () => {
    expect(filtereGespraeche(GESPRAECHE, "hallo").map((g) => g.title)).toEqual(["Hallo"]);
  });
});
