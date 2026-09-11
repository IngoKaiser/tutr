import { z } from "zod";

/**
 * Das Ergebnis der Fach-Zuordnung (T-13, ADR 0013 D2).
 *
 * Anders als die übrigen Schemas hier steht die Auswahl nicht zur Schreibzeit
 * fest, sondern hängt vom Kind ab (ADR 0009: frei angelegte Fächer). Das
 * Schema entsteht deshalb erst zur Aufrufzeit aus der Liste der Fächer im
 * aktuellen Schuljahr – dieselbe geschlossene Auswahl, die ADR 0013 D2
 * verlangt, erzwungen von Zod (Structured Output), nicht bloß erbeten im
 * Prompt. Das Modell kann kein Fach zurückgeben, das nicht in der
 * übergebenen Liste stand.
 *
 * `"unklar"` ist ein erlaubtes, kein fehlendes Ergebnis: Eine Frage wie
 * „was ist der Unterschied zwischen Masse und Gewicht" gehört in mehrere
 * Fächer, und eine erzwungene Entscheidung wäre schlechter als keine.
 */
export function fachZuordnungSchema(fachNamen: readonly string[]) {
  // Erst in eine einfache `string[]` binden, dann casten: Der Spread mit dem
  // literalen `"unklar"` am Ende leitet TypeScript sonst einen Tupeltyp her
  // (`[...string[], string]`), der sich nicht in `z.enum()`s erwartetes
  // „mindestens ein Element vorn" (`[string, ...string[]]`) überführen lässt.
  const werte: string[] = [...fachNamen, "unklar"];
  return z.object({
    fach: z.enum(werte as [string, ...string[]]),
  });
}

export type FachZuordnungErgebnis = z.infer<ReturnType<typeof fachZuordnungSchema>>["fach"];
