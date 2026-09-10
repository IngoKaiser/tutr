import { describe, expect, it } from "vitest";

import { istDeutsch, pruefeSprache } from "./language-guard";

describe("pruefeSprache", () => {
  it("erkennt eine deutsche Erklärung", () => {
    const text =
      "Reflexive Verben beschreiben eine Handlung, die auf die handelnde Person zurückwirkt. " +
      "Im Deutschen steht dafür „sich“, und das Pronomen ändert sich mit der Person.";
    expect(pruefeSprache(text).deutsch).toBe(true);
  });

  it("schlägt bei einer englischen Begrüßung an (§15, der Astra-Fehler)", () => {
    const text = "Hey Frida! Cool that you're here. Do you want to do this in English or German?";
    const urteil = pruefeSprache(text);
    expect(urteil.deutsch).toBe(false);
    expect(urteil.grund).toContain("englisch");
  });

  it("bleibt deutsch, wenn französische Vokabeln im Satz stehen (Fremdsprachenfach)", () => {
    const text =
      "Das reflexive Verb „se laver“ heißt „sich waschen“. Du sagst also „je me lave“ für " +
      "„ich wasche mich“ und „tu te laves“ für „du wäschst dich“. Das Pronomen steht vor dem Verb.";
    expect(pruefeSprache(text).deutsch).toBe(true);
  });

  it("wertet einen ganz auf Englisch gehaltenen Erklärtext als Rutscher", () => {
    const text =
      "A reflexive verb describes an action that refers back to the subject. In German you use " +
      "the pronoun that matches the person, and it usually comes right after the verb.";
    expect(pruefeSprache(text).deutsch).toBe(false);
  });

  it("hält einen sehr kurzen Beitrag für unverdächtig", () => {
    expect(pruefeSprache("Ja, genau.").deutsch).toBe(true);
    expect(pruefeSprache("").deutsch).toBe(true);
  });

  it("wertet einen reinen Formelblock nicht als Rutscher", () => {
    expect(pruefeSprache("x^2 + 2x + 1 = (x + 1)^2").deutsch).toBe(true);
  });

  it("kippt einen knappen Fall über Umlaute nach Deutsch", () => {
    // Wenige Funktionswörter, aber „Übung“, „Lösung“, „Verständnis“ tragen ß/ü.
    const text =
      "Übung macht den Meister – die Lösung steht im Verständnis, nicht im Auswendiglernen.";
    expect(pruefeSprache(text).deutsch).toBe(true);
  });

  it("istDeutsch ist die Kurzform von pruefeSprache", () => {
    const text = "The quick brown fox jumps over the lazy dog and then it runs away.";
    expect(istDeutsch(text)).toBe(pruefeSprache(text).deutsch);
    expect(istDeutsch(text)).toBe(false);
  });
});
