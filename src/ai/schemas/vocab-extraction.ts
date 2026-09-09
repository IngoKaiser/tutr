import { z } from "zod";

/**
 * Was Vision aus einem Foto einer Vokabelliste zurückgibt (V-03b, ADR 0007 D1).
 *
 * **Bewusst schmal.** §6 M4 nennt für die Foto-Extraktion auch `partOfSpeech`,
 * `example`, `hint` und `page`. Die zeigt die Vokabelliste heute an keiner
 * Stelle an – ein Feld ohne Abnehmer wäre Spekulation, dieselbe Überlegung
 * wie gegen `self_assessment` in V-01. Kommt nach, sobald die Liste sie
 * darstellt.
 *
 * `confidence` ist der eigentliche Grund, warum hier überhaupt ein eigenes
 * Feld steht: ADR 0007 D2 markiert unsichere Zeilen und sortiert sie nach
 * oben, und D1 nennt Handschrift ausdrücklich als den schweren Fall. Zwei
 * Stufen statt einer Zahl – „0,73" wäre eine Genauigkeit, die das Modell
 * nicht hat, und niemand wüsste, wo die Grenze liegt.
 */
export const vocabExtractionSchema = z.object({
  rows: z.array(
    z.object({
      /** Das fremdsprachige Wort, wie es auf dem Bild steht. */
      term: z.string(),
      /** Die Übersetzung daneben. Leer, wenn auf dem Bild keine steht. */
      translation: z.string(),
      /**
       * `niedrig`, wenn die Zeile schlecht lesbar war, geraten ist oder
       * unvollständig – daraus wird in der Liste ein „prüfen"-Hinweis.
       */
      confidence: z.enum(["hoch", "niedrig"]),
    }),
  ),
});

export type VocabExtraction = z.infer<typeof vocabExtractionSchema>;
export type ExtractedRow = VocabExtraction["rows"][number];
