import { describe, expect, it } from "vitest";

import { initialsFromLabel } from "./initials";

describe("initialsFromLabel", () => {
  it("nimmt den ersten Buchstaben, groß geschrieben", () => {
    expect(initialsFromLabel("mia")).toBe("M");
    expect(initialsFromLabel("Ben")).toBe("B");
  });

  it("funktioniert auch mit einer E-Mail-Adresse", () => {
    expect(initialsFromLabel("mama@beispiel.de")).toBe("M");
  });

  it("schneidet führende Leerzeichen ab", () => {
    expect(initialsFromLabel("  Mia")).toBe("M");
  });

  it("liefert ein Fragezeichen für leeren Text", () => {
    expect(initialsFromLabel("")).toBe("?");
    expect(initialsFromLabel("   ")).toBe("?");
  });
});
