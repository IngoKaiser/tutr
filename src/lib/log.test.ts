import { describe, expect, it } from "vitest";

import { saniereFuerLog } from "./log";

describe("saniereFuerLog", () => {
  it("lässt einen unauffälligen Wert unverändert", () => {
    expect(saniereFuerLog("c9b9738a-108a-4f00-b7fd-1e206a897fda")).toBe(
      "c9b9738a-108a-4f00-b7fd-1e206a897fda",
    );
  });

  it("ersetzt eingeschleuste Zeilenumbrüche, statt eine gefälschte Logzeile durchzulassen", () => {
    expect(saniereFuerLog("echt\n2026-01-01 FEHLER: erfunden")).toBe(
      "echt 2026-01-01 FEHLER: erfunden",
    );
  });

  it("fasst mehrere aufeinanderfolgende Umbrüche zu einem Leerzeichen zusammen", () => {
    expect(saniereFuerLog("a\r\n\r\nb")).toBe("a b");
  });
});
