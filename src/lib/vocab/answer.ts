/**
 * Bewertung einer getippten Antwort (V-02, §6 M4: „Tippfehlertoleranz,
 * Artikel-/Genus-Pflicht bei FR/ES").
 *
 * Drei Stufen statt zwei: `fast` ist die Antwortqualität selbst als drittes
 * Signal für die Session (`outcome.ts`) – ohne sie bräuchte Tippen eine Uhr,
 * um zwischen „Kann ich" und „Übe ich" zu unterscheiden.
 *
 * Reihenfolge der Prüfung ist die Reihenfolge der Nachsicht: exakt, dann
 * fehlender Artikel, dann ignorierte Akzente, dann Tippfehlertoleranz.
 */

export type AnswerQuality = "richtig" | "fast" | "falsch";

// Nur die Artikel, die als vorangestelltes Wort auftreten – reicht für FR/ES
// (§6 M4) und DE. Kein Anspruch auf Vollständigkeit über alle Zielsprachen.
const LEADING_ARTICLES = new Set([
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "le",
  "la",
  "les",
  "l'",
  "un",
  "une",
  "el",
  "los",
  "las",
  "un",
  "una",
]);

/** Auch für Multiple Choice: dort ist es ein exakter Vergleich der Beschriftung, keine Toleranz. */
export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripAccents(value: string): string {
  // Zerlegt z. B. "é" in "e" + Akzent (NFD) und entfernt die kombinierenden
  // Akzentzeichen (U+0300–U+036F) – als Escape, nicht als rohes Zeichen im
  // Quelltext, das sich unbemerkt falsch kopieren ließe.
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Ab wie vielen Fehlern eine getippte Antwort nicht mehr toleriert wird. */
function toleranceFor(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  return 2;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) distances[i]![0] = i;
  for (let j = 0; j < cols; j++) distances[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i]![j] = Math.min(
        distances[i - 1]![j]! + 1,
        distances[i]![j - 1]! + 1,
        distances[i - 1]![j - 1]! + cost,
      );
    }
  }
  return distances[rows - 1]![cols - 1]!;
}

export function evaluateAnswer(expected: string, given: string): AnswerQuality {
  const exp = normalize(expected);
  const giv = normalize(given);
  if (exp === giv) return "richtig";
  if (giv === "") return "falsch";

  const expWords = exp.split(" ");
  if (expWords.length > 1 && LEADING_ARTICLES.has(expWords[0]!)) {
    const withoutArticle = expWords.slice(1).join(" ");
    if (withoutArticle === giv) return "fast";
  }

  if (stripAccents(exp) === stripAccents(giv)) return "fast";

  if (levenshtein(exp, giv) <= toleranceFor(exp.length)) return "fast";

  return "falsch";
}
