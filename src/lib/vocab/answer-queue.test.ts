import { describe, expect, it, vi } from "vitest";

import {
  flushAnswerQueue,
  previewOutcome,
  type AnswerQueueStore,
  type DeliveryResult,
  type QueuedAnswer,
} from "./answer-queue";

/**
 * `flushAnswerQueue()` und `previewOutcome()` sind rein (F-09b, ADR 0015) –
 * getestet mit einem In-Memory-Fake statt echtem `indexedDB`. Die echte
 * `createIndexedDbAnswerQueue()` ist absichtlich nicht hier getestet: jsdom
 * kennt kein IndexedDB, ein Fake dafür wäre eine neue Abhängigkeit ohne
 * Rückfrage – siehe E2E in `tests/e2e/practice.spec.ts`.
 */

function fakeStore(initial: QueuedAnswer[] = []): AnswerQueueStore {
  let rows = [...initial];
  return {
    async enqueue(answer) {
      rows.push(answer);
    },
    async list() {
      return [...rows];
    },
    async remove(id) {
      rows = rows.filter((r) => r.id !== id);
    },
  };
}

function answer(id: string, queuedAt: number): QueuedAnswer {
  return { id, cardId: `card-${id}`, mode: "mc", given: "x", responseMs: 1000, queuedAt };
}

describe("flushAnswerQueue", () => {
  it("liefert eine leere Warteschlange ohne Aufruf von submit nach", async () => {
    const submit = vi.fn();
    const result = await flushAnswerQueue(fakeStore(), submit);
    expect(result).toEqual({ synced: 0, discarded: 0, remaining: 0 });
    expect(submit).not.toHaveBeenCalled();
  });

  it("liefert in Reihenfolge nach und entfernt jeden erfolgreichen Eintrag", async () => {
    const store = fakeStore([answer("a", 1), answer("b", 2), answer("c", 3)]);
    const order: string[] = [];
    const submit = vi.fn(async (a: QueuedAnswer) => {
      order.push(a.id);
      return "ok" as const;
    });

    const result = await flushAnswerQueue(store, submit);

    expect(order).toEqual(["a", "b", "c"]);
    expect(result).toEqual({ synced: 3, discarded: 0, remaining: 0 });
    expect(await store.list()).toEqual([]);
  });

  it("bricht bei einem vorübergehenden Fehlschlag ab, statt spätere Einträge vorzuziehen", async () => {
    const store = fakeStore([answer("a", 1), answer("b", 2), answer("c", 3)]);
    const submit = vi.fn(async (a: QueuedAnswer): Promise<DeliveryResult> =>
      a.id === "b" ? "retry" : "ok",
    );

    const result = await flushAnswerQueue(store, submit);

    // "a" wurde zugestellt und entfernt, "b" scheiterte vorübergehend – "c"
    // darf "b" nicht überholen, sonst zerreißt das die FSRS-Reihenfolge für
    // dieselbe Karte.
    expect(submit).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ synced: 1, discarded: 0, remaining: 2 });
    expect((await store.list()).map((a) => a.id)).toEqual(["b", "c"]);
  });

  it("verwirft einen dauerhaft gescheiterten Eintrag, macht aber mit dem Rest weiter (F-09c)", async () => {
    const store = fakeStore([answer("a", 1), answer("b", 2), answer("c", 3)]);
    const submit = vi.fn(async (a: QueuedAnswer): Promise<DeliveryResult> =>
      a.id === "b" ? "discard" : "ok",
    );

    const result = await flushAnswerQueue(store, submit);

    // Anders als bei "retry": "b" (z. B. eine inzwischen gelöschte Karte)
    // blockiert "c" nicht – "b" wird nie mehr gelingen, egal wie oft man es
    // versucht.
    expect(submit).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ synced: 2, discarded: 1, remaining: 0 });
    expect(await store.list()).toEqual([]);
  });
});

describe("previewOutcome", () => {
  it("Multiple Choice: richtig und schnell ist 'kann_ich'", () => {
    expect(previewOutcome("mc", "chien", "chien", 1000)).toBe("kann_ich");
  });

  it("Multiple Choice: falsch ist immer 'nochmal', unabhängig von der Zeit", () => {
    expect(previewOutcome("mc", "chat", "chien", 100)).toBe("nochmal");
  });

  it("Tippen: nutzt dieselbe Toleranzprüfung wie der Server (answer.ts)", () => {
    expect(previewOutcome("tippen", "chien", "chien", 3000)).toBe("kann_ich");
    expect(previewOutcome("tippen", "chatte", "chien", 3000)).toBe("nochmal");
  });
});
