import { z } from "zod";

/**
 * Was Vision aus einem Foto einer Hausaufgabe zurückgibt (T-03, §4a Schritt 1;
 * `fach` seit T-13, ADR 0013 D7).
 *
 * §4a: „Vision erkennt einzelne **Aufgaben** (Nummerierung a/b/c,
 * Teilaufgaben, Textaufgaben, Lückentexte) und legt eine **Aufgabenliste**
 * an."
 *
 * **Bewusst schmal**, dieselbe Überlegung wie bei `vocab-extraction.ts`:
 * §4a nennt für später auch Thema-/Lernziel-Zuordnung und Fälligkeit – das
 * ist T-03 (voll) bzw. Stufe 2 und hätte hier keinen Abnehmer.
 *
 * `label` und `prompt` sind getrennt, weil die Nummer zum Wiederfinden auf
 * dem Blatt dient („mach mal 5b“) und der Text zum Arbeiten. Zusammen in
 * einem Feld ließe sich beides nicht mehr trennen.
 *
 * **`fach`** ist dieselbe geschlossene Auswahl wie bei `fachZuordnungSchema()`
 * (`lib/tutor/fach-zuordnung.ts` löst beide gleich auf): Das Schema entsteht
 * erst zur Aufrufzeit aus der Fächerliste des Kindes, `"unklar"` immer
 * zusätzlich erlaubt. Kein zweiter Modellaufruf nötig – das Foto geht ohnehin
 * durch Vision, und ein Aufgabenblatt sagt sein Fach meist in der ersten
 * Zeile.
 */
export function homeworkExtractionSchema(fachNamen: readonly string[]) {
  // Wie in `fachZuordnungSchema()`: erst eine einfache `string[]`, dann
  // casten – der Spread mit dem literalen `"unklar"` am Ende leitet
  // TypeScript sonst einen Tupeltyp her, der sich nicht in `z.enum()`s
  // „mindestens ein Element vorn" überführen lässt.
  const faecherWerte: string[] = [...fachNamen, "unklar"];
  return z.object({
    fach: z.enum(faecherWerte as [string, ...string[]]),
    tasks: z.array(
      z.object({
        /** Die Nummer, wie sie auf dem Blatt steht: „5a“, „Nr. 7“, „2“. Leer, wenn keine da ist. */
        label: z.string(),
        /** Der Aufgabentext, so vollständig wie lesbar. */
        prompt: z.string(),
        /**
         * `niedrig`, wenn der Text schlecht lesbar war oder abgeschnitten
         * scheint – die Liste zeigt das an, damit das Kind nachbessern kann,
         * bevor der Tutor auf einen halben Satz antwortet.
         */
        confidence: z.enum(["hoch", "niedrig"]),
      }),
    ),
  });
}

export type HomeworkExtraction = z.infer<ReturnType<typeof homeworkExtractionSchema>>;
export type ExtractedTask = HomeworkExtraction["tasks"][number];
