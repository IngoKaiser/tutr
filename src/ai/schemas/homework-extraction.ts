import { z } from "zod";

/**
 * Was Vision aus einem Foto einer Hausaufgabe zurückgibt (T-03, §4a Schritt 1).
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
 */
export const homeworkExtractionSchema = z.object({
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

export type HomeworkExtraction = z.infer<typeof homeworkExtractionSchema>;
export type ExtractedTask = HomeworkExtraction["tasks"][number];
