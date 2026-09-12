import { describe, expect, it } from "vitest";

import { bilanziere, zweizeiler } from "./hausaufgabe-zusammenfassung";

describe("bilanziere", () => {
  it("zählt jeden Ausgang für sich, „übersprungen“ zählt zu „gesamt“", () => {
    const bilanz = bilanziere([
      { status: "geloest" },
      { status: "geloest" },
      { status: "geloest" },
      { status: "geloest" },
      { status: "loesung_gezeigt" },
    ]);
    expect(bilanz).toEqual({ gesamt: 5, geloest: 4, loesungGezeigt: 1, uebersprungen: 0 });
  });

  it("eine leere Liste bleibt bei lauter Nullen", () => {
    expect(bilanziere([])).toEqual({ gesamt: 0, geloest: 0, loesungGezeigt: 0, uebersprungen: 0 });
  });
});

describe("zweizeiler", () => {
  it("das Konzept-Beispiel (§4a): „5 Aufgaben, 4 selbst gelöst, 1 mit Lösung – …“", () => {
    const bilanz = bilanziere([
      { status: "geloest" },
      { status: "geloest" },
      { status: "geloest" },
      { status: "geloest" },
      { status: "loesung_gezeigt" },
    ]);
    expect(zweizeiler(bilanz, "Ungleichungen üben wir morgen")).toBe(
      "5 Aufgaben, 4 selbst gelöst, 1 mit Lösung – Ungleichungen üben wir morgen.",
    );
  });

  it("eine 0 fällt aus der Aufzählung, statt „0 mit Lösung“ mitzuschleppen", () => {
    const bilanz = bilanziere([{ status: "geloest" }, { status: "geloest" }]);
    expect(zweizeiler(bilanz, "Weiter so")).toBe("2 Aufgaben, 2 selbst gelöst – Weiter so.");
  });

  it("die Einzahl bei genau einer Aufgabe", () => {
    const bilanz = bilanziere([{ status: "geloest" }, { status: "uebersprungen" }]);
    expect(zweizeiler(bilanz, "Nächstes Mal in Ruhe angehen")).toBe(
      "1 Aufgabe, 1 selbst gelöst – Nächstes Mal in Ruhe angehen.",
    );
  });

  it("aussortierte Zeilen zählen nicht als Aufgabe (T-17)", () => {
    // „Gehört nicht dazu" heißt: war nie eine Aufgabe – ein Merkkasten, eine
    // gestrichene Nummer. Vorher zählten solche Zeilen zu „gesamt" und
    // rissen eine stille Lücke in die Bilanz („5 Aufgaben, 4 selbst gelöst").
    const bilanz = bilanziere([
      { status: "geloest" },
      { status: "geloest" },
      { status: "uebersprungen" },
    ]);
    expect(zweizeiler(bilanz, "Weiter so")).toBe("2 Aufgaben, 2 selbst gelöst – Weiter so.");
  });

  it("ein Punkt oder Leerzeichen am Ende des Hinweises wird nicht verdoppelt", () => {
    const bilanz = bilanziere([{ status: "geloest" }]);
    expect(zweizeiler(bilanz, "Gut gemacht.  ")).toBe("1 Aufgabe, 1 selbst gelöst – Gut gemacht.");
  });
});
