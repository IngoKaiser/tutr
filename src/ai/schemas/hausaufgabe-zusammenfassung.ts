import { z } from "zod";

/**
 * Was das Modell zum Zweizeiler beisteuert (T-03 PR 2, §4a „Ansicht").
 *
 * **Bewusst nur die Empfehlung, nicht der ganze Satz.** Die Statistik – wie
 * viele Aufgaben, wie viele selbst gelöst, wie viele mit Lösung – kennt die
 * App aus dem Aufgabenzustand selbst (`lib/tutor/hausaufgabe-zusammenfassung.ts`
 * `bilanziere()`, ADR 0011 D3: Zustand lebt in der App). Dem Modell bleibt nur
 * die eine Einschätzung, die nur ein Blick auf die Aufgaben selbst hergibt:
 * ein kurzer Hinweis, was als Nächstes lohnt.
 */
export const hausaufgabenZusammenfassungSchema = z.object({
  /** Ein knapper Halbsatz, z. B. „Ungleichungen üben wir morgen" – ohne Punkt am Ende. */
  hinweis: z.string(),
});

export type HausaufgabenZusammenfassung = z.infer<typeof hausaufgabenZusammenfassungSchema>;
