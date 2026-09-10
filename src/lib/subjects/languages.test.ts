import { describe, expect, it } from "vitest";

import { directionLabels, languageLabel } from "./languages";

describe("languageLabel", () => {
  it("gibt den deutschen Namen zu einem bekannten Code", () => {
    expect(languageLabel("en")).toBe("Englisch");
    expect(languageLabel("fr")).toBe("Französisch");
  });

  it("fällt auf den Code zurück, wenn er unbekannt ist", () => {
    expect(languageLabel("xx")).toBe("xx");
  });
});

describe("directionLabels", () => {
  it("baut kompakte Richtungslabels aus dem Sprachcode (V-06a)", () => {
    expect(directionLabels("en")).toEqual({ vorwaerts: "EN → DE", rueckwaerts: "DE → EN" });
    expect(directionLabels("fr")).toEqual({ vorwaerts: "FR → DE", rueckwaerts: "DE → FR" });
  });

  it("gibt null ohne Zielsprache – dann kein Umschalter", () => {
    expect(directionLabels(null)).toBeNull();
    expect(directionLabels("")).toBeNull();
  });
});
