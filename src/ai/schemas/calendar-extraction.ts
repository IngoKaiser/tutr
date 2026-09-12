import { z } from "zod";

/**
 * Was Vision aus einem Foto eines Klausurplans zurückgibt (K-03, §6 M7,
 * ADR 0016).
 *
 * **Bewusst schmal**, dieselbe Überlegung wie bei `homeworkExtractionSchema()`:
 * §8 nennt für `CalendarEvent` außerdem Uhrzeit und Themen-Hinweis – ohne
 * Anzeige dafür (ADR 0016 D5, Scope-Schnitt K-03) wäre das ein Feld ohne
 * Abnehmer, deshalb fragt der Prompt gar nicht erst danach.
 *
 * **`fach`** ist dieselbe geschlossene Auswahl wie bei `fachZuordnungSchema()`/
 * `homeworkExtractionSchema()`: Das Schema entsteht erst zur Aufrufzeit aus
 * der Fächerliste des Kindes, `"unklar"` immer zusätzlich erlaubt, `null` nur
 * bei `typ: "blocker"` (Ferien/Fahrten haben kein Fach).
 *
 * **`hatLernbezug`** ist die einzige Stelle, an der das Modell urteilt statt
 * nur abliest: „Tag der offenen Tür" trifft niemandes Gruppenfilter nicht,
 * hat aber trotzdem keinen Lernbezug (§6 M7). Der **Gruppenfilter** selbst
 * ist ausdrücklich **nicht** Teil dieser Antwort – das Modell kennt die
 * eigenen Gruppen des Kindes nicht (ADR 0016 D3, die stehen erst nach der
 * Einrichtung fest); `matchesOwnGroups()` (`lib/calendar/group-match.ts`)
 * wendet der Aufrufer getrennt an.
 *
 * **`typ: "blocker"`** fasst Ferien/Fahrt/Projektwoche zu einem Wert zusammen
 * (ADR 0016 D5) – die feinere Unterscheidung aus `docs/fixtures/beispiel-
 * import-klausurplan.json` (`ferien`/`fahrt`/`projekt`) hat keinen Abnehmer,
 * seit klar ist, dass Blocker ohnehin nicht gespeichert werden.
 */
export function calendarExtractionSchema(fachNamen: readonly string[]) {
  // Wie in `fachZuordnungSchema()`/`homeworkExtractionSchema()`: erst eine
  // einfache `string[]`, dann casten – der Spread mit dem literalen
  // `"unklar"` am Ende leitet TypeScript sonst einen Tupeltyp her, der sich
  // nicht in `z.enum()`s „mindestens ein Element vorn" überführen lässt.
  const faecherWerte: string[] = [...fachNamen, "unklar"];
  return z.object({
    events: z.array(
      z.object({
        typ: z.enum(["klassenarbeit", "test", "muendlich", "abgabe", "sonstiges", "blocker"]),
        fach: z.enum(faecherWerte as [string, ...string[]]).nullable(),
        /** Wie auf dem Plan gedruckt, z. B. „Mathearbeit 8.5". */
        titel: z.string(),
        /** Kürzerer Titel fürs Kind, falls die Quelle einen anbietet (sonst `null`). */
        anzeigename: z.string().nullable(),
        /** ISO-Datum `YYYY-MM-DD`. */
        datum: z.string(),
        /** Rohe Gruppentokens wie gedruckt, z. B. `["8.5", "8.5 Eng"]`. Leer = betrifft alle. */
        gruppen: z.array(z.string()),
        /** Ist das überhaupt ein Termin mit Lernbezug (Klausur, Abgabe, Ferien …) statt bloßer Ankündigung? */
        hatLernbezug: z.boolean(),
        /** Auffälligkeiten wie „Enddatum fehlt in der Quelle" – `null` ohne Auffälligkeit. */
        hinweis: z.string().nullable(),
        /**
         * `niedrig`, wenn eine erkannte Kalenderwoche vom Datum abweicht oder
         * der Text schlecht lesbar war (ADR 0016 D6) – die Liste zeigt das an,
         * damit das Kind nachprüfen kann.
         */
        confidence: z.enum(["hoch", "niedrig"]),
      }),
    ),
  });
}

export type CalendarExtraction = z.infer<ReturnType<typeof calendarExtractionSchema>>;
export type ExtractedCalendarEvent = CalendarExtraction["events"][number];
