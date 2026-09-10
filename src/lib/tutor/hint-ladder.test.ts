import { describe, expect, it } from "vitest";

import {
  darfLoesungZeigen,
  folgeZustand,
  istAbgeschlossen,
  naechsteHinweisstufe,
  naechsterZug,
  zaehltAlsVersuch,
  type AufgabenZustand,
  type Eingabe,
} from "./hint-ladder";

const frisch: AufgabenZustand = { status: "offen", attempts: 0, hintLevel: 0 };

function eingabe(teil: Partial<Eingabe> = {}): Eingabe {
  return {
    bahn: "versuch",
    text: "3x + 5 = 20, also x = 5",
    hatFoto: false,
    loesungVerlangt: false,
    ...teil,
  };
}

describe("zaehltAlsVersuch – §4a: „Versuch = Eingabe, nicht Klick“", () => {
  it("ein sichtbarer Rechenweg zählt", () => {
    expect(zaehltAlsVersuch("3x + 5 = 20, also x = 5")).toBe(true);
    expect(zaehltAlsVersuch("Ich hab 15 raus, weil ich 5 abgezogen habe")).toBe(true);
  });

  it("Ausweichen zählt nicht – das ist der Weg, die Regel auszuhebeln", () => {
    for (const text of [
      "weiß ich nicht",
      "Ich weiß es nicht",
      "keine Ahnung",
      "kA",
      "kp",
      "nö",
      "?",
      "???",
      "nichts",
      "versteh ich nicht",
      "kann ich nicht",
      "Hilfe",
      "  ",
      "",
    ]) {
      expect(zaehltAlsVersuch(text), `„${text}“ darf nicht zählen`).toBe(false);
    }
  });

  it("„nicht“ mitten im Satz macht aus einem Versuch keinen Nicht-Versuch", () => {
    expect(zaehltAlsVersuch("Ich hab x = 4, aber die Probe geht nicht auf")).toBe(true);
  });
});

describe("naechsteHinweisstufe – §4a: „nie zwei auf einmal“", () => {
  it("steigt um genau eins", () => {
    expect(naechsteHinweisstufe({ ...frisch, hintLevel: 0 })).toBe(1);
    expect(naechsteHinweisstufe({ ...frisch, hintLevel: 1 })).toBe(2);
    expect(naechsteHinweisstufe({ ...frisch, hintLevel: 3 })).toBe(4);
  });

  it("bleibt bei 4 stehen", () => {
    expect(naechsteHinweisstufe({ ...frisch, hintLevel: 4 })).toBe(4);
  });
});

describe("darfLoesungZeigen – die Zwei-Versuche-Regel", () => {
  it("vor zwei Versuchen nicht, auch nicht auf Bitten", () => {
    expect(darfLoesungZeigen({ ...frisch, attempts: 0 }, true)).toBe(false);
    expect(darfLoesungZeigen({ ...frisch, attempts: 1 }, true)).toBe(false);
  });

  it("nach zwei dokumentierten Versuchen ja", () => {
    expect(darfLoesungZeigen({ ...frisch, attempts: 2 }, false)).toBe(true);
  });

  it("oder nach zwei Hinweisstufen, wenn ausdrücklich verlangt (§4a)", () => {
    expect(darfLoesungZeigen({ ...frisch, hintLevel: 2 }, true)).toBe(true);
    // Ohne ausdrückliche Bitte reicht die Stufe allein nicht.
    expect(darfLoesungZeigen({ ...frisch, hintLevel: 2 }, false)).toBe(false);
    expect(darfLoesungZeigen({ ...frisch, hintLevel: 1 }, true)).toBe(false);
  });
});

describe("naechsterZug – der Erlaubnisrahmen", () => {
  it("Bahn „verstehen“ erklärt die Aufgabe und zählt nie als Versuch", () => {
    const zug = naechsterZug(frisch, eingabe({ bahn: "verstehen", text: "Was ist hier gesucht?" }));
    expect(zug).toEqual({ art: "aufgabe_erklaeren" });
    // Und sie treibt die Leiter nicht hoch.
    expect(folgeZustand(frisch, zug).hintLevel).toBe(0);
    expect(folgeZustand(frisch, zug).attempts).toBe(0);
  });

  it("ein echter Versuch wird geprüft – Weg und Ergebnis", () => {
    const zug = naechsterZug(frisch, eingabe());
    expect(zug).toEqual({ art: "versuch_pruefen", versuchNr: 1, darfLoesungWennFalsch: false });
  });

  it("beim zweiten Versuch darf die Lösung folgen, wenn er danebenliegt", () => {
    const zug = naechsterZug({ ...frisch, attempts: 1 }, eingabe());
    expect(zug).toEqual({ art: "versuch_pruefen", versuchNr: 2, darfLoesungWennFalsch: true });
  });

  it("„weiß ich nicht“ führt zur Hinweisleiter, nicht zum Versuchszähler (§4a)", () => {
    const zug = naechsterZug(frisch, eingabe({ text: "weiß ich nicht" }));
    expect(zug).toEqual({ art: "hinweis", stufe: 1 });
    expect(folgeZustand(frisch, zug).attempts).toBe(0);
  });

  it("ein Foto vom Lösungsweg zählt auch ohne Text", () => {
    const zug = naechsterZug(frisch, eingabe({ text: "", hatFoto: true }));
    expect(zug).toEqual({ art: "versuch_pruefen", versuchNr: 1, darfLoesungWennFalsch: false });
  });

  it("die Lösung auf Bitten erst, wenn die Regel es hergibt", () => {
    const zuFrueh = naechsterZug(
      frisch,
      eingabe({ text: "sag's mir einfach", loesungVerlangt: true }),
    );
    expect(zuFrueh.art).not.toBe("loesung_zeigen");

    const erlaubt = naechsterZug(
      { ...frisch, attempts: 2 },
      eingabe({ text: "sag's mir einfach", loesungVerlangt: true }),
    );
    expect(erlaubt).toEqual({ art: "loesung_zeigen" });
  });

  it("Nachbohren führt erst über die Leiter, dann zum Ventil aus §4a", () => {
    let zustand = frisch;
    const bohren = eingabe({ text: "sag's mir einfach", loesungVerlangt: true });

    // Runde 1 und 2: Hinweisstufe 1, dann 2 – keine Lösung.
    for (const erwartet of [1, 2] as const) {
      const zug = naechsterZug(zustand, bohren);
      expect(zug).toEqual({ art: "hinweis", stufe: erwartet });
      zustand = folgeZustand(zustand, zug);
    }

    // Runde 3: §4a erlaubt die Lösung „nach zwei Hinweisstufen ausdrücklich
    // verlangt" – ausdrücklich ein Ventil, damit das Werkzeug nicht zur Wand
    // wird. Der Preis bleibt sichtbar.
    const dritter = naechsterZug(zustand, bohren);
    expect(dritter).toEqual({ art: "loesung_zeigen" });

    const danach = folgeZustand(zustand, dritter);
    expect(danach.status).toBe("loesung_gezeigt");
    expect(danach.status).not.toBe("geloest");
    expect(danach.attempts).toBe(0);
  });

  it("ohne ausdrückliche Bitte bleibt die Leiter die einzige Antwort", () => {
    let zustand = frisch;
    for (let i = 0; i < 4; i++) {
      const zug = naechsterZug(zustand, eingabe({ text: "weiß ich nicht" }));
      expect(zug.art, `Runde ${i + 1}`).toBe("hinweis");
      zustand = folgeZustand(zustand, zug);
    }
    expect(zustand.hintLevel).toBe(4);
    expect(zustand.attempts).toBe(0);
  });
});

describe("folgeZustand", () => {
  it("führt „offen“ beim ersten Zug auf „in Arbeit“", () => {
    expect(folgeZustand(frisch, { art: "aufgabe_erklaeren" }).status).toBe("in_arbeit");
  });

  it("markiert eine gezeigte Lösung als „Lösung gezeigt“, nicht als gelöst (§4a)", () => {
    const danach = folgeZustand({ ...frisch, attempts: 2 }, { art: "loesung_zeigen" });
    expect(danach.status).toBe("loesung_gezeigt");
    expect(danach.status).not.toBe("geloest");
  });

  it("ein voller Durchlauf: zwei Versuche, dann Lösung", () => {
    let z = frisch;
    z = folgeZustand(z, naechsterZug(z, eingabe({ text: "x = 3" })));
    expect(z.attempts).toBe(1);
    z = folgeZustand(z, naechsterZug(z, eingabe({ text: "x = 4" })));
    expect(z.attempts).toBe(2);
    const jetzt = naechsterZug(z, eingabe({ text: "zeig mir die Lösung", loesungVerlangt: true }));
    expect(jetzt).toEqual({ art: "loesung_zeigen" });
    expect(folgeZustand(z, jetzt).status).toBe("loesung_gezeigt");
  });
});

describe("istAbgeschlossen", () => {
  it("erkennt die drei Endzustände", () => {
    expect(istAbgeschlossen({ ...frisch, status: "geloest" })).toBe(true);
    expect(istAbgeschlossen({ ...frisch, status: "loesung_gezeigt" })).toBe(true);
    expect(istAbgeschlossen({ ...frisch, status: "uebersprungen" })).toBe(true);
    expect(istAbgeschlossen({ ...frisch, status: "in_arbeit" })).toBe(false);
    expect(istAbgeschlossen(frisch)).toBe(false);
  });
});
