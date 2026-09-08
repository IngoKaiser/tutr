import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import {
  classifyMultipleChoice,
  classifyTyped,
  modeForCardState,
  MULTIPLE_CHOICE_FAST_MS,
  outcomeToGrade,
  typingBudgetMs,
} from "./outcome";

describe("classifyMultipleChoice", () => {
  it("falsch ist immer 'nochmal', egal wie schnell", () => {
    expect(classifyMultipleChoice(false, 500)).toBe("nochmal");
    expect(classifyMultipleChoice(false, 20_000)).toBe("nochmal");
  });

  it("richtig und schnell ist 'kann_ich'", () => {
    expect(classifyMultipleChoice(true, MULTIPLE_CHOICE_FAST_MS - 1)).toBe("kann_ich");
  });

  it("richtig, aber langsam ist 'uebe_ich'", () => {
    expect(classifyMultipleChoice(true, MULTIPLE_CHOICE_FAST_MS + 1)).toBe("uebe_ich");
  });
});

describe("typingBudgetMs", () => {
  it("wächst mit der Wortlänge, damit lange Vokabeln nicht bestraft werden", () => {
    expect(typingBudgetMs(5)).toBeLessThan(typingBudgetMs(20));
  });
});

describe("classifyTyped", () => {
  it("spiegelt die Antwortqualität direkt, ohne eigene Zeitmessung", () => {
    expect(classifyTyped("la fenêtre", "la fenêtre")).toEqual({
      outcome: "kann_ich",
      quality: "richtig",
    });
    expect(classifyTyped("la fenêtre", "fenêtre")).toEqual({
      outcome: "uebe_ich",
      quality: "fast",
    });
    expect(classifyTyped("la fenêtre", "der Tisch")).toEqual({
      outcome: "nochmal",
      quality: "falsch",
    });
  });
});

describe("outcomeToGrade", () => {
  it("bildet die drei Stapel auf FSRS-Bewertungen ab, ohne 'Easy' zu nutzen", () => {
    expect(outcomeToGrade("kann_ich")).toBe(Rating.Good);
    expect(outcomeToGrade("uebe_ich")).toBe(Rating.Hard);
    expect(outcomeToGrade("nochmal")).toBe(Rating.Again);
  });
});

describe("modeForCardState", () => {
  it("nur 'wiederholen' bekommt Tippen, alles andere Multiple Choice", () => {
    expect(modeForCardState("neu")).toBe("mc");
    expect(modeForCardState("lernen")).toBe("mc");
    expect(modeForCardState("wiederholen")).toBe("tippen");
    expect(modeForCardState("erneut_lernen")).toBe("mc");
  });
});
