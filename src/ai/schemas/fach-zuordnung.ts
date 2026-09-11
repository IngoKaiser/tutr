import { z } from "zod";

/**
 * Das Ergebnis der Fach-Zuordnung (T-13, ADR 0013 D2) – seit T-19a (ADR 0014
 * D2) zusammen mit dem Gesprächstitel.
 *
 * **Zwei Dinge in einem Aufruf.** Der Titel hätte ein eigener Aufruf sein
 * können; er wäre derselbe Text an dasselbe Modell gewesen. Beides hängt an
 * der ersten Nachricht, beides ist Klassifikationsarbeit – und der Aufruf
 * läuft ohnehin, bevor die erste Antwort gestreamt wird (das Fach entscheidet
 * über die Sprache im Systemprompt).
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
    /**
     * Zwei bis vier Wörter, die das Gespräch benennen (ADR 0014 D2).
     *
     * Nur `.max()`, kein `.min(1)`: Ein leerer Titel ist ein brauchbares
     * Ergebnis – er heißt „mir fällt nichts ein", und `bereinigeTitel()`
     * (`lib/tutor/fach-zuordnung.ts`) fällt dann auf die gekürzte Frage
     * zurück. Ein Schema-Fehler dafür risse den ganzen Aufruf mit, und damit
     * auch die Fach-Zuordnung, die daneben steht.
     *
     * Die Obergrenze ist eine Reißleine gegen einen Titel, der zum Satz
     * wird; die eigentliche Länge regelt der Prompt.
     */
    titel: z.string().max(80),
  });
}

export type FachZuordnungErgebnis = z.infer<ReturnType<typeof fachZuordnungSchema>>["fach"];
