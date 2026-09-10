import { describe, expect, it } from "vitest";

import { tonNachJahrgang, tutorSystemPrompt } from "./tutor";

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
});
