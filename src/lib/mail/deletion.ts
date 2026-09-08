/**
 * Die Benachrichtigungsmail beim Selbstlöschen eines Kindes (F-06e, ADR 0006
 * D6).
 *
 * Gilt nur für diesen einen Weg. Löscht ein Elternteil ein Kind, weiß es
 * bereits davon – eine Mail an sich selbst trüge nichts bei. Löscht ein Kind
 * sich selbst, ist die Mail der einzige Kanal: Kind-Profile sind pseudonym,
 * es gibt keinen anderen Weg, das Elternteil zu erreichen.
 *
 * Sie siezt, aus demselben Grund wie die Einwilligungsmail (`consent.ts`):
 * Sie geht an einen Erwachsenen. Der Text nennt keinen Grund für das
 * Löschen – den kennt die Anwendung nicht, und zu raten wäre unehrlich.
 */

export type DeletionEmail = { subject: string; text: string };

export function deletionEmail(params: {
  firstName: string;
  /** Vornamen der Kinder, die bei diesem Elternteil noch verknüpft sind. */
  remainingFirstNames: string[];
}): DeletionEmail {
  const { firstName, remainingFirstNames } = params;

  const rest =
    remainingFirstNames.length === 0
      ? "Damit ist kein Kind mehr mit Ihrer Adresse bei tutr verknüpft."
      : remainingFirstNames.length === 1
        ? `${remainingFirstNames[0]} ist weiterhin mit Ihrer Adresse verknüpft; daran ändert sich nichts.`
        : `${remainingFirstNames.join(", ")} sind weiterhin mit Ihrer Adresse verknüpft; daran ändert sich nichts.`;

  const text = `${firstName} hat das eigene Konto bei tutr gelöscht. Alle Daten – Lernstand, Karten, Vokabeln, Gespräche mit dem Tutor – sind entfernt.

${rest}`;

  return { subject: `${firstName} hat das Konto bei tutr gelöscht`, text };
}
