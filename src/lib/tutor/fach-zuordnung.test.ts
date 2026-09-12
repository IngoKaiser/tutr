import { describe, expect, it } from "vitest";

import {
  bereinigeTitel,
  kuerzeTitel,
  loeseFachZuordnungAuf,
  type FachOption,
} from "./fach-zuordnung";

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

describe("kuerzeTitel", () => {
  it("lässt eine kurze Frage stehen und macht aus Umbrüchen eine Zeile", () => {
    expect(kuerzeTitel("  Was sind\n Mitochondrien?  ")).toBe("Was sind Mitochondrien?");
  });

  it("kürzt bei 60 Zeichen mit Auslassungszeichen", () => {
    const lang = "a".repeat(80);
    expect(kuerzeTitel(lang)).toBe(`${"a".repeat(57)}…`);
    expect(kuerzeTitel("b".repeat(60))).toBe("b".repeat(60));
  });
});

describe("bereinigeTitel", () => {
  const FRAGE = "Erkläre mir bitte was lineare Gleichungen sind";

  it("nimmt den Modell-Titel, wie er ist", () => {
    expect(bereinigeTitel("Lineare Gleichungen", FRAGE)).toBe("Lineare Gleichungen");
  });

  it("räumt ab, was ein Modell gern mitliefert", () => {
    expect(bereinigeTitel('"Lineare Gleichungen"', FRAGE)).toBe("Lineare Gleichungen");
    expect(bereinigeTitel("„Lineare Gleichungen“", FRAGE)).toBe("Lineare Gleichungen");
    expect(bereinigeTitel("Lineare Gleichungen.", FRAGE)).toBe("Lineare Gleichungen");
    expect(bereinigeTitel("  Lineare\n  Gleichungen  ", FRAGE)).toBe("Lineare Gleichungen");
  });

  it("lässt Zeichen stehen, die Bedeutung tragen", () => {
    // Anführungszeichen *im* Titel sind ein Werktitel, kein Verpackungsmüll –
    // und ein Fragezeichen ist nicht dasselbe wie ein Schlusspunkt.
    expect(bereinigeTitel('Analyse von "Der Zauberlehrling"', FRAGE)).toBe(
      'Analyse von "Der Zauberlehrling"',
    );
    expect(bereinigeTitel("Warum ist der Himmel blau?", FRAGE)).toBe("Warum ist der Himmel blau?");
  });

  it("nimmt die gekürzte Frage, wenn kein Titel kam", () => {
    // Der Prompt verlangt für einen Gruß ausdrücklich einen leeren Titel –
    // das ist ein Ergebnis, kein Fehler.
    expect(bereinigeTitel("", FRAGE)).toBe(FRAGE);
    expect(bereinigeTitel("   ", FRAGE)).toBe(FRAGE);
    expect(bereinigeTitel('""', FRAGE)).toBe(FRAGE);
  });

  it("lässt kein namenloses Gespräch stehen, wenn auch die Frage leer ist", () => {
    // Ein Foto ohne Text ist eine gültige Eingabe (`liesEingang()`); bis T-19a
    // stand in genau diesem Fall eine leere Zeile in der Historie.
    expect(bereinigeTitel("", "")).toBe("Foto");
  });
});
