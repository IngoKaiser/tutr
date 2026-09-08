/**
 * Die Warteschlange einer Übungssession (V-02, §6 M4).
 *
 * Rein und unit-testbar, wie das Ticket verlangt: kennt weder Datenbank noch
 * FSRS, nur „welche Karte kommt als Nächstes, wann kommt eine zurück,
 * wann ist die Session fertig". Der Zufall ist injizierbar (`rng`), damit
 * Tests deterministisch laufen – Standard ist `Math.random`.
 *
 * Drei Stapel (§6 M4): *Kann ich* (richtig + schnell → raus für immer),
 * *Übe ich* (richtig, langsam → nach 5–8 Karten wieder), *Nochmal* (falsch →
 * nach 2–3 Karten wieder). „Nochmal … dann 8" lese ich eskalierend: jede
 * *weitere* falsche Antwort derselben Karte in dieser Session reiht sie
 * erst nach 8 Karten wieder ein, nicht nur die zweite. Die Spec verlangt
 * keine zweite Bestätigungsrunde nach einem Fehler – nur einen größeren
 * Abstand beim nächsten Mal.
 *
 * Session endet, „wenn alles einmal in Kann ich war" – nicht wenn die
 * Warteschlange leer ist. Eine Karte, die einmal *Kann ich* erreicht hat,
 * verlässt die Warteschlange endgültig, selbst wenn sie vorher gestolpert ist.
 */

export type Direction = "vorwaerts" | "rueckwaerts";
export type Outcome = "kann_ich" | "uebe_ich" | "nochmal";

export type SessionCard = {
  cardId: string;
  vocabItemId: string;
  direction: Direction;
};

type QueueEntry = SessionCard & { lapses: number };

export type SessionState = {
  queue: QueueEntry[];
  graduated: Set<string>;
  lastShownVocabItemId: string | null;
  total: number;
};

type Rng = () => number;

function shuffled<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function randomBetween(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Bringt eine Karte mit derselben Vokabel wie zuletzt nicht direkt danach –
 * sonst wird nicht geprüft, sondern abgeschrieben (ADR 0007 D5). Sucht die
 * erste Position mit einer anderen Vokabel und holt sie nach vorn. Bleibt
 * nur noch eine einzige Vokabel übrig, ist der Zusammenstoß unvermeidbar
 * und wird hingenommen, statt in eine Endlosschleife zu laufen.
 */
function withFixedFront(state: SessionState): SessionState {
  const { queue, lastShownVocabItemId } = state;
  if (queue.length < 2 || queue[0]!.vocabItemId !== lastShownVocabItemId) return state;

  const index = queue.findIndex((entry) => entry.vocabItemId !== lastShownVocabItemId);
  if (index <= 0) return state;

  const reordered = [...queue];
  const [entry] = reordered.splice(index, 1);
  reordered.unshift(entry!);
  return { ...state, queue: reordered };
}

/** Neue Session: einmal gemischt, alle Karten offen. */
export function buildSession(cards: SessionCard[], rng: Rng = Math.random): SessionState {
  const queue = shuffled(cards, rng).map((card) => ({ ...card, lapses: 0 }));
  return withFixedFront({
    queue,
    graduated: new Set(),
    lastShownVocabItemId: null,
    total: cards.length,
  });
}

/** Die Karte, die als Nächstes dran ist – oder `null`, wenn die Session fertig ist. */
export function currentCard(state: SessionState): SessionCard | null {
  return state.queue[0] ?? null;
}

export function isSessionComplete(state: SessionState): boolean {
  return state.graduated.size >= state.total;
}

/**
 * Wendet eine Bewertung auf die aktuell vorn stehende Karte an und gibt den
 * neuen Zustand zurück. Wirft, wenn die Warteschlange schon leer ist – ein
 * Aufrufer, der trotzdem noch bewertet, hat einen Fehler, keinen validen Zug.
 */
export function advance(
  state: SessionState,
  outcome: Outcome,
  rng: Rng = Math.random,
): SessionState {
  const [front, ...rest] = state.queue;
  if (!front) throw new Error("advance() auf einer leeren Warteschlange aufgerufen.");

  const graduated = new Set(state.graduated);
  let queue = rest;

  if (outcome === "kann_ich") {
    graduated.add(front.cardId);
  } else {
    const lapses = outcome === "nochmal" ? front.lapses + 1 : front.lapses;
    const distance =
      outcome === "uebe_ich"
        ? randomBetween(5, 8, rng)
        : lapses === 1
          ? randomBetween(2, 3, rng)
          : 8;
    const position = Math.min(queue.length, distance);
    queue = [...queue.slice(0, position), { ...front, lapses }, ...queue.slice(position)];
  }

  return withFixedFront({
    queue,
    graduated,
    lastShownVocabItemId: front.vocabItemId,
    total: state.total,
  });
}
