import { z } from "zod";

/**
 * Was Vision aus einem Foto eines Inhaltsverzeichnisses zurückgibt (L-01,
 * §7/§10).
 *
 * **Bewusst schmal**, dieselbe Überlegung wie bei `calendarExtractionSchema()`:
 * Kein Feld, das keinen Abnehmer hat. `chapters` liefert nur die Struktur
 * (Titel, Seiten, Reihenfolge) – kein Fließtext, keine Aufgaben, das Buch
 * selbst wird nie gespeichert.
 *
 * Ein Foto kann eine Doppelseite oder nur eine Spalte eines längeren
 * Inhaltsverzeichnisses zeigen (§10: „Foto vom Inhaltsverzeichnis
 * (zuverlässig)") – mehrere Fotos werden vom Aufrufer zu einer Liste
 * zusammengeführt (wie bei `extractedEventsToDrafts()`), nicht hier.
 */
export const textbookExtractionSchema = z.object({
  /** Der Buchtitel, falls auf dem Foto zu sehen (Umschlag/Kopfzeile) – sonst `null`. */
  titel: z.string().nullable(),
  /** Der Verlag, falls erkennbar – sonst `null`. Rate nie. */
  verlag: z.string().nullable(),
  /** Die Jahrgangsstufe, falls auf dem Foto genannt (z. B. "8") – sonst `null`. */
  jahrgangsstufe: z.number().int().nullable(),
  kapitel: z.array(
    z.object({
      /** So wie gedruckt, z. B. "3 Unité 3 · Une journée particulière". */
      titel: z.string(),
      /** Seitenangabe als Freitext ("48–67"), weil Bücher auch römisch oder mit Abschnittsnummern zählen. */
      seiten: z.string().nullable(),
      /** Reihenfolge, wie im Inhaltsverzeichnis gedruckt, beginnend bei 1. */
      sequence: z.number().int(),
    }),
  ),
});

export type TextbookExtraction = z.infer<typeof textbookExtractionSchema>;
