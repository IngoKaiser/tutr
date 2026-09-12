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

  describe("Klammerzusätze und Auslassungspunkte (V-14)", () => {
    it("verlangt Klammerzusätze nicht – mit und ohne Leerzeichen davor", () => {
      expect(evaluateAnswer("to get up (Am.)", "to get up")).toBe("richtig");
      expect(evaluateAnswer("nice(r)", "nice")).toBe("richtig");
    });

    it("entfernt mehrere Klammerzusätze", () => {
      expect(evaluateAnswer("to get up (Am.) (ugs.)", "to get up")).toBe("richtig");
    });

    it("toleriert Auslassungspunkte zwischen Wortteilen, mit und ohne Leerzeichen drumherum", () => {
      expect(evaluateAnswer("sich freuen … auf", "sich freuen auf")).toBe("richtig");
      expect(evaluateAnswer("sich freuen...auf", "sich freuen auf")).toBe("richtig");
      expect(evaluateAnswer("sich freuen .. auf", "sich freuen auf")).toBe("richtig");
      expect(evaluateAnswer("sich freuen auf", "sich freuen … auf")).toBe("richtig");
    });

    it("wirkt zusammen mit bestehenden Toleranzstufen (Artikel, Akzent, Tippfehler)", () => {
      expect(evaluateAnswer("la fenêtre (Am.)", "fenêtre")).toBe("fast");
      expect(evaluateAnswer("la fenêtre (Am.)", "la fenetre")).toBe("fast");
      expect(evaluateAnswer("se brosser les dents (ugs.)", "se broser les dants")).toBe("fast");
    });

    it("zählt Bereinigung als 'richtig', nicht als eigene 'fast'-Stufe", () => {
      expect(evaluateAnswer("to get up (Am.)", "to get up")).toBe("richtig");
    });
  });

  describe("Genus-Suffix per Komma und enge Schrägstrich-Paare (V-14, Nachtrag: Fund in Produktivdaten)", () => {
    it("verlangt den Komma-Genus-Suffix nicht (wörterbuchübliche Schreibweise bei ES-Adjektiven)", () => {
      expect(evaluateAnswer("gracioso, -a", "gracioso")).toBe("richtig");
      expect(evaluateAnswer("algunos, -as", "algunos")).toBe("richtig");
    });

    it("kombiniert Komma-Suffix mit einem nachfolgenden Klammerzusatz", () => {
      expect(evaluateAnswer("tanto, -os, -a, -as (como)", "tanto")).toBe("richtig");
    });

    it("verlangt bei eng geschriebenen Schrägstrich-Paaren nur die erste Form", () => {
      expect(evaluateAnswer("el/la guía", "el guía")).toBe("richtig");
      expect(evaluateAnswer("Amerikaner/in", "Amerikaner")).toBe("richtig");
    });

    it("rührt echte Komma-Listen mehrerer vollständiger Antworten nicht an (bewusste Grenze)", () => {
      // „hinnehmbar" ist für sich genommen eine vollständig richtige Übersetzung,
      // aber kein Suffix wie „-a" – die Komma-Liste bleibt absichtlich unangetastet.
      expect(evaluateAnswer("akzeptabel, hinnehmbar", "hinnehmbar")).toBe("falsch");
    });

    it("rührt locker geschriebene Schrägstrich-Alternativen mit Leerzeichen nicht an (bewusste Grenze)", () => {
      expect(evaluateAnswer("der Reiseführer / die Reiseführerin", "die Reiseführerin")).toBe(
        "falsch",
      );
    });
  });
});
