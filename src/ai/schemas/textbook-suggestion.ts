import { z } from "zod";

/**
 * Was die Websuche-Runde zu einem angegebenen (ungefähren) Lehrwerk-Titel
 * zurückgibt (L-01, §7/§10 „Claudes Vorwissen (markiert)").
 *
 * **Kein Fließtext, keine Aufgaben** – wie bei `textbookExtractionSchema()`
 * nur die Struktur. Anders als beim Foto ist das hier nie „zuverlässig"
 * (§10): `gefunden: false` ist der explizite Ausweg, wenn die Suche kein
 * eindeutiges Ergebnis liefert – das Modell soll nicht raten, nur weil ein
 * Schema ausgefüllt werden will. `quellen` macht den Vorschlag nachprüfbar,
 * bevor er markiert (Enum-Wert `claude_vorwissen`, `textbook.ts`) gespeichert
 * wird.
 */
export const textbookSuggestionSchema = z.object({
  /** `false`, wenn die Suche kein eindeutiges, passendes Lehrwerk fand – dann sind die übrigen Felder leer/leere Liste. */
  gefunden: z.boolean(),
  titel: z.string().nullable(),
  verlag: z.string().nullable(),
  jahrgangsstufe: z.number().int().nullable(),
  kapitel: z.array(
    z.object({
      titel: z.string(),
      seiten: z.string().nullable(),
      sequence: z.number().int(),
    }),
  ),
  /** Die für den Vorschlag genutzten Fundstellen (URLs), damit sich das nachprüfen lässt. */
  quellen: z.array(z.string()),
  /** Auffälligkeiten wie "mehrere Auflagen gefunden, Reihenfolge kann abweichen" – `null` ohne Auffälligkeit. */
  hinweis: z.string().nullable(),
});

export type TextbookSuggestion = z.infer<typeof textbookSuggestionSchema>;
