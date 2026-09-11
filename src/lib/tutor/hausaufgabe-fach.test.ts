import { describe, expect, it } from "vitest";

import { hausaufgabeFachHinweis } from "./hausaufgabe-fach";

describe("hausaufgabeFachHinweis", () => {
  it("Mathe: Rechenweg prüfen, nicht das Ergebnis vorwegnehmen", () => {
    const h = hausaufgabeFachHinweis("Mathematik");
    expect(h.tut).toMatch(/Rechenweg/);
    expect(h.tutNicht).toMatch(/Ergebnis/);
  });

  it("Deutsch: Struktur besprechen, nicht selbst schreiben", () => {
    const h = hausaufgabeFachHinweis("Deutsch");
    expect(h.tutNicht).toMatch(/schreiben/);
  });

  it("Fremdsprachen: Fehler markieren, nicht übersetzen", () => {
    for (const fach of ["Englisch", "Französisch", "Spanisch"]) {
      expect(hausaufgabeFachHinweis(fach).tutNicht).toMatch(/Übersetzung|korrigieren/);
    }
  });

  it("ist unabhängig von Groß-/Kleinschreibung und Umlaut-Schreibweise", () => {
    expect(hausaufgabeFachHinweis("MATHEMATIK")).toEqual(hausaufgabeFachHinweis("mathematik"));
    expect(hausaufgabeFachHinweis("Franzoesisch")).toEqual(hausaufgabeFachHinweis("Französisch"));
  });

  it("ein unbekanntes Fach bekommt eine vorsichtige allgemeine Fassung, keinen Fehler", () => {
    const h = hausaufgabeFachHinweis("Musik");
    expect(h.tut.length).toBeGreaterThan(0);
    expect(h.tutNicht).toMatch(/Ergebnis/);
  });
});
