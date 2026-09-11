import { describe, expect, it } from "vitest";

import { loeseFachZuordnungAuf, type FachOption } from "./fach-zuordnung";

const FAECHER: FachOption[] = [
  { id: "f-mathe", name: "Mathematik", language: null },
  { id: "f-franz", name: "Französisch", language: "fr" },
];

describe("loeseFachZuordnungAuf", () => {
  it("findet das Fach bei exaktem Namenstreffer", () => {
    expect(loeseFachZuordnungAuf("Mathematik", FAECHER)).toEqual(FAECHER[0]);
    expect(loeseFachZuordnungAuf("Französisch", FAECHER)).toEqual(FAECHER[1]);
  });

  it('gibt null bei "unklar" zurück, statt zu raten', () => {
    expect(loeseFachZuordnungAuf("unklar", FAECHER)).toBeNull();
  });

  it("gibt null zurück, wenn die Antwort in keiner Liste steht – kein Raten trotz Abweichung", () => {
    // Groß-/Kleinschreibung, Tippfehler, ein Fach, das nicht mehr existiert:
    // Alles davon ist "kein exakter Treffer", nicht "fast getroffen".
    expect(loeseFachZuordnungAuf("mathematik", FAECHER)).toBeNull();
    expect(loeseFachZuordnungAuf("Mathe", FAECHER)).toBeNull();
    expect(loeseFachZuordnungAuf("Chemie", FAECHER)).toBeNull();
  });

  it("gibt null bei einer leeren Fächerliste zurück", () => {
    expect(loeseFachZuordnungAuf("Mathematik", [])).toBeNull();
  });
});
