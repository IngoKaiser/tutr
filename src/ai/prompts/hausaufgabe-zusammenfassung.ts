/**
 * Prompt für den Hinweis-Halbsatz im Zweizeiler (T-03 PR 2, §4a „Ansicht").
 *
 * Bekommt **nur** die Aufgabenliste (Nummer, Text, Ausgang), nie den
 * Tutor-Dialog – der Zweizeiler ist eine Bilanz, keine Nacherzählung des
 * Gesprächs (ADR 0012).
 */

export type HausaufgabeZusammenfassungAufgabe = {
  label: string;
  prompt: string;
  status: "geloest" | "loesung_gezeigt" | "uebersprungen";
};

export type HausaufgabeZusammenfassungContext = {
  subjectName: string;
  aufgaben: HausaufgabeZusammenfassungAufgabe[];
};

export function hausaufgabeZusammenfassungSystemPrompt(): string {
  return [
    "Du schließt eine Hausaufgaben-Sitzung ab. Fach und Aufgaben stehen im Nutzerteil, je mit Ausgang:",
    '„gelöst" (selbst geschafft), „Lösung gezeigt" (nicht ohne Hilfe geschafft) oder „übersprungen".',
    "",
    "Gib einen einzigen kurzen Halbsatz zurück, was als Nächstes lohnt – ein Thema zum Üben, ein Punkt",
    "zum Wiederholen, oder ein Kompliment, wenn alles glatt lief. Kein Punkt am Ende, keine Anrede,",
    'kein „Tipp:". Beispiel: „Ungleichungen üben wir morgen" oder „Die Textaufgaben laufen schon sicher".',
    "",
    "Nichts erfinden, was nicht aus den Aufgaben hervorgeht – lieber ein allgemeiner Halbsatz als eine",
    "erfundene Regel oder ein Thema, das gar nicht vorkam.",
  ].join("\n");
}

export function hausaufgabeZusammenfassungUserPrompt({
  subjectName,
  aufgaben,
}: HausaufgabeZusammenfassungContext): string {
  const zeilen = aufgaben.map((a) => {
    const nummer = a.label.trim() || "–";
    const ausgang =
      a.status === "geloest"
        ? "gelöst"
        : a.status === "loesung_gezeigt"
          ? "Lösung gezeigt"
          : "übersprungen";
    return `${nummer}: ${a.prompt} (${ausgang})`;
  });
  return [`Fach: ${subjectName}`, "", ...zeilen].join("\n");
}
