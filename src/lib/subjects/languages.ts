/**
 * Sprachen für die Fachanlage (F-16a, ADR 0009).
 *
 * Feste Liste statt Freitext: `subject.language` steuert ab V-06a die
 * Richtungswahl beim Üben (EN → DE / DE → EN) – ein Fach ohne festen Code
 * hat keine Rückrichtung (Frage-Antwort-Fächer wie Geschichte), und
 * Tippfehler wie „Englsich" dürften dort nicht als eigener Wert ankommen
 * und eine zweite, leere Rückrichtung erzeugen.
 *
 * ISO-639-1, wo vorhanden. Latein hat dort keinen zweistelligen Code (erst
 * in ISO 639-2: „lat") – hier trotzdem zweistellig (`la`), das ist der
 * gängige Web-Sprachcode (`lang="la"`) und genügt für die Richtungswahl, die
 * nur Gleichheit/Ungleichheit braucht, keine Normkonformität.
 */
export type LanguageOption = { code: string; label: string };

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "en", label: "Englisch" },
  { code: "fr", label: "Französisch" },
  { code: "es", label: "Spanisch" },
  { code: "la", label: "Latein" },
  { code: "it", label: "Italienisch" },
];

/** Der deutsche Name zu einem Code, oder der Code selbst, falls er fehlt (sollte nicht vorkommen). */
export function languageLabel(code: string): string {
  return LANGUAGE_OPTIONS.find((o) => o.code === code)?.label ?? code;
}
