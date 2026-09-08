import { describe, expect, it } from "vitest";

import { evaluateAnswer } from "./answer";

describe("evaluateAnswer", () => {
  it("erkennt eine exakte Antwort, auch mit Groß-/Kleinschreibung und Leerraum", () => {
    expect(evaluateAnswer("la fenêtre", "la fenêtre")).toBe("richtig");
    expect(evaluateAnswer("la fenêtre", "La Fenêtre")).toBe("richtig");
    expect(evaluateAnswer("aufstehen", "  aufstehen  ")).toBe("richtig");
  });

  it("verzeiht einen fehlenden Artikel (§6 M4: Artikel-/Genus-Pflicht bei FR/ES)", () => {
    expect(evaluateAnswer("la fenêtre", "fenêtre")).toBe("fast");
    expect(evaluateAnswer("le petit-déjeuner", "petit-déjeuner")).toBe("fast");
  });

  it("verzeiht falsche oder fehlende Akzente", () => {
    expect(evaluateAnswer("la fenêtre", "la fenetre")).toBe("fast");
    expect(evaluateAnswer("déjà", "deja")).toBe("fast");
  });

  it("Tippfehlertoleranz wächst mit der Wortlänge", () => {
    // 5 Zeichen: ein Fehler erlaubt
    expect(evaluateAnswer("aller", "alles")).toBe("fast");
    // 4 Zeichen: kein Fehler erlaubt
    expect(evaluateAnswer("chat", "chit")).toBe("falsch");
    // 20 Zeichen: zwei Fehler erlaubt
    expect(evaluateAnswer("se brosser les dents", "se broser les dants")).toBe("fast");
  });

  it("lehnt eine falsche Antwort ab, auch wenn sie plausibel aussieht", () => {
    expect(evaluateAnswer("aufstehen", "aufwachen")).toBe("falsch");
  });

  it("eine leere Antwort ist immer falsch, nie 'fast'", () => {
    expect(evaluateAnswer("la fenêtre", "")).toBe("falsch");
  });
});
