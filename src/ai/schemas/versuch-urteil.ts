import { z } from "zod";

/**
 * Das Urteil über einen geprüften Hausaufgaben-Versuch (T-03 PR 2, §4a).
 *
 * **Warum ein zweiter, kleiner Modellaufruf statt den Zustand aus dem
 * Fließtext der Antwort zu raten:** ADR 0011 D3 verlangt, dass der Zustand
 * der App gehört, nicht dem Modell – aber ob ein Rechenweg richtig ist,
 * kann nur das Modell beurteilen (`lib/tutor/hint-ladder.ts`s eigener
 * Kommentar dazu). Die Lösung ist nicht, der Fließtext-Antwort zu
 * vertrauen, sondern das Urteil **separat, strukturiert** abzufragen – die
 * App liest ein `enum`, nie einen Text.
 *
 * Drei Werte, nicht zwei: `falsch_loesung_gezeigt` ist ein eigener Fall,
 * weil `hint-ladder.ts`s `darfLoesungWennFalsch`-Ventil dem Modell erlaubt,
 * beim zweiten falschen Versuch die Lösung direkt zu zeigen (§4a „Lösung
 * nach zwei Versuchen") – die App muss wissen, *ob* das passiert ist, um
 * `homework_task.status` richtig zu setzen (`geloest` vs. `loesung_gezeigt`
 * vs. weiter `in_arbeit`).
 */
export const versuchUrteilSchema = z.object({
  urteil: z.enum(["richtig", "falsch", "falsch_loesung_gezeigt"]),
});

export type VersuchUrteil = z.infer<typeof versuchUrteilSchema>["urteil"];
