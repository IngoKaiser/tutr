import { describe, expect, it } from "vitest";

import {
  deutscheStimmenSortiert,
  diktatAnhaengen,
  stimmGuete,
  waehleDeutscheStimme,
} from "./speech";

/** Minimaler Stimmen-Stub – nur die Felder, die die Auswahl liest. */
function stimme(
  lang: string,
  opt: { local?: boolean; default?: boolean; name?: string } = {},
): SpeechSynthesisVoice {
  const name = opt.name ?? lang;
  return {
    lang,
    localService: opt.local ?? false,
    default: opt.default ?? false,
    name,
    voiceURI: name,
  } as SpeechSynthesisVoice;
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

describe("stimmGuete – Qualität schlägt „lokal“ (T-07b)", () => {
  it("wertet eine Premium-/Enhanced-Stimme deutlich höher", () => {
    const premium = stimme("de-DE", { name: "Anna (Premium)" });
    const kompakt = stimme("de-DE", { local: true, name: "Anna" });
    expect(stimmGuete(premium)).toBeGreaterThan(stimmGuete(kompakt));
  });

  it("straft „compact“ und „eloquence“ ab", () => {
    expect(stimmGuete(stimme("de-DE", { name: "Anna Compact", local: true }))).toBeLessThan(0);
  });

  it("nimmt bei sonst gleichem die lokale Stimme (Datenweg, ADR 0011 D2)", () => {
    const lokal = stimme("de-DE", { local: true, name: "Reed" });
    const netz = stimme("de-DE", { local: false, name: "Sandy" });
    expect(stimmGuete(lokal)).toBeGreaterThan(stimmGuete(netz));
  });
});

describe("deutscheStimmenSortiert", () => {
  it("bringt die neuronale Stimme vor die kompakte", () => {
    const sortiert = deutscheStimmenSortiert([
      stimme("de-DE", { local: true, name: "Anna" }),
      stimme("de-DE", { name: "Grandma (Premium)" }),
      stimme("de-DE", { name: "Eloquence Deutsch", local: true }),
    ]);
    expect(sortiert.map((v) => v.name)).toEqual(["Grandma (Premium)", "Anna", "Eloquence Deutsch"]);
  });

  it("bei gleicher Güte kommt die exakte Region zuerst (de-DE vor de-AT)", () => {
    const sortiert = deutscheStimmenSortiert(
      [
        stimme("de-AT", { local: true, name: "Wien" }),
        stimme("de-DE", { local: true, name: "Berlin" }),
      ],
      "de-DE",
    );
    expect(sortiert[0]?.name).toBe("Berlin");
  });

  it("nimmt nur die Sprachfamilie, keine fremden Sprachen", () => {
    const sortiert = deutscheStimmenSortiert([
      stimme("en-US", { local: true }),
      stimme("de-CH", { local: true, name: "Zürich" }),
      stimme("fr-FR", { local: true }),
    ]);
    expect(sortiert.map((v) => v.name)).toEqual(["Zürich"]);
  });
});

describe("waehleDeutscheStimme", () => {
  it("gibt die beste deutsche Stimme zurück", () => {
    const v = waehleDeutscheStimme([
      stimme("de-DE", { local: true, name: "Anna" }),
      stimme("de-DE", { name: "Markus (Enhanced)" }),
    ]);
    expect(v?.name).toBe("Markus (Enhanced)");
  });

  it("gibt null zurück, wenn keine deutsche Stimme da ist", () => {
    expect(waehleDeutscheStimme([stimme("en-US"), stimme("fr-FR")])).toBeNull();
    expect(waehleDeutscheStimme([])).toBeNull();
  });
});
