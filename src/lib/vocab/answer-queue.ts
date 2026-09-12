import { classifyMultipleChoice, classifyTyped } from "./outcome";
import type { Outcome } from "./session";

/**
 * Offline-Antwortwarteschlange fürs Üben (F-09b, ADR 0015).
 *
 * Zwei Teile mit unterschiedlichem Testweg, absichtlich in einer Datei
 * gehalten, weil sie zusammengehören:
 *
 * 1. **Reine Logik** (`previewOutcome()`, `flushAnswerQueue()`) – ohne
 *    Browser-APIs, unit-testbar wie `session.ts`.
 * 2. **`createIndexedDbAnswerQueue()`** – der einzige Ort mit echtem
 *    `indexedDB`-Zugriff. jsdom (die Testumgebung dieses Projekts) kennt
 *    IndexedDB nicht; ein Fake dafür wäre eine neue Abhängigkeit ohne
 *    Rückfrage. Verifiziert stattdessen per E2E gegen einen echten Browser
 *    (`tests/e2e/practice.spec.ts`), wie schon der Service Worker in F-09a.
 *
 * **Warum keine `applyReview()`/FSRS-Vorschau, obwohl ADR 0015 das
 * vorgesehen hatte:** `session.ts`s `advance()` konsumiert ausschließlich
 * den `Outcome` (richtig/fast/falsch) einer Antwort, nie den FSRS-Zustand –
 * der ist rein serverseitig und beeinflusst die laufende Session nicht.
 * Für eine ehrliche Rückmeldung genügt also `classifyMultipleChoice()`/
 * `classifyTyped()`; `applyReview()` bleibt exklusiv `submitAnswer()`
 * vorbehalten, das den frischen `fsrs_state` erst beim echten Sync aus der
 * Datenbank liest – **eine Wahrheit über den Lernstand, nicht zwei.**
 *
 * **Sequenziell ist Pflicht** (ADR 0015 Entscheidung 2): `ts-fsrs` ist
 * zustandsbehaftet, zwei Antworten auf dieselbe Karte hängen ursächlich
 * zusammen. `flushAnswerQueue()` bricht deshalb bei einem vorübergehenden
 * Fehlschlag (`"retry"`) ab, statt spätere Einträge vorzuziehen – der Rest
 * bleibt für den nächsten Versuch stehen, in derselben Reihenfolge.
 *
 * **Eine dauerhaft gescheiterte Antwort blockiert die anderen nicht**
 * (F-09c): Ist eine Karte inzwischen gelöscht, meldet `submitAnswer()`
 * `not_found` – niemals `ok`, egal wie oft man es versucht. Ein solcher
 * Eintrag wird verworfen (`"discard"`), nicht endlos wiederholt, und der
 * Rest der Warteschlange läuft weiter.
 *
 * **Bewusst nicht gelöst:** Zwei Tabs/Geräte, die gleichzeitig dieselbe
 * Warteschlange leeren, oder ein Sync, der zwischen dem Schreiben in die
 * Datenbank und `remove()` abbricht (doppelte Zustellung beim nächsten
 * Versuch – `submitAnswer()` legt bei jedem Aufruf eine neue `review`-Zeile
 * an, ohne Idempotenz-Schlüssel). Beides selten genug (ein Absturz in einem
 * Millisekundenfenster), dass eine Migration dafür unverhältnismäßig wäre –
 * siehe ADR 0015, bewusste Entscheidung, nicht vergessener Rest.
 */

export type QueuedAnswer = {
  id: string;
  cardId: string;
  mode: "mc" | "tippen";
  given: string;
  responseMs: number;
  /** Für die Wiederherstellungsreihenfolge – siehe `createIndexedDbAnswerQueue()`. */
  queuedAt: number;
};

/**
 * Der Speicher hinter der Warteschlange, als Schnittstelle statt fest an
 * `indexedDB` gebunden – so bleibt `flushAnswerQueue()` mit einem
 * In-Memory-Fake testbar (siehe `answer-queue.test.ts`).
 */
export interface AnswerQueueStore {
  enqueue(answer: QueuedAnswer): Promise<void>;
  /** In der Reihenfolge, in der die Antworten gegeben wurden. */
  list(): Promise<QueuedAnswer[]>;
  remove(id: string): Promise<void>;
}

/**
 * Dieselbe Klassifikation wie `submitAnswer()` serverseitig nutzt (V-02) –
 * hier ohne Datenbankzugriff, weil beide Funktionen rein sind. Die
 * Rückmeldung im Offline-Fall ist damit keine Schätzung, sondern dasselbe
 * Ergebnis, das der Server bei Rückkehr liefern würde (sofern sich
 * `fsrs_state` bis dahin nicht durch eine andere Sitzung geändert hat).
 */
export function previewOutcome(
  mode: "mc" | "tippen",
  given: string,
  expected: string,
  responseMs: number,
): Outcome {
  return mode === "mc"
    ? classifyMultipleChoice(
        given.trim().toLowerCase() === expected.trim().toLowerCase(),
        responseMs,
      )
    : classifyTyped(expected, given).outcome;
}

/**
 * Ausgang eines einzelnen Zustellversuchs (F-09c):
 * - `"ok"` – angenommen, aus der Warteschlange entfernen, weitermachen.
 * - `"retry"` – vorübergehend gescheitert (kein Netz, keine Kind-Rolle
 *   gerade aktiv) – **abbrechen**, damit spätere Einträge keine früheren
 *   überholen (FSRS ist zustandsbehaftet, ADR 0015).
 * - `"discard"` – wird nie mehr gelingen (die Karte existiert nicht mehr) –
 *   aus der Warteschlange entfernen, aber **weitermachen**: Ein einzelner
 *   verwaister Eintrag darf nicht alles Folgende für immer blockieren.
 */
export type DeliveryResult = "ok" | "retry" | "discard";

/**
 * Wartende Antworten der Reihe nach nachliefern. `submit` ruft im
 * aufrufenden Code den echten `submitAnswer()`-Server-Action-Aufruf auf und
 * übersetzt dessen Ergebnis in einen `DeliveryResult` – kein neuer
 * Schreibweg, siehe Dateikommentar.
 */
export async function flushAnswerQueue(
  store: AnswerQueueStore,
  submit: (answer: QueuedAnswer) => Promise<DeliveryResult>,
): Promise<{ synced: number; discarded: number; remaining: number }> {
  const pending = await store.list();
  let synced = 0;
  let discarded = 0;
  for (const answer of pending) {
    const result = await submit(answer);
    if (result === "retry") break;
    await store.remove(answer.id);
    if (result === "ok") synced++;
    else discarded++;
  }
  return { synced, discarded, remaining: pending.length - synced - discarded };
}

const DB_NAME = "tutr-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-answers";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Echte `IndexedDB`-Warteschlange fürs Browser-Fenster. `id` ist ein
 * client-generierter UUID (Primärschlüssel) statt eines Auto-Increments –
 * `getAll()` liefert deshalb nach Schlüssel sortiert, **nicht** nach
 * Einfügereihenfolge. `list()` sortiert selbst nach `queuedAt` nach, damit
 * die Reihenfolge trotzdem stimmt.
 */
export function createIndexedDbAnswerQueue(): AnswerQueueStore {
  return {
    async enqueue(answer) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).add(answer);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    async list() {
      const db = await openDb();
      const rows = await new Promise<QueuedAnswer[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result as QueuedAnswer[]);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return rows.sort((a, b) => a.queuedAt - b.queuedAt);
    },
    async remove(id) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
  };
}
