import { describe, expect, test } from "vitest";

import { expandGroupToken, matchesOwnGroups, suggestOwnGroups } from "./group-match";
import fixture from "../../../docs/fixtures/beispiel-import-klausurplan.json";

describe("expandGroupToken", () => {
  test("lässt eine einzelne Klasse unverändert", () => {
    expect(expandGroupToken("8.5")).toEqual(["8.5"]);
  });

  test("lässt eine Fachdifferenzierung unverändert (kein Bereich)", () => {
    expect(expandGroupToken("8.5 Eng")).toEqual(["8.5 Eng"]);
  });

  test("schreibt einen Bereich aus", () => {
    expect(expandGroupToken("8.1-8.5")).toEqual(["8.1", "8.2", "8.3", "8.4", "8.5"]);
    expect(expandGroupToken("8.1–8.5")).toEqual(["8.1", "8.2", "8.3", "8.4", "8.5"]);
  });

  test("teilt eine Liste auf", () => {
    expect(expandGroupToken("8.1, 8.3")).toEqual(["8.1", "8.3"]);
  });

  test("lässt einen unsinnigen Bereich (andere Klasse) unverändert", () => {
    expect(expandGroupToken("8.1-9.2")).toEqual(["8.1-9.2"]);
  });
});

describe("matchesOwnGroups", () => {
  test("leere Gruppen betreffen alle (z. B. Blocker)", () => {
    expect(matchesOwnGroups([], [])).toBe(true);
    expect(matchesOwnGroups([], ["8.5"])).toBe(true);
  });

  test("Jahrgangsarbeit trifft über einen Bereich zu", () => {
    expect(matchesOwnGroups(["8.1", "8.2", "8.3", "8.4", "8.5"], ["8.5"])).toBe(true);
  });

  test("Fachdifferenzierung trifft nur mit demselben Token zu", () => {
    expect(matchesOwnGroups(["8.5 Eng"], ["8.5", "8.5 Eng", "8.5 Mat"])).toBe(true);
    expect(matchesOwnGroups(["8.5 Fra"], ["8.5", "8.5 Eng", "8.5 Mat"])).toBe(false);
  });

  test("Groß-/Kleinschreibung und Leerraum sind egal", () => {
    expect(matchesOwnGroups(["8.5 ENG"], ["  8.5 eng "])).toBe(true);
  });

  test("eine fremde Klasse trifft nicht zu", () => {
    expect(matchesOwnGroups(["8.1", "8.2", "8.3", "8.4"], ["8.5"])).toBe(false);
  });

  test("gegen die echte Fixture: eigene Gruppen treffen die eigenen Zeilen, nicht die fremden", () => {
    const eigeneGruppen = fixture.quelle.eigeneGruppen;

    const englischarbeit = fixture.events.find((e) => e.titel === "Englischarbeit Nr.1")!;
    expect(matchesOwnGroups(englischarbeit.gruppen, eigeneGruppen)).toBe(true);

    const deutscharbeit = fixture.events.find((e) => e.titel === "Jg. 8 Deutscharbeit")!;
    expect(matchesOwnGroups(deutscharbeit.gruppen, eigeneGruppen)).toBe(true); // 8.5 ist mit dabei

    const fremdeGruppe = ["8.1", "8.2"]; // ohne 8.5
    expect(matchesOwnGroups(fremdeGruppe, eigeneGruppen)).toBe(false);

    // Blocker ohne Gruppenbezug betreffen alle
    const herbstferien = fixture.events.find((e) => e.titel === "Herbstferien")!;
    expect(matchesOwnGroups(herbstferien.gruppen, eigeneGruppen)).toBe(true);
  });
});

describe("suggestOwnGroups", () => {
  test("schlägt Tokens vor, die mit der eigenen Klasse beginnen", () => {
    const gesehen = ["8.1", "8.2", "8.5", "8.5 Eng", "8.5 Mat", "9.1"];
    expect(suggestOwnGroups(gesehen, "8.5")).toEqual(["8.5", "8.5 Eng", "8.5 Mat"]);
  });

  test("verwechselt '8.5' nicht mit '8.51' oder '18.5'", () => {
    expect(suggestOwnGroups(["8.51", "18.5", "8.5"], "8.5")).toEqual(["8.5"]);
  });

  test("ohne bekannte Klasse gibt es keine Vorauswahl", () => {
    expect(suggestOwnGroups(["8.5", "8.5 Eng"], null)).toEqual([]);
  });

  test("Groß-/Kleinschreibung und Leerraum sind egal, Duplikate fallen weg", () => {
    expect(suggestOwnGroups(["8.5 ENG", " 8.5 eng ", "8.5"], "8.5")).toEqual(["8.5 ENG", "8.5"]);
  });

  test("gegen die echte Fixture: findet dieselben Tokens wie quelle.eigeneGruppen", () => {
    const alleTokens = fixture.events.flatMap((e) => e.gruppen);
    expect(suggestOwnGroups(alleTokens, "8.5").sort()).toEqual(
      [...fixture.quelle.eigeneGruppen].sort(),
    );
  });
});
