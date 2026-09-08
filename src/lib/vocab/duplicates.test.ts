import { describe, expect, it } from "vitest";

import { classifyDuplicate, type ExistingVocabItem } from "./duplicates";

const existing: ExistingVocabItem[] = [
  { id: "1", term: "aller", translation: "gehen" },
  { id: "2", term: "la fenêtre", translation: "das Fenster" },
];

describe("classifyDuplicate", () => {
  it("erkennt einen exakten Treffer, groß-/kleinschreibungs- und leerraumunabhängig", () => {
    expect(classifyDuplicate({ term: "aller", translation: "gehen" }, existing)).toEqual({
      classification: "exakt",
      match: existing[0],
    });
    expect(classifyDuplicate({ term: "Aller", translation: "  gehen " }, existing)).toEqual({
      classification: "exakt",
      match: existing[0],
    });
  });

  it("markiert gleiches Wort mit anderer Übersetzung als abweichend, führt nicht automatisch zusammen", () => {
    const result = classifyDuplicate({ term: "aller", translation: "fahren" }, existing);
    expect(result.classification).toBe("abweichend");
    expect(result.match).toEqual(existing[0]);
  });

  it("ein unbekanntes Wort ist neu", () => {
    expect(classifyDuplicate({ term: "venir", translation: "kommen" }, existing)).toEqual({
      classification: "neu",
      match: null,
    });
  });

  it("bei zwei Einträgen zum selben Wort gewinnt der exakte Treffer, nicht der erste", () => {
    // D4 lässt „aller/gehen" und „aller/fahren" nebeneinander zu. Dieselbe
    // Liste ein zweites Mal einzufügen darf keinen dritten Eintrag anlegen.
    const beide: ExistingVocabItem[] = [
      { id: "1", term: "aller", translation: "gehen" },
      { id: "3", term: "aller", translation: "fahren" },
    ];
    expect(classifyDuplicate({ term: "aller", translation: "fahren" }, beide)).toEqual({
      classification: "exakt",
      match: beide[1],
    });
  });

  it("eine andere Übersetzung desselben Worts trifft nicht versehentlich ein anderes Wort", () => {
    const result = classifyDuplicate({ term: "la fenêtre", translation: "gehen" }, existing);
    expect(result.classification).toBe("abweichend");
    expect(result.match).toEqual(existing[1]);
  });
});
