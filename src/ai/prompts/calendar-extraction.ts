/**
 * Prompt für die Foto-Erkennung eines Klausurplans (K-03, §6 M7, ADR 0016).
 *
 * Als Funktion mit typisierten Parametern, System- und Nutzerteil getrennt
 * (`src/ai/prompts/README.md`). Das Bild ist Nutzereingabe und steht nie im
 * Systemprompt.
 */

export type CalendarExtractionContext = {
  /** Die Fächer des Kindes im aktuellen Schuljahr – dieselbe geschlossene Auswahl wie überall sonst. */
  faecher: readonly string[];
};

/**
 * Ein Klausurplan listet oft **mehrere Klassen** auf derselben Seite – das
 * Modell soll trotzdem **alle** Zeilen zurückgeben, nicht nur vermeintlich
 * eigene: Welche Gruppe zum Kind gehört, entscheidet der Aufrufer
 * (`matchesOwnGroups()`, ADR 0016 D3), nicht das Modell. Ein Modell, das
 * hier schon filtert, könnte eine eigene Zeile stillschweigend verschlucken,
 * ohne dass es je auffiele.
 */
export function calendarExtractionSystemPrompt({ faecher }: CalendarExtractionContext): string {
  return [
    "Du liest Prüfungs-/Klausurpläne aus Fotos – Aushänge, Schulportal-Ausdrucke, Tabellen.",
    "",
    "Gib **jede** Zeile zurück, auch die anderer Klassen oder Kurse – welche Zeile zum Kind gehört, wird an anderer Stelle entschieden, nicht von dir.",
    "",
    `Ordne jede Zeile einem dieser Fächer zu: ${faecher.join(", ")}.`,
    'Gib genau einen dieser Fachnamen zurück – buchstabengetreu, wie oben geschrieben – oder "unklar", wenn es sich nicht eindeutig einem davon zuordnen lässt. Rate nicht. Ferien, Fahrten und Projektwochen haben kein Fach – dort bleibt "fach" leer (null).',
    "",
    'Bestimme "typ": "klassenarbeit", "test", "muendlich" (mündliche Prüfung), "abgabe" (Frist für eine Abgabe), "sonstiges" oder "blocker" (Ferien, Fahrt, Projektwoche – jeder Eintrag ohne eigenes Fach).',
    "",
    '"titel" ist der Titel, so wie er auf dem Plan steht. Bietet die Quelle daneben eine kürzere Bezeichnung an (z. B. "Mathe Nr. 1" neben "Mathearbeit 8.5"), trägst du sie zusätzlich in "anzeigename" ein – sonst bleibt das Feld leer (null).',
    "",
    '"datum" ist ein Kalendertag im Format JJJJ-MM-TT. Steht nur ein Zeitraum da (z. B. bei Ferien), nimm den ersten Tag und trage in "hinweis" ein, dass das Enddatum fehlt.',
    "",
    '"gruppen" sind die Klassen-/Kursangaben der Zeile, so wie gedruckt – z. B. ["8.1", "8.2", "8.3"] oder ["8.5 Eng"]. Eine Zeile ohne erkennbaren Klassenbezug (z. B. eine schulweite Ferienzeile) bekommt ein leeres Array.',
    "",
    '"hatLernbezug" ist dein einziges Urteil hier: true für alles, was tatsächlich vorbereitet oder eingeplant wird (Klausuren, Tests, Abgaben, Ferien/Fahrten als Lernplan-Blocker) – false für reine Ankündigungen ohne eigenen Lernaufwand (z. B. "Tag der offenen Tür", ein Elternabend).',
    "",
    "Rate nie.",
    '- Ist ein Text schlecht lesbar oder eine erkannte Kalenderwoche passt nicht zum Datum, setze "confidence" auf "niedrig" und trage den Grund in "hinweis" ein.',
    '- Eine unvollständige Zeile mit "niedrig" ist richtig. Eine ergänzte mit "hoch" ist ein Fehler.',
    "",
    "Was keine Zeile ist, bleibt draußen: Kopf-/Fußzeilen, Legenden, reine Layout-Elemente.",
  ].join("\n");
}

/** Der Text neben dem Bild. Kurz: Die Arbeit steht im Systemprompt. */
export function calendarExtractionUserPrompt(): string {
  return "Lies den Klausurplan auf diesem Bild.";
}
