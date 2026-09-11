/**
 * Die fachspezifische Anpassung des sokratischen Prinzips (T-03 PR 2, §4a
 * „Fachspezifische Anpassung des sokratischen Prinzips").
 *
 * Ein Rechenweg wird anders geprüft als ein Aufsatz. Die Tabelle aus §4a
 * steht hier als reine Daten, nicht im Prompt-Text verstreut – so bleibt
 * sie an einer Stelle testbar und lesbar.
 *
 * Zuordnung über den Fachnamen (`subject.name`), nicht über eine feste ID:
 * Fächer sind frei angelegte Zeilen (F-16a, ADR 0009), es gibt kein
 * Fach-Enum. `passendZu()` normalisiert Groß-/Kleinschreibung und
 * Umlaut-Varianten, damit „Deutsch", „deutsch" und „DEUTSCH" gleich
 * behandelt werden.
 */

export type HausaufgabeFachHinweis = {
  /** Was der Tutor in diesem Fach beim Prüfen eines Versuchs tut. */
  tut: string;
  /** Was er ausdrücklich nicht tut. */
  tutNicht: string;
};

const REGEL_TABELLE: { faecher: string[]; hinweis: HausaufgabeFachHinweis }[] = [
  {
    faecher: ["mathematik", "mathe", "physik", "chemie"],
    hinweis: {
      tut: "Rechenweg prüfen, die Zeile mit dem Fehler benennen, ein analoges Beispiel mit anderen Zahlen vorrechnen.",
      tutNicht: "das Ergebnis vor zwei dokumentierten Versuchen nennen.",
    },
  },
  {
    faecher: ["deutsch"],
    hinweis: {
      tut: "Struktur besprechen (These, Argumente, Beleg), Leitfragen stellen, gemeinsam einen einzelnen Satz verbessern.",
      tutNicht: "den Text schreiben oder umformulieren.",
    },
  },
  {
    faecher: ["englisch", "französisch", "franzoesisch", "spanisch", "latein", "italienisch"],
    hinweis: {
      tut: "die Grammatikregel abfragen, Fehler markieren ohne selbst zu korrigieren, ein Musterbeispiel in einem anderen Kontext zeigen.",
      tutNicht: "die Übersetzung liefern oder den Text korrigieren.",
    },
  },
  {
    faecher: [
      "biologie",
      "bio",
      "geschichte",
      "politik",
      "pgw",
      "erdkunde",
      "geografie",
      "geographie",
    ],
    hinweis: {
      tut: "beim Lesen der Quelle anleiten, Begriffe klären, eine Gliederung gemeinsam entwickeln.",
      tutNicht: "den Antworttext selbst formulieren.",
    },
  },
];

/** Groß-/Kleinschreibung und die üblichen Umlaut-Schreibweisen vereinheitlichen. */
function normalisiert(fach: string): string {
  return fach
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue");
}

/**
 * Die passende Zeile aus §4a, oder eine allgemeine Fassung, wenn das Fach
 * nicht in der Tabelle steht (freie Fachnamen, F-16a) – lieber eine
 * vorsichtige Vorgabe als gar keine.
 */
export function hausaufgabeFachHinweis(subjectName: string): HausaufgabeFachHinweis {
  const treffer = REGEL_TABELLE.find((zeile) =>
    zeile.faecher.some((f) => normalisiert(f) === normalisiert(subjectName)),
  );
  if (treffer) return treffer.hinweis;

  return {
    tut: "den Lösungsweg in nachvollziehbaren Schritten prüfen und den Punkt benennen, an dem es nicht mehr stimmt.",
    tutNicht: "das Ergebnis vor zwei dokumentierten Versuchen nennen.",
  };
}
