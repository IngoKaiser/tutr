/**
 * Prompt für „Claude sucht das Lehrwerk im Internet" (L-01, §7/§10).
 *
 * Anders als bei einem Foto gibt es hier keine verlässliche Quelle direkt vor
 * Augen – der Prompt verlangt deshalb ausdrücklich Websuche statt Erinnerung
 * aus dem Training und einen ehrlichen Rückzieher (`gefunden: false`), wenn
 * die Suche kein eindeutiges Ergebnis liefert. Das Websuche-Tool selbst steht
 * nicht hier, sondern in der Anfrage in `ai/client.ts` (`tools`).
 */

export type TextbookSuggestionContext = {
  /** Der ungefähre Titel, wie ihn das Kind/Elternteil eingegeben hat, z. B. "Découvertes 4" oder "das Klett-Mathebuch 8". */
  titelHinweis: string;
  /** Das Fach, dem dieses Lehrwerk zugeordnet wird. */
  fach: string;
};

export function textbookSuggestionSystemPrompt({
  titelHinweis,
  fach,
}: TextbookSuggestionContext): string {
  return [
    `Ein Kind oder Elternteil sucht das Schulbuch für das Fach ${fach} mit diesem ungefähren Titel: "${titelHinweis}".`,
    "",
    "Nutze das Websuche-Tool, um das genaue Lehrwerk zu identifizieren – Verlagsseite, Schulbuchzentrum oder ein öffentlich einsehbares Inhaltsverzeichnis. Verlass dich nicht auf dein Vorwissen allein, so bekannt das Buch auch scheint: Auflage, Ausgabe und Kapitelreihenfolge unterscheiden sich zwischen Regionen und Jahren.",
    "",
    'Findest du kein eindeutiges, passendes Ergebnis, setze "gefunden" auf false und lass "titel", "verlag", "jahrgangsstufe" leer (null) und "kapitel"/"quellen" als leere Liste – erfinde nichts, nur damit die Felder gefüllt sind.',
    "",
    'Findest du ein eindeutiges Ergebnis: "titel" und "verlag" wie auf der Quelle genannt, "jahrgangsstufe" wenn erkennbar (sonst null).',
    "",
    '"kapitel": jedes Kapitel als eigener Eintrag, in der Reihenfolge des Buchs, beginnend bei "sequence": 1. "titel" wie in der Quelle. "seiten" nur, wenn die Quelle Seitenzahlen nennt (sonst null).',
    "",
    '"quellen": die URLs, auf die sich der Vorschlag stützt – mindestens eine, wenn "gefunden" true ist.',
    "",
    '"hinweis": nenne Unsicherheiten wie mehrere gefundene Auflagen oder eine Kapitelliste aus einer älteren Ausgabe – sonst null.',
    "",
    "Das ist ein Vorschlag, keine Tatsache: Er wird in der Oberfläche als ungeprüft markiert und vor dem Speichern von Hand bestätigt.",
  ].join("\n");
}

export function textbookSuggestionUserPrompt(): string {
  return "Finde das Lehrwerk und seine Kapitelstruktur.";
}
