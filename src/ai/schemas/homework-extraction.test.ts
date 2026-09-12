import { describe, expect, it } from "vitest";

import { homeworkExtractionSchema } from "./homework-extraction";

const AUFGABE = { label: "1", prompt: "Kürze 12/18.", confidence: "hoch" as const };

describe("homeworkExtractionSchema", () => {
  it("lässt jeden übergebenen Fachnamen und „unklar“ für das Fach durch (ADR 0013 D7)", () => {
    const schema = homeworkExtractionSchema(["Mathematik", "Französisch"]);
    expect(schema.safeParse({ fach: "Mathematik", tasks: [AUFGABE] }).success).toBe(true);
    expect(schema.safeParse({ fach: "unklar", tasks: [AUFGABE] }).success).toBe(true);
  });

  it("lehnt einen Fachnamen ab, der nicht in der Liste stand – die Auswahl ist geschlossen", () => {
    const schema = homeworkExtractionSchema(["Mathematik"]);
    expect(schema.safeParse({ fach: "Chemie", tasks: [AUFGABE] }).success).toBe(false);
  });

  it("verlangt weiterhin die Aufgabenliste, das Fach allein reicht nicht", () => {
    const schema = homeworkExtractionSchema(["Mathematik"]);
    expect(schema.safeParse({ fach: "Mathematik" }).success).toBe(false);
    expect(schema.safeParse({ fach: "Mathematik", tasks: [] }).success).toBe(true);
  });

  it("funktioniert auch mit einer leeren Fächerliste – dann bleibt beim Fach nur „unklar“", () => {
    const schema = homeworkExtractionSchema([]);
    expect(schema.safeParse({ fach: "unklar", tasks: [AUFGABE] }).success).toBe(true);
    expect(schema.safeParse({ fach: "irgendwas", tasks: [AUFGABE] }).success).toBe(false);
  });
});
