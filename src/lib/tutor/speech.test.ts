import { describe, expect, it } from "vitest";

import { diktatAnhaengen, waehleDeutscheStimme } from "./speech";

/** Minimaler Stimmen-Stub – nur die Felder, die die Auswahl liest. */
function stimme(lang: string, localService: boolean, name = lang): SpeechSynthesisVoice {
  return { lang, localService, name, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

describe("diktatAnhaengen", () => {
  it("setzt das erste Häppchen ohne führendes Leerzeichen", () => {
    expect(diktatAnhaengen("", "wie kürzt man Brüche")).toBe("wie kürzt man Brüche");
  });

  it("trennt weitere Häppchen mit genau einem Leerzeichen", () => {
    expect(diktatAnhaengen("Wie kürzt man Brüche", "und warum")).toBe(
      "Wie kürzt man Brüche und warum",
    );
  });

  it("verdoppelt kein Leerzeichen, wenn das Feld schon mit einem endet", () => {
    expect(diktatAnhaengen("Frage: ", "was ist ein Bruch")).toBe("Frage: was ist ein Bruch");
  });

  it("ignoriert leere oder reine Leerzeichen-Erkennung", () => {
    expect(diktatAnhaengen("Text", "   ")).toBe("Text");
  });
});

describe("waehleDeutscheStimme", () => {
  it("nimmt die lokale deutsche Stimme vor einer netzgebundenen", () => {
    const v = waehleDeutscheStimme([
      stimme("de-DE", false, "Google Deutsch"),
      stimme("de-DE", true, "Anna"),
    ]);
    expect(v?.name).toBe("Anna");
  });

  it("fällt auf die Sprachfamilie zurück (de-AT für de-DE)", () => {
    const v = waehleDeutscheStimme([stimme("en-US", true), stimme("de-AT", true, "Wien")], "de-DE");
    expect(v?.name).toBe("Wien");
  });

  it("bevorzugt exakte Sprache vor der Familie", () => {
    const v = waehleDeutscheStimme(
      [stimme("de-AT", true, "Wien"), stimme("de-DE", false, "Berlin")],
      "de-DE",
    );
    expect(v?.name).toBe("Berlin");
  });

  it("gibt null zurück, wenn keine passende Stimme da ist", () => {
    expect(waehleDeutscheStimme([stimme("en-US", true), stimme("fr-FR", true)])).toBeNull();
    expect(waehleDeutscheStimme([])).toBeNull();
  });
});
