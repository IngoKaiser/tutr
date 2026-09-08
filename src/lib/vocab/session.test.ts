import { describe, expect, it } from "vitest";

import { advance, buildSession, currentCard, isSessionComplete, type SessionCard } from "./session";

/** Deterministischer RNG statt Math.random – immer dieselbe Zahlenfolge. */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

const cards = (n: number): SessionCard[] =>
  Array.from({ length: n }, (_, i) => ({
    cardId: `card-${i}`,
    vocabItemId: `item-${i}`,
    direction: "vorwaerts" as const,
  }));

describe("buildSession / currentCard / isSessionComplete", () => {
  it("eine leere Kartenliste ist sofort fertig", () => {
    const state = buildSession([], seededRng(1));
    expect(currentCard(state)).toBeNull();
    expect(isSessionComplete(state)).toBe(true);
  });

  it("enthält alle übergebenen Karten, nur gemischt", () => {
    const input = cards(10);
    const state = buildSession(input, seededRng(1));
    expect(state.queue.map((c) => c.cardId).sort()).toEqual(input.map((c) => c.cardId).sort());
  });
});

describe("advance", () => {
  it("'Kann ich' entfernt die Karte endgültig, ohne Wiedervorlage", () => {
    let state = buildSession(cards(3), seededRng(1));
    const first = currentCard(state)!;
    state = advance(state, "kann_ich", seededRng(1));

    expect(state.graduated.has(first.cardId)).toBe(true);
    expect(state.queue.some((c) => c.cardId === first.cardId)).toBe(false);
  });

  it("'Übe ich' legt die Karte 5–8 Karten weiter wieder vor", () => {
    let state = buildSession(cards(10), seededRng(1));
    const first = currentCard(state)!;
    state = advance(state, "uebe_ich", seededRng(1));

    const position = state.queue.findIndex((c) => c.cardId === first.cardId);
    // "nach 5–8 Karten wieder": 5–8 Karten kommen davor, das ist Index 5–8.
    expect(position).toBeGreaterThanOrEqual(5);
    expect(position).toBeLessThanOrEqual(8);
    expect(state.graduated.has(first.cardId)).toBe(false);
  });

  it("'Nochmal' legt die Karte beim ersten Mal 2–3 Karten weiter vor", () => {
    let state = buildSession(cards(10), seededRng(1));
    const first = currentCard(state)!;
    state = advance(state, "nochmal", seededRng(1));

    const position = state.queue.findIndex((c) => c.cardId === first.cardId);
    expect(position).toBeGreaterThanOrEqual(2);
    expect(position).toBeLessThanOrEqual(3);
  });

  it("'Nochmal' eskaliert beim zweiten Mal auf 8 Karten, nicht wieder 2–3", () => {
    let state = buildSession(cards(15), seededRng(1));
    const first = currentCard(state)!;
    state = advance(state, "nochmal", seededRng(1));

    // Die Karte so lange durchreichen, bis sie wieder vorn steht.
    while (currentCard(state)!.cardId !== first.cardId) {
      state = advance(state, "kann_ich", seededRng(1));
    }
    state = advance(state, "nochmal", seededRng(1));

    const position = state.queue.findIndex((c) => c.cardId === first.cardId);
    expect(position).toBe(8);
  });

  it("dieselbe Vokabel kommt nicht direkt nach sich selbst dran (Geschwister-Abstand)", () => {
    // Zwei Karten derselben Vokabel (vorwärts/rückwärts) unter vielen anderen.
    const paired: SessionCard[] = [
      { cardId: "a-vor", vocabItemId: "a", direction: "vorwaerts" },
      { cardId: "a-rueck", vocabItemId: "a", direction: "rueckwaerts" },
      ...cards(8),
    ];

    let state = buildSession(paired, seededRng(3));
    // Erzwinge, dass beide Karten derselben Vokabel im nächsten Schritt
    // aufeinandertreffen könnten: die erste beantworten und die Vokabel des
    // Geschwisters direkt danach nie an Position 0 sehen.
    for (let i = 0; i < 30 && !isSessionComplete(state); i++) {
      const card = currentCard(state)!;
      const wasLast = state.lastShownVocabItemId;
      expect(card.vocabItemId === wasLast).toBe(false);
      state = advance(state, "uebe_ich", seededRng(i + 1));
    }
  });

  it("die Session endet erst, wenn jede Karte einmal 'Kann ich' erreicht hat", () => {
    // Die erste Karte stolpert einmal (nochmal) und muss trotzdem noch
    // drankommen, bevor die Session enden darf – nicht einfach, weil die
    // Warteschlange gerade kurzzeitig ohne sie leer aussehen könnte.
    let state = buildSession(cards(4), seededRng(2));
    const first = currentCard(state)!;
    state = advance(state, "nochmal", seededRng(1));
    expect(isSessionComplete(state)).toBe(false);

    let guard = 0;
    let sawFirstAgain = false;
    while (!isSessionComplete(state)) {
      if (guard++ > 200) throw new Error("Session terminiert nicht.");
      const card = currentCard(state)!;
      if (card.cardId === first.cardId) sawFirstAgain = true;
      state = advance(state, "kann_ich", seededRng(guard));
    }

    expect(sawFirstAgain).toBe(true);
    expect(state.graduated.size).toBe(4);
    expect(state.graduated.has(first.cardId)).toBe(true);
  });

  it("wirft, wenn auf einer leeren Warteschlange bewertet wird", () => {
    const state = buildSession([], seededRng(1));
    expect(() => advance(state, "kann_ich")).toThrow();
  });
});
