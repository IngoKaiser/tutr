/**
 * Eine Initiale für den Avatar im Kopfbereich (F-15).
 *
 * Kein Foto: Ein Bild widerspräche der Pseudonymität des Kind-Profils
 * (§11 – kein Geburtsdatum, keine E-Mail, keine Schul-ID). Die Initiale ist
 * der erste sichtbare Buchstabe, egal ob ein Vorname (Kind) oder eine
 * E-Mail-Adresse (Elternteil) hereinkommt – Letzteres reicht, weil
 * `parent_account.name` selbst nur der lokale Teil der Adresse ist
 * (`onboarding.ts`), eine echte Initiale also nichts gewönne.
 */
export function initialsFromLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}
