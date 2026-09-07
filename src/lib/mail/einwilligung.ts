/**
 * Die Einwilligungsmail an die Eltern (F-06, ADR 0005).
 *
 * Drei Entscheidungen aus dem Beschluss zu ADR 0005 stecken im Wortlaut:
 *
 * 1. **Sie siezt, obwohl die App duzt.** Sie geht an einen Erwachsenen, der
 *    die App nicht kennt.
 * 2. **Sie nennt ungefragt, was Eltern nicht sehen.** Sonst ist das die erste
 *    Rückfrage – und in der App ist es ohnehin per RLS erzwungen (D4).
 * 3. **Sie hat einen echten Nein-Weg.** Ohne den wäre „Einwilligung" nur ein
 *    Wort.
 *
 * Der Ja-Weg trägt keinen Token: Er führt auf die normale Anmeldung, und der
 * Magic Link an genau diese Adresse ist der Beweis. Das ist stärker als ein
 * Token in derselben Mail und spart die ganze Einlöse-Mechanik (ADR 0005).
 */

export type Einwilligungsmail = { betreff: string; text: string };

export function einwilligungsmail(kind: { vorname: string; herkunft: string }): Einwilligungsmail {
  const { vorname, herkunft } = kind;

  const text = `${vorname} hat sich bei tutr angemeldet, einer Lern-App für die Schule, und Ihre Adresse als Kontakt der Eltern angegeben.

tutr hilft beim Üben von Unterrichtsthemen, Vokabeln und Prüfungen. Von ${vorname} sind nur Vorname, Jahrgang und Klasse gespeichert — kein Geburtsdatum, keine E-Mail-Adresse, keine Schule.

Einverstanden? Dann melden Sie sich mit dieser Adresse an:
${herkunft}/anmelden

Sie werden damit Kontoinhaber und sehen Termine, Lernstand, Noten und Zusammenfassungen. ${vorname}s Gespräche mit dem Tutor sehen Sie nicht; das ist Absicht.

Nicht einverstanden? Dann schreiben Sie uns über dieselbe Adresse — das Konto und alle Daten werden gelöscht.

Sie hören von uns nur, wenn es etwas zu sagen gibt.`;

  return { betreff: `${vorname} nutzt tutr`, text };
}

/**
 * Was das Kind bei der Registrierung liest, direkt unter dem Feld für die
 * Elternadresse. Kurz, duzend, und ehrlich darüber, dass es nicht blockiert.
 */
export const EINWILLIGUNGSHINWEIS =
  "Wir schicken deinen Eltern eine kurze Nachricht, dass du tutr benutzt. " +
  "Du kannst sofort loslegen — die Nachricht hält dich nicht auf. " +
  "Die Adresse brauchen wir außerdem, falls du dein Gerät verlierst und wieder reinkommen musst.";
