"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Lernrhythmus } from "@/components/shell/lernrhythmus";
import { Block, Button, Notice, PageHeader, Stack } from "@/components/shell/primitives";
import {
  createIndexedDbAnswerQueue,
  flushAnswerQueue,
  previewOutcome,
  type DeliveryResult,
  type QueuedAnswer,
} from "@/lib/vocab/answer-queue";
import { buildMultipleChoiceOptions } from "@/lib/vocab/distractors";
import {
  advance,
  buildSession,
  currentCard,
  isSessionComplete,
  type Outcome,
  type SessionState,
} from "@/lib/vocab/session";

import {
  loadSessionCards,
  refreshDueOverview,
  submitAnswer,
  type DueBySubject,
  type SessionCardContent,
} from "./actions";

type Phase = "wahl" | "uebung" | "fertig";

/** Ein bereits fertig geladener Set-Modus-Einstieg (V-04), von `page.tsx` aus
 *  `?set=` gelesen – startet die Session direkt, ohne über „wahl" zu laufen. */
export type InitialSetSession = {
  label: string;
  cards: SessionCardContent[];
};

/**
 * Eine Warteschlange fürs ganze Browser-Fenster, nicht je Komponente – sie
 * überlebt einen Neu-Mount von `PracticeSession` (z. B. nach „Zur
 * Übersicht") und sogar ein Neuladen der Seite, weil sie in IndexedDB liegt
 * (F-09b, ADR 0015). Das Erzeugen selbst rührt `indexedDB` noch nicht an –
 * das passiert erst in `openDb()`, beim ersten echten Aufruf.
 */
const answerQueueStore = createIndexedDbAnswerQueue();

/**
 * Eine wartende Antwort nachliefern – derselbe `submitAnswer()`-Aufruf wie
 * im Online-Fall, kein zweiter Schreibweg (ADR 0015 Entscheidung 2).
 * Übersetzt dessen drei Ausgänge (F-09c) in einen `DeliveryResult`:
 * `not_authorized` ist vorübergehend (`"retry"` – die Reihenfolge muss
 * stehen bleiben), `not_found` ist endgültig (`"discard"` – eine gelöschte
 * Karte kommt nicht zurück, egal wie oft man es versucht).
 * `navigator.onLine === false` scheitert ohne Versuch, statt auf einen
 * Netzwerk-Timeout zu warten.
 */
async function submitQueuedAnswer(answer: QueuedAnswer): Promise<DeliveryResult> {
  if (!navigator.onLine) return "retry";
  try {
    const result = await submitAnswer({
      cardId: answer.cardId,
      mode: answer.mode,
      given: answer.given,
      responseMs: answer.responseMs,
    });
    if (result.status === "ok") return "ok";
    if (result.status === "not_found") return "discard";
    return "retry";
  } catch {
    return "retry";
  }
}

/**
 * Übungssession (V-02, fachgebunden seit V-06). Ein Client-Baustein statt
 * einer eigenen Route – es gibt nichts, worauf man tief verlinken müsste,
 * und der Zustand (Übersicht → Üben → Fertig) ist rein clientseitig.
 *
 * **Ein Block je Fach, kein eigener Auswahl-Bildschirm davor** (ADR 0008
 * D3): Bei realistisch ein bis drei Fächern mit fälligen Karten steht
 * „Französisch · 12 fällig" direkt neben dem Knopf, der es übt. Jeder Block
 * (`SubjectBlock`) lädt für sich; eine laufende Session gehört immer zu
 * genau einem Fach, `cards` enthält deshalb nie mehr als ein Fach – die
 * Falschantworten in `ActiveCard` brauchen dadurch keine eigene Fach-Regel,
 * sie ziehen aus genau diesem Vorrat.
 *
 * `PageHeader` lebt hier, nicht in `page.tsx`: Die Kopfzeile zeigt während
 * des Übens den Fortschritt dieser Runde – eine serverseitig eingefrorene
 * Kopfzeile könnte das nicht.
 *
 * Treibt `session.ts` (die reine Warteschlange) mit echten Server-Aktionen:
 * Laden holt die fälligen Karten, jede Antwort geht einzeln an
 * `submitAnswer()` – der Server bewertet, das Ergebnis (Stapel) kommt
 * zurück. Zwischen Antwort und nächster Karte steht eine Rückmelde-Stufe:
 * `advance()` läuft erst, wenn „Weiter" angetippt wird, nicht automatisch –
 * ohne die Rückmeldung wäre Raten nicht von Wissen zu unterscheiden, und
 * ein automatischer Sprung nach X Sekunden wäre wieder eine unsichtbare Uhr,
 * die zur Eile drängt (§15).
 *
 * **Set-Modus** (V-04) kommt über `initialSession` von `page.tsx` fertig
 * geladen herein (aus `?set=`) – die Übersicht wird dabei übersprungen, es
 * gibt für diesen Einstieg keinen zweiten Auswahl-Bildschirm. `isSetSession`
 * merkt sich das nur für den Rückweg: „Zur Übersicht" muss dann `?set=` aus
 * der URL nehmen, sonst startete ein Neuladen dieselbe Session erneut.
 *
 * **Offline** (F-09b, ADR 0015): Bricht `submitAnswer()` ab (kein Netz, ein
 * Fangportal), landet die Antwort in `@/lib/vocab/answer-queue`s
 * IndexedDB-Warteschlange, die Rückmeldung kommt trotzdem echt – dieselbe
 * Klassifikation, die der Server nutzen würde, nur noch nicht persistiert.
 * Bei Rückkehr ins Netz (oder beim nächsten Laden dieser Seite) liefert
 * `flushAnswerQueue()` sequenziell nach, über genau denselben
 * `submitAnswer()`-Aufruf – keine zweite Wahrheit über den FSRS-Zustand.
 *
 * `pendingCount`/`discardedCount` (F-09c) leben hier, nicht in `ActiveCard`:
 * Die Warteschlange ist sitzungsübergreifend, die Anzeige soll es auch sein
 * – „1 Antwort wartet" darf auch auf der Übersicht stehen.
 */
export function PracticeSession({
  bySubject,
  canStart,
  initialSession,
  setLoadFailed = false,
}: {
  bySubject: DueBySubject[] | null;
  canStart: boolean;
  initialSession: InitialSetSession | null;
  /** `?set=` stand in der URL, aber es gab nichts zu laden – siehe `page.tsx`. */
  setLoadFailed?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(initialSession ? "uebung" : "wahl");
  const [isSetSession, setIsSetSession] = useState(initialSession !== null);
  const [activeLabel, setActiveLabel] = useState(initialSession?.label ?? "");
  const [cards, setCards] = useState<SessionCardContent[]>(initialSession?.cards ?? []);
  const [session, setSession] = useState<SessionState | null>(() =>
    initialSession
      ? buildSession(
          initialSession.cards.map((c) => ({
            cardId: c.cardId,
            vocabItemId: c.vocabItemId,
            direction: c.direction,
          })),
        )
      : null,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [discardedCount, setDiscardedCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    void answerQueueStore.list().then((rows) => setPendingCount(rows.length));
  }, []);

  /**
   * Wartende Antworten nachliefern und die Anzeige danach auffrischen.
   * Ausgelöst dreifach (F-09c): beim Laden der Seite, beim `online`-Ereignis,
   * und direkt nach jedem neuen Eintrag (siehe `ActiveCard`s `onQueued`) –
   * kein Warten auf den jeweils nächsten der drei.
   */
  const trySync = useCallback(() => {
    void flushAnswerQueue(answerQueueStore, submitQueuedAnswer).then((result) => {
      if (result.discarded > 0) setDiscardedCount((n) => n + result.discarded);
      refreshPendingCount();
    });
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
    trySync();
    window.addEventListener("online", trySync);
    return () => window.removeEventListener("online", trySync);
  }, [trySync, refreshPendingCount]);

  function startSession(subjectName: string, loaded: SessionCardContent[]) {
    setIsSetSession(false);
    setActiveLabel(subjectName);
    setCards(loaded);
    setSession(
      buildSession(
        loaded.map((c) => ({
          cardId: c.cardId,
          vocabItemId: c.vocabItemId,
          direction: c.direction,
        })),
      ),
    );
    setPhase("uebung");
  }

  function backToOverview() {
    setSession(null);
    setCards([]);
    setPhase("wahl");
    if (isSetSession) {
      // Sonst startete ein Neuladen der Seite dieselbe Set-Session erneut.
      router.replace("/ueben");
    } else {
      // Erst jetzt auffrischen, nicht nach jeder Antwort (V-02-Nachtrag) –
      // die Übersicht ist ohnehin schon frisch angefordert, sobald sie wieder
      // sichtbar wird; die Zahlen müssen nur bis dahin stimmen.
      void refreshDueOverview();
    }
  }

  if (phase === "fertig") {
    return (
      <>
        <PageHeader title="Üben" trailing="Geschafft" />
        <PendingAnswersNotice pendingCount={pendingCount} discardedCount={discardedCount} />
        <Block title="Geschafft" emphasized>
          <Notice>
            {isSetSession
              ? `Alle Karten in ${activeLabel} sind einmal gesessen.`
              : `Alle fälligen Karten in ${activeLabel} sind einmal gesessen. Bis zur nächsten Fälligkeit.`}
          </Notice>
          <Button onClick={backToOverview}>Zur Übersicht</Button>
        </Block>
      </>
    );
  }

  if (phase === "uebung" && session) {
    const done = session.graduated.size;
    return (
      <>
        <PageHeader title="Üben" trailing={`${activeLabel} · ${done} von ${session.total}`} />
        <PendingAnswersNotice pendingCount={pendingCount} discardedCount={discardedCount} />
        <ActiveCard
          // Neu gemountet bei jeder Karte statt per Effekt zurückgesetzt –
          // `shownAt` und das Tippfeld starten so garantiert frisch, ohne
          // einen zusätzlichen Render-Zyklus (react-hooks/set-state-in-effect).
          key={currentCard(session)?.cardId}
          cards={cards}
          session={session}
          onResult={(next) => {
            setSession(next);
            if (isSessionComplete(next)) setPhase("fertig");
          }}
          onExit={backToOverview}
          onQueued={trySync}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Üben" />

      <div className="flex flex-col gap-3">
        <PendingAnswersNotice pendingCount={pendingCount} discardedCount={discardedCount} />
        {setLoadFailed ? (
          <Notice>
            Dieses Set ließ sich gerade nicht laden – vielleicht wurde es in der Zwischenzeit
            gelöscht, ist leer, oder alle Zeilen darin warten noch auf eine Prüfung.
          </Notice>
        ) : null}
        {bySubject === null ? (
          <Block title="Fällig heute">
            <Notice>Zahlen sind gerade nicht verfügbar.</Notice>
          </Block>
        ) : bySubject.length === 0 ? (
          <Block title="Fällig heute">
            <Notice>Nichts fällig. Schau später wieder vorbei.</Notice>
          </Block>
        ) : (
          <>
            {!canStart ? (
              <Notice>Nur das Kind übt selbst – hier siehst du nur den Stand.</Notice>
            ) : null}
            {bySubject.map((subject) => (
              <SubjectBlock
                key={subject.subjectId}
                subject={subject}
                canStart={canStart}
                onStart={startSession}
              />
            ))}
            <Lernrhythmus />
          </>
        )}
      </div>
    </>
  );
}

/**
 * Ruhiges Signal statt Alarm (F-09c, §15): kein Rot, keine Uhr, nur ein
 * `Notice` wie jede andere Statuszeile auf dieser Seite. Erscheint auf allen
 * drei Bildschirmen (Übersicht, Übung, Geschafft), weil die Warteschlange
 * das ganze Fenster betrifft, nicht nur die Karte, die sie ausgelöst hat.
 */
function PendingAnswersNotice({
  pendingCount,
  discardedCount,
}: {
  pendingCount: number;
  discardedCount: number;
}) {
  if (pendingCount === 0 && discardedCount === 0) return null;
  return (
    <>
      {pendingCount > 0 ? (
        <Notice>
          {pendingCount === 1
            ? "1 Antwort wartet auf Synchronisierung."
            : `${pendingCount} Antworten warten auf Synchronisierung.`}
        </Notice>
      ) : null}
      {discardedCount > 0 ? (
        <Notice>
          {discardedCount === 1
            ? "1 frühere Antwort ließ sich nicht mehr zuordnen – vermutlich wurde die Karte inzwischen gelöscht."
            : `${discardedCount} frühere Antworten ließen sich nicht mehr zuordnen – vermutlich wurden die Karten inzwischen gelöscht.`}
        </Notice>
      ) : null}
    </>
  );
}

/**
 * Ein Fach, für sich ladend. `subject.total` ist immer > 0 – nur Fächer mit
 * fälligen Karten stehen überhaupt in `bySubject` (siehe `loadDueBySubject()`).
 *
 * **Keine Umschalter mehr** (V-04, ADR 0008 Nachtrag): „Loslegen" trifft
 * keine Vorentscheidung. Die Richtung mischt `loadSessionCards()` ohnehin je
 * Vokabel (V-06a/V-07), und die Antwortart leitet `modeForCardState()` aus
 * dem FSRS-Zustand ab – beides ist eine bessere Antwort, als ein Kind sie vor
 * der ersten Karte treffen könnte. Wer doch gezielt wählen will, geht über
 * den Set-Modus auf der Set-Seite, wo die Wahl ohnehin schon bewusst ist.
 *
 * Der Umschalter für die Antwortart aus V-08 ist damit von `/ueben`
 * verschwunden, nicht seine Logik: `SessionCardContent.mode` bleibt
 * überschreibbar, der Set-Modus kann ihn später wieder anbieten.
 */
function SubjectBlock({
  subject,
  canStart,
  onStart,
}: {
  subject: DueBySubject;
  canStart: boolean;
  onStart: (subjectName: string, cards: SessionCardContent[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [loadError, setLoadError] = useState(false);

  function start() {
    setLoadError(false);
    startTransition(async () => {
      const loaded = await loadSessionCards(subject.subjectId);
      if (!loaded || loaded.length === 0) {
        setLoadError(true);
        return;
      }
      onStart(subject.subjectName, loaded);
    });
  }

  return (
    <Block title={subject.subjectName} trailing={`${subject.total} fällig`}>
      {/* Lernstand über den ganzen Wortschatz, nicht nur die heute Fälligen
          (V-08) – sonst stünde in „Sitzt" fast immer 0. */}
      <Stack
        items={[
          { count: subject.neu, name: "Neu", tone: "leise" },
          { count: subject.amUeben, name: "Am Üben", tone: "koenigsblau" },
          { count: subject.sitzt, name: "Sitzt", tone: "sicher" },
        ]}
      />
      {canStart ? (
        <>
          <Button onClick={start} disabled={pending}>
            {pending ? "Einen Moment …" : "Loslegen"}
          </Button>
          {loadError ? (
            <Notice>
              Gerade nichts zu laden – vielleicht ist in der Zwischenzeit alles erledigt.
            </Notice>
          ) : null}
        </>
      ) : null}
    </Block>
  );
}

/** Farbe je Ergebnis – dieselben drei wie im `Stack`-Baustein, nie Rot (globals.css). */
const OUTCOME_STYLE: Record<Outcome, { border: string; bg: string; text: string; label: string }> =
  {
    kann_ich: {
      border: "border-sicher",
      bg: "bg-sicher-hell",
      text: "text-sicher",
      label: "Richtig!",
    },
    uebe_ich: {
      border: "border-koenigsblau",
      bg: "bg-koenigsblau-hell",
      text: "text-koenigsblau",
      label: "Fast",
    },
    nochmal: {
      border: "border-offen",
      bg: "bg-offen-hell",
      text: "text-offen",
      label: "Nicht ganz",
    },
  };

type Reveal = {
  outcome: Outcome;
  given: string;
  mode: "mc" | "tippen";
  /** Über die Warteschlange gegangen, noch nicht bestätigt (F-09c). */
  pending: boolean;
};

function ActiveCard({
  cards,
  session,
  onResult,
  onExit,
  onQueued,
}: {
  cards: SessionCardContent[];
  session: SessionState;
  onResult: (next: SessionState) => void;
  onExit: () => void;
  /** Ruft nach jedem neuen Warteschlangen-Eintrag `PracticeSession`s
   *  `trySync()` – ein sofortiger Zustellversuch statt Warten auf das
   *  nächste `online`-Ereignis, plus Auffrischen der Anzeige. */
  onQueued: () => void;
}) {
  const current = currentCard(session);
  const content = cards.find((c) => c.cardId === current?.cardId) ?? null;
  // `ActiveCard` wird pro Karte neu gemountet (siehe `key` beim Aufrufer),
  // deshalb startet die Uhr hier automatisch frisch – kein Effekt nötig.
  const [shownAt] = useState(() => Date.now());
  const [typed, setTyped] = useState("");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [pending, startTransition] = useTransition();

  const options = useMemo(() => {
    if (!content || content.mode !== "mc") return [];
    const expected = content.direction === "vorwaerts" ? content.translation : content.term;
    const pool = cards
      .filter((c) => c.cardId !== content.cardId && c.direction === content.direction)
      .map((c) => (content.direction === "vorwaerts" ? c.translation : c.term));
    return buildMultipleChoiceOptions(pool, expected, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu mischen nur bei neuer Karte, nicht bei jedem Render
  }, [content?.cardId]);

  if (!current || !content) return null;

  const expected = content.direction === "vorwaerts" ? content.translation : content.term;

  /**
   * Online zuerst, Warteschlange als Rückfall (F-09b, ADR 0015). Eine schon
   * wartende Warteschlange erzwingt den Rückfall auch dann, wenn
   * `navigator.onLine` gerade wieder `true` ist: `ts-fsrs` ist
   * zustandsbehaftet, eine neue Antwort dürfte eine ältere, noch nicht
   * zugestellte, nie überholen.
   */
  function submit(given: string) {
    if (!content) return;

    startTransition(async () => {
      const responseMs = Date.now() - shownAt;
      const alreadyQueued = (await answerQueueStore.list()).length > 0;

      if (!alreadyQueued && navigator.onLine) {
        try {
          const result = await submitAnswer({
            cardId: content.cardId,
            mode: content.mode,
            given,
            responseMs,
          });
          // Keine Kind-Rolle (mehr) aktiv oder keine DB – kein Offline-Fall,
          // nicht in die Warteschlange nehmen.
          if (result.status !== "ok") return;
          setReveal({ outcome: result.outcome, given, mode: content.mode, pending: false });
          return;
        } catch {
          // Netzwerkfehler trotz `navigator.onLine === true` (z. B. ein
          // Fangportal) – unten wie offline behandeln.
        }
      }

      await answerQueueStore.enqueue({
        id: crypto.randomUUID(),
        cardId: content.cardId,
        mode: content.mode,
        given,
        responseMs,
        queuedAt: Date.now(),
      });
      onQueued();
      setReveal({
        outcome: previewOutcome(content.mode, given, expected, responseMs),
        given,
        mode: content.mode,
        pending: true,
      });
    });
  }

  const prompt = content.direction === "vorwaerts" ? content.term : content.translation;

  if (reveal) {
    const style = OUTCOME_STYLE[reveal.outcome];
    return (
      <Block title={content.mode === "mc" ? "Multiple Choice" : "Tippen"}>
        <p className="font-lese text-2xl font-semibold">{prompt}</p>

        {content.mode === "mc" ? (
          <div className="flex flex-col gap-2">
            {options.map((option) => {
              const isCorrect = option.trim().toLowerCase() === expected.trim().toLowerCase();
              const isGiven = option === reveal.given;
              const optionStyle = isCorrect
                ? OUTCOME_STYLE.kann_ich
                : isGiven
                  ? OUTCOME_STYLE.nochmal
                  : null;
              return (
                <div
                  key={option}
                  className={`flex items-center justify-between gap-2 rounded-[9px] border px-3 py-2.5 text-left text-sm ${
                    optionStyle
                      ? `${optionStyle.border} ${optionStyle.bg} ${optionStyle.text}`
                      : "border-linie-stark bg-flaeche text-tinte-leise"
                  }`}
                >
                  <span>{option}</span>
                  {isGiven && !isCorrect ? (
                    <span className="text-[0.6875rem] font-semibold whitespace-nowrap">
                      deine Wahl
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={`flex flex-col gap-1.5 rounded-[9px] border p-3 ${style.border} ${style.bg}`}
          >
            <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
            <p className="text-tinte text-sm">
              Deine Antwort: <span className="font-medium">{reveal.given || "(leer)"}</span>
            </p>
            {reveal.outcome !== "kann_ich" ? (
              <p className="text-tinte text-sm">
                Richtig: <span className="font-medium">{expected}</span>
              </p>
            ) : null}
          </div>
        )}

        {reveal.pending ? (
          <p className="text-tinte-leise text-xs">
            Wird synchronisiert, sobald wieder Netz da ist.
          </p>
        ) : null}

        <Button onClick={() => onResult(advance(session, reveal.outcome))}>Weiter</Button>
      </Block>
    );
  }

  return (
    <Block title={content.mode === "mc" ? "Multiple Choice" : "Tippen"}>
      <p className="font-lese text-2xl font-semibold">{prompt}</p>

      {content.mode === "mc" ? (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={pending}
              onClick={() => submit(option)}
              className="border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-left text-sm disabled:opacity-60"
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(typed);
          }}
          className="flex flex-col gap-2"
        >
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={pending}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className="border-linie-stark bg-flaeche text-tinte focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1"
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Einen Moment …" : "Antworten"}
          </Button>
        </form>
      )}

      <button
        type="button"
        onClick={onExit}
        className="text-tinte-leise hover:text-tinte-weich self-start text-xs font-medium"
      >
        Zur Übersicht
      </button>
    </Block>
  );
}
