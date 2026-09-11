import { describe, expect, it } from "vitest";

import { fachZuordnungSchema } from "./fach-zuordnung";

describe("fachZuordnungSchema", () => {
  it("lässt jeden übergebenen Fachnamen und „unklar“ durch", () => {
    const schema = fachZuordnungSchema(["Mathematik", "Französisch"]);
    expect(schema.safeParse({ fach: "Mathematik" }).success).toBe(true);
    expect(schema.safeParse({ fach: "Französisch" }).success).toBe(true);
    expect(schema.safeParse({ fach: "unklar" }).success).toBe(true);
  });

  it("lehnt einen Namen ab, der nicht in der Liste stand – die Auswahl ist geschlossen (ADR 0013 D2)", () => {
    const schema = fachZuordnungSchema(["Mathematik"]);
    expect(schema.safeParse({ fach: "Chemie" }).success).toBe(false);
    expect(schema.safeParse({ fach: "mathematik" }).success).toBe(false);
  });

  it("funktioniert auch mit einer leeren Fächerliste – dann bleibt nur „unklar“", () => {
    const schema = fachZuordnungSchema([]);
    expect(schema.safeParse({ fach: "unklar" }).success).toBe(true);
    expect(schema.safeParse({ fach: "irgendwas" }).success).toBe(false);
  });
});
