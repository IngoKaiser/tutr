import { describe, expect, it } from "vitest";

import { FORTSETZUNGSFENSTER_MINUTEN, istFortsetzbar } from "./fortsetzung";

const JETZT = new Date("2026-09-11T18:00:00Z");

function vorMinuten(minuten: number): Date {
  return new Date(JETZT.getTime() - minuten * 60 * 1000);
}

describe("istFortsetzbar", () => {
  it("setzt fort, solange das Fenster läuft", () => {
    expect(istFortsetzbar(JETZT, JETZT)).toBe(true);
    expect(istFortsetzbar(vorMinuten(1), JETZT)).toBe(true);
    expect(istFortsetzbar(vorMinuten(FORTSETZUNGSFENSTER_MINUTEN - 1), JETZT)).toBe(true);
  });

  it("legt ein neues Gespräch an, sobald das Fenster zu ist", () => {
    // Genau auf der Grenze zählt als abgelaufen: Von zwei gleich vertretbaren
    // Antworten ist „neues Gespräch“ die, die nichts zusammenklebt, was nicht
    // zusammengehört.
    expect(istFortsetzbar(vorMinuten(FORTSETZUNGSFENSTER_MINUTEN), JETZT)).toBe(false);
    expect(istFortsetzbar(vorMinuten(FORTSETZUNGSFENSTER_MINUTEN + 1), JETZT)).toBe(false);
    expect(istFortsetzbar(vorMinuten(60 * 24), JETZT)).toBe(false);
  });

  it("behandelt eine Zeit aus der Zukunft als „gerade eben“", () => {
    // Die Uhr der Datenbank (`now()`) und die der Laufzeit laufen auseinander.
    // „Lange her“ wäre hier die einzige Alternative – und nachweislich falsch.
    expect(istFortsetzbar(vorMinuten(-2), JETZT)).toBe(true);
  });

  it("setzt bei einem unbrauchbaren Zeitpunkt nicht fort", () => {
    expect(istFortsetzbar(new Date("keine Zeit"), JETZT)).toBe(false);
  });
});
