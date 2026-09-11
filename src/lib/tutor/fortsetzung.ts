/**
 * Wann eine Frage ein bestehendes Gespräch fortsetzt (T-19b, ADR 0014 D1).
 *
 * Die Entscheidung steht hier und nicht als `interval` in der SQL-Abfrage:
 * Sie ist eine Setzung, über die wir nachdenken wollen, wenn sie sich als
 * falsch erweist – und in einer `where`-Klausel läge sie unsichtbar und
 * ungetestet. Der Route Handler holt sich das zuletzt benutzte Gespräch des
 * Fachs und fragt hier, ob es noch zählt. Dieselbe Trennung wie bei
 * `loeseFachZuordnungAuf()` nebenan: Die Datenbank liefert Zeilen, die
 * Entscheidung fällt in reinem Code.
 */

/**
 * Wie lange ein Gespräch offen bleibt für die nächste Frage.
 *
 * Lang genug für „ach, und noch was", kurz genug, dass die Hausaufgabe von
 * heute Abend nicht an die von heute Mittag geklebt wird. Geraten, nicht
 * gemessen (ADR 0014, „Schlecht / Preis") – wenn Unzusammenhängendes
 * aneinanderklebt oder weiter Dubletten entstehen, ist das die Zahl, die
 * sich ändert.
 */
export const FORTSETZUNGSFENSTER_MINUTEN = 30;

const FENSTER_MS = FORTSETZUNGSFENSTER_MINUTEN * 60 * 1000;

/**
 * Liegt die letzte Aktivität nah genug, um dort weiterzuschreiben?
 *
 * Ein Zeitpunkt in der Zukunft (Uhren laufen auseinander, `now()` der
 * Datenbank gegen die Uhr der Laufzeit) gilt als „gerade eben", nicht als
 * ungültig: Die einzige Deutung wäre sonst „lange her", und das ist
 * nachweislich falsch.
 */
export function istFortsetzbar(letzteAktivitaet: Date, jetzt: Date): boolean {
  const abstand = jetzt.getTime() - letzteAktivitaet.getTime();
  if (Number.isNaN(abstand)) return false;
  return abstand < FENSTER_MS;
}
