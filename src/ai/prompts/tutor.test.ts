import { describe, expect, it } from "vitest";

import { hausaufgabeSystemPrompt } from "./hausaufgabe";
import { formelRegeln, tonNachJahrgang, tutorSystemPrompt } from "./tutor";

describe("tonNachJahrgang", () => {
  it("Jahrgang 5–7: kurze Sätze, Alltagsbeispiel zuerst", () => {
    const ton = tonNachJahrgang(5).join(" ");
    expect(ton).toMatch(/Jahrgang 5/);
    expect(ton).toMatch(/[Kk]urze Sätze/);
    expect(ton).toMatch(/Alltag/);
  });

  it("Jahrgang 8–10: Fachsprache erlaubt, Begriffe einführen", () => {
    const ton = tonNachJahrgang(9).join(" ");
    expect(ton).toMatch(/Jahrgang 9/);
    expect(ton).toMatch(/Fachsprache/);
    expect(ton).toMatch(/führe jeden neuen Begriff/);
  });

  it("Oberstufe: herleiten statt vereinfachen", () => {
    const ton = tonNachJahrgang(12).join(" ");
    expect(ton).toMatch(/Oberstufe/);
    expect(ton).toMatch(/herleiten|einordnen/);
    expect(ton).not.toMatch(/kurze Sätze/i);
  });

  it("die Grenzen liegen bei 7 und 10", () => {
    expect(tonNachJahrgang(7).join(" ")).toMatch(/[Kk]urze Sätze/);
    expect(tonNachJahrgang(8).join(" ")).toMatch(/Fachsprache/);
    expect(tonNachJahrgang(10).join(" ")).toMatch(/Fachsprache/);
    expect(tonNachJahrgang(11).join(" ")).toMatch(/Oberstufe/);
  });
});

describe("tutorSystemPrompt", () => {
  const basis = {
    subjectName: "Biologie",
    subjectLanguage: null,
    topicTitle: null,
    entryPoint: "freie_frage" as const,
    gradeLevel: 8,
  };

  it("nennt niemanden Schuelerin und legt keine Klasse fest (Kind-Profile sind pseudonym)", () => {
    const prompt = tutorSystemPrompt(basis);
    expect(prompt).not.toMatch(/Schülerin|Schüler\b/);
    expect(prompt).toContain('mit „du" an');
  });

  it("staffelt die Tonlage nach dem übergebenen Jahrgang", () => {
    expect(tutorSystemPrompt({ ...basis, gradeLevel: 5 })).toMatch(/Jahrgang 5/);
    expect(tutorSystemPrompt({ ...basis, gradeLevel: 13 })).toMatch(/Oberstufe/);
  });

  it("verlangt Markdown-Struktur, aber sparsam und ohne Überschriften bei kurzen Antworten", () => {
    const prompt = tutorSystemPrompt(basis);
    expect(prompt).toMatch(/FORMAT/);
    expect(prompt).toMatch(/fett/i);
    expect(prompt).toMatch(/[Kk]eine Überschriften bei kurzen Antworten/);
  });

  it("erlaubt die Zielsprache nur im Fremdsprachenfach (ADR 0010 D3)", () => {
    const mathe = tutorSystemPrompt(basis);
    expect(mathe).toMatch(/Fachbegriffe erklärst du auf Deutsch/);

    const franz = tutorSystemPrompt({
      ...basis,
      subjectName: "Französisch",
      subjectLanguage: "fr",
    });
    expect(franz).toMatch(/In Französisch dürfen einzelne Wörter/);
  });

  it("blendet den Verstehen-Block nur beim passenden Einstieg ein", () => {
    expect(tutorSystemPrompt(basis)).toMatch(/EINSTIEG: FREIE FRAGE/);
    expect(tutorSystemPrompt({ ...basis, entryPoint: "verstehen" })).toMatch(/EINSTIEG: VERSTEHEN/);
  });

  it("fragt nicht nach dem Fach, wenn es noch keins gibt (ADR 0013 D1)", () => {
    const ohneFach = tutorSystemPrompt({ ...basis, subjectName: null });
    expect(ohneFach).not.toMatch(/Fach: /);
    expect(ohneFach).toMatch(/noch nicht bekannt/);
  });

  it("erlaubt ohne Fach keine Zielsprache – die strengste Regel greift (ADR 0013 D5)", () => {
    const ohneFach = tutorSystemPrompt({ ...basis, subjectName: null, subjectLanguage: null });
    expect(ohneFach).toMatch(/Fachbegriffe erklärst du auf Deutsch/);
  });
});

describe("formelRegeln – wie Rechenwege auszusehen haben (T-14)", () => {
  const regeln = formelRegeln().join("\n");

  it("verlangt einen Rechenschritt je Zeile", () => {
    // Der Fund aus dem Testen: zwei Umformungen in einer Zeile, nur durch
    // Fettung getrennt.
    expect(regeln).toMatch(/[Ee]in Rechenschritt je Zeile/);
    expect(regeln).toMatch(/[Nn]ie zwei Umformungen/);
  });

  it("zeigt die Schulheft-Schreibweise als wörtliches Beispiel", () => {
    // Ein Modell übernimmt eine Form zuverlässiger, wenn es sie sieht,
    // statt sie beschrieben zu bekommen.
    expect(regeln).toContain("\\begin{aligned}");
    expect(regeln).toContain("\\mid -4x");
    expect(regeln).toContain("\\end{aligned}");
  });

  it("verlangt $$ auf eigenen Zeilen – sonst bleibt die Formel inline", () => {
    // Von `markdown.test.tsx` bestätigt: `$$…$$` mitten im Absatz wird
    // nicht abgesetzt.
    expect(regeln).toMatch(/eigenen.{0,3} Zeilen/);
  });

  it("nennt Einheiten und \\ce{…} für die Naturwissenschaften", () => {
    expect(regeln).toMatch(/Einheiten immer mitführen/);
    expect(regeln).toContain("\\ce{");
  });

  it("verbietet ASCII-Strukturformeln, statt sie zu versuchen", () => {
    // KaTeX kann Summenformeln, aber keine Skelettformeln – lieber eine
    // ehrliche Beschreibung als eine Zeichnung aus Bindestrichen.
    expect(regeln).toMatch(/Strukturformeln/);
    expect(regeln).toMatch(/ASCII/);
  });
});

describe("beide Prompts tragen dieselben Formelregeln", () => {
  it("freier Chat und Hausaufgaben-Zug erklären Rechenwege gleich", () => {
    const chat = tutorSystemPrompt({
      subjectName: "Mathematik",
      subjectLanguage: null,
      topicTitle: null,
      entryPoint: "freie_frage",
      gradeLevel: 8,
    });
    const hausaufgabe = hausaufgabeSystemPrompt({
      subjectName: "Mathematik",
      gradeLevel: 8,
      aufgabe: "7x - 9 = 4x + 15",
      zug: { art: "loesung_zeigen" },
    });

    for (const prompt of [chat, hausaufgabe]) {
      expect(prompt).toMatch(/FORMELN UND RECHENWEGE/);
      expect(prompt).toContain("\\begin{aligned}");
    }
  });
});
