/**
 * Sprachwächter (T-02a, Konzept §15, ADR 0010 D3).
 *
 * Der Astra-Tutor begrüßte auf Englisch in einer deutschen Mathe-Lektion.
 * tutr schließt das per Test aus – und dieser Detektor ist das Test-
 * instrument: rein, ohne API, gegen feste Beispiele geprüft.
 *
 * **Was er ist:** eine Heuristik über Funktionswörter. Deutsch und Englisch
 * unterscheiden sich zuverlässig in ihren häufigsten kleinen Wörtern
 * (`der/die/und/ist/nicht` gegen `the/and/is/not`). Das trägt auch dann,
 * wenn im deutschen Text Fachbegriffe oder – im Fremdsprachenfach –
 * fremdsprachige Vokabeln stehen: Die Zielsprache in Beispielen und Zitaten
 * ist erlaubt (ADR 0010 D3), solange die Erklärung drumherum deutsch bleibt.
 * Die eigentliche Fach-Ausnahme sitzt im Systemprompt, nicht hier.
 *
 * **Was er nicht ist:** ein Torwächter. Das Ergebnis wird nach dem Streamen
 * an `tutor_message.language_ok` geschrieben, nichts wird verworfen. Häuft
 * sich `false` im Betrieb, ist das das Signal, die Architektur noch einmal
 * aufzumachen – nicht, den Detektor zu verschärfen.
 */

/** Häufigste deutsche Funktionswörter – kleine Wörter, die kaum ein deutscher Satz meidet. */
const DEUTSCH = new Set([
  "der",
  "die",
  "das",
  "und",
  "ist",
  "nicht",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "zu",
  "mit",
  "für",
  "auf",
  "dass",
  "sich",
  "wie",
  "auch",
  "werden",
  "wird",
  "kann",
  "wenn",
  "aber",
  "oder",
  "als",
  "im",
  "in",
  "den",
  "dem",
  "des",
  "es",
  "du",
  "wir",
  "ich",
  "man",
  "hier",
  "dann",
  "so",
  "noch",
  "schon",
  "nur",
  "vom",
  "zum",
  "zur",
  "beim",
  "durch",
  "über",
  "unter",
  "damit",
  "weil",
  "also",
  "dabei",
  "diese",
  "dieser",
  "dieses",
  "sind",
  "war",
  "hat",
  "haben",
  "sein",
  "seine",
  "ihre",
  "was",
  "welche",
]);

/** Häufigste englische Funktionswörter. */
const ENGLISCH = new Set([
  "the",
  "and",
  "is",
  "not",
  "are",
  "was",
  "were",
  "you",
  "your",
  "this",
  "that",
  "these",
  "those",
  "with",
  "for",
  "from",
  "have",
  "has",
  "will",
  "would",
  "can",
  "could",
  "should",
  "there",
  "their",
  "which",
  "what",
  "when",
  "where",
  "how",
  "about",
  "into",
  "than",
  "then",
  "them",
  "they",
  "its",
  "it's",
  "we're",
  "let's",
  "here",
  "hey",
  "cool",
  "of",
  "to",
  "in",
  "on",
  "as",
  "at",
  "be",
  "or",
  "if",
]);

/** Wörter (Buchstabenfolgen inkl. Umlauten/ß und Apostroph) in Kleinschreibung. */
function woerter(text: string): string[] {
  return text.toLowerCase().match(/[a-zäöüß']+/g) ?? [];
}

export type SprachUrteil = {
  /** Hält der Detektor den Text für überwiegend deutsch? */
  deutsch: boolean;
  /** Kurzbegründung fürs Log – warum so entschieden wurde. */
  grund: string;
};

/**
 * Urteilt über einen Text. Leerer oder sehr kurzer Text gilt als deutsch
 * („kein Anlass zur Sorge"), damit ein knappes „Ja, genau." nicht als
 * Sprachrutscher zählt.
 */
export function pruefeSprache(text: string): SprachUrteil {
  const alle = woerter(text);
  if (alle.length < 4) {
    return { deutsch: true, grund: "zu kurz für ein Urteil" };
  }

  let de = 0;
  let en = 0;
  for (const wort of alle) {
    if (DEUTSCH.has(wort)) de++;
    if (ENGLISCH.has(wort)) en++;
  }

  // Umlaute und ß sind ein starkes deutsches Signal – ein einzelnes reicht
  // nicht, aber sie kippen einen knappen Gleichstand.
  const umlaute = (text.match(/[äöüß]/gi) ?? []).length;

  const deScore = de + umlaute;
  if (deScore === 0 && en === 0) {
    // Weder noch – etwa ein reiner Formelblock. Nicht als Rutscher werten.
    return { deutsch: true, grund: "keine Funktionswörter erkennbar" };
  }
  if (deScore >= en) {
    return { deutsch: true, grund: `deutsch ${deScore} ≥ englisch ${en}` };
  }
  return { deutsch: false, grund: `englisch ${en} > deutsch ${deScore}` };
}

/** Kurzform für die Laufzeit: nur das Ja/Nein. */
export function istDeutsch(text: string): boolean {
  return pruefeSprache(text).deutsch;
}
