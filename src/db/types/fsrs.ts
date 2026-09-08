import { z } from "zod";

/**
 * Das JSONB-Feld `card.fsrs_state` (V-01, ADR 0004 D5): „JSONB nur dort, wo
 * die Struktur wirklich offen ist" – hier ist sie es, weil sie nicht unserer
 * Struktur folgt, sondern der von `ts-fsrs`. `elapsed_days` etwa ist dort
 * schon als veraltet markiert (entfällt mit Version 6.0.0); Einzelspalten
 * dafür würden bei jedem Versions-Sprung eine Migration verlangen, ein
 * JSONB-Feld nicht.
 *
 * `card.due_at` und `card.state` (echte Spalten, siehe `vocab.ts`) sind
 * **Spiegel** dieses Objekts, keine zweite Wahrheit: Sie existieren nur,
 * damit „welche Karten sind fällig" und „wie viele sind neu" ohne einen
 * Ausdrucks-Index auf JSONB auskommen. Geschrieben werden sie ausschließlich
 * zusammen mit `fsrs_state`, in `src/lib/vocab/fsrs.ts` – nirgends sonst.
 *
 * Ein `z.preprocess()` vor der eigentlichen Prüfung, weil `tx.execute()`
 * (der rohe SQL-Weg über `drizzle-orm/postgres-js`, nicht der
 * Query-Builder) ein `jsonb`-Feld als **String** zurückgibt, nicht als
 * geparstes Objekt – gegen einen echten Playwright-Lauf gefunden, nicht
 * angenommen. Damit ist dieselbe Zeile korrekt, ob sie von hier kommt oder
 * (wie in Tests) schon ein echtes Objekt ist.
 */
const rawFsrsCardStateSchema = z.object({
  due: z.coerce.date(),
  stability: z.number(),
  difficulty: z.number(),
  /** @deprecated Wird mit ts-fsrs 6.0.0 entfernt; bis dahin nur mitgeführt. */
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.number().int().min(0).max(3),
  last_review: z.coerce.date().optional(),
});

export const fsrsCardStateSchema = z.preprocess(
  (value) => (typeof value === "string" ? JSON.parse(value) : value),
  rawFsrsCardStateSchema,
);

export type FsrsCardState = z.infer<typeof fsrsCardStateSchema>;
