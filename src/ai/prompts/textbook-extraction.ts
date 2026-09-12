/**
 * Prompt für die Foto-Erkennung eines Inhaltsverzeichnisses (L-01, §7/§10).
 *
 * Als Funktion mit typisierten Parametern, System- und Nutzerteil getrennt
 * (`src/ai/prompts/README.md`). Das Bild ist Nutzereingabe und steht nie im
 * Systemprompt.
 */

export type TextbookExtractionContext = {
  /** Das Fach, dem dieses Lehrwerk zugeordnet wird – nur zur Einordnung, keine geschlossene Auswahl. */
  fach: string;
};

export function textbookExtractionSystemPrompt({ fach }: TextbookExtractionContext): string {
  return [
    `Du liest das Inhaltsverzeichnis eines Schulbuchs für das Fach ${fach} aus einem Foto.`,
    "",
    'Trage "titel" (Buchtitel) und "verlag" ein, wenn sie auf dem Foto zu sehen sind (Umschlag, Kopf- oder Fußzeile) – sonst bleiben sie leer (null). Rate nie, was nicht auf dem Bild steht.',
    "",
    '"jahrgangsstufe" ist die Klassenstufe, wenn sie genannt ist (z. B. "8" bei "Band 8") – sonst null.',
    "",
    'Gib jedes Kapitel als eigenen Eintrag in "kapitel" zurück, in der gedruckten Reihenfolge, beginnend bei "sequence": 1. "titel" genau wie gedruckt, inklusive Kapitelnummer. "seiten" als Freitext genau wie angegeben (z. B. "48–67") – bleibt leer (null), wenn keine Seitenzahl dabeisteht.',
    "",
    "Ein Inhaltsverzeichnis listet oft Unterkapitel oder Abschnitte ein – nimm nur die oberste Gliederungsebene (die eigentlichen Kapitel), keine Unterpunkte.",
    "",
    "Was kein Kapitel ist, bleibt draußen: Vorwort, Register, Anhang, Impressum.",
    "",
    "Ist auf dem Foto kein Inhaltsverzeichnis zu erkennen, gib eine leere Kapitelliste zurück statt zu raten.",
  ].join("\n");
}

/** Der Text neben dem Bild. Kurz: Die Arbeit steht im Systemprompt. */
export function textbookExtractionUserPrompt(): string {
  return "Lies das Inhaltsverzeichnis auf diesem Bild.";
}
