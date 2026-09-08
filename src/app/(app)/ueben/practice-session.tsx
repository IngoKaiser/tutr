"use client";

import { useMemo, useState, useTransition } from "react";

import { Block, Button, Notice, Stack } from "@/components/shell/primitives";
import { buildMultipleChoiceOptions } from "@/lib/vocab/distractors";
import {
  advance,
  buildSession,
  currentCard,
  isSessionComplete,
  type SessionState,
} from "@/lib/vocab/session";

import {
  loadSessionCards,
  submitAnswer,
  type DueOverview,
  type SessionCardContent,
} from "./actions";

type Phase = "wahl" | "session" | "fertig";
type DirectionChoice = "vorwaerts" | "rueckwaerts" | "gemischt";

/**
 * Übungssession (V-02). Ein Client-Baustein statt einer eigenen Route –
 * es gibt nichts, worauf man tief verlinken müsste, und der Zustand
 * (Übersicht → Session → Fertig) ist rein clientseitig.
 *
 * Treibt `session.ts` (die reine Warteschlange) mit echten Server-Aktionen:
 * Laden holt die fälligen Karten, jede Antwort geht einzeln an
 * `submitAnswer()` – der Server bewertet, das Ergebnis (Stapel) kommt
 * zurück und wandert in `advance()`.
 */
export function PracticeSession({
  overview,
  canStart,
}: {
  overview: DueOverview | null;
  canStart: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("wahl");
  const [direction, setDirection] = useState<DirectionChoice>("gemischt");
  const [cards, setCards] = useState<SessionCardContent[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadError, setLoadError] = useState(false);

  function start() {
    setLoadError(false);
    startTransition(async () => {
      const loaded = await loadSessionCards(direction === "gemischt" ? null : direction);
      if (!loaded || loaded.length === 0) {
        setLoadError(true);
        return;
      }
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
      setPhase("session");
    });
  }

  if (phase === "fertig") {
    return (
      <Block title="Geschafft" emphasized>
        <Notice>Alle fälligen Karten sind einmal gesessen. Bis zur nächsten Fälligkeit.</Notice>
        <Button onClick={() => setPhase("wahl")}>Zur Übersicht</Button>
      </Block>
    );
  }

  if (phase === "session" && session) {
    return (
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
      />
    );
  }

  return (
    <>
      <Block title="Fällig heute" trailing="setübergreifend">
        {overview ? (
          <>
            <Stack
              confident={overview.wiederholen}
              practicing={overview.neu}
              again={overview.erneutLernen}
            />
            {canStart ? (
              <>
                <DirectionPicker value={direction} onChange={setDirection} />
                <Button onClick={start} disabled={pending || overview.total === 0}>
                  {pending ? "Einen Moment …" : "Session starten"}
                </Button>
                {loadError ? (
                  <Notice>
                    Gerade nichts zu laden – vielleicht ist in der Zwischenzeit alles erledigt.
                  </Notice>
                ) : null}
                {overview.total === 0 ? (
                  <Notice>Nichts fällig. Schau später wieder vorbei.</Notice>
                ) : null}
              </>
            ) : (
              <Notice>
                Nur {overview.total === 1 ? "das Kind übt" : "Kinder üben"} selbst – hier siehst du
                nur den Stand.
              </Notice>
            )}
          </>
        ) : (
          <Notice>Zahlen sind gerade nicht verfügbar.</Notice>
        )}
      </Block>

      <Block title="Prüfungsmodus">
        <Notice>Kommt mit V-04.</Notice>
      </Block>

      <Block title="Schwachstellen">
        <Notice>Kommt mit V-04.</Notice>
      </Block>
    </>
  );
}

function DirectionPicker({
  value,
  onChange,
}: {
  value: DirectionChoice;
  onChange: (value: DirectionChoice) => void;
}) {
  const OPTIONS: { value: DirectionChoice; label: string }[] = [
    { value: "gemischt", label: "Gemischt" },
    { value: "vorwaerts", label: "FR → DE" },
    { value: "rueckwaerts", label: "DE → FR" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Richtung"
      className="border-linie-stark flex overflow-hidden rounded-md border"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
            value === option.value
              ? "bg-koenigsblau text-auf-koenigsblau"
              : "text-tinte-weich hover:text-tinte bg-transparent"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ActiveCard({
  cards,
  session,
  onResult,
}: {
  cards: SessionCardContent[];
  session: SessionState;
  onResult: (next: SessionState) => void;
}) {
  const current = currentCard(session);
  const content = cards.find((c) => c.cardId === current?.cardId) ?? null;
  // `ActiveCard` wird pro Karte neu gemountet (siehe `key` beim Aufrufer),
  // deshalb startet die Uhr hier automatisch frisch – kein Effekt nötig.
  const [shownAt] = useState(() => Date.now());
  const [typed, setTyped] = useState("");
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

  function submit(given: string) {
    if (!content) return;
    startTransition(async () => {
      const result = await submitAnswer({
        cardId: content.cardId,
        mode: content.mode,
        given,
        responseMs: Date.now() - shownAt,
      });
      if (!result) return;
      onResult(advance(session, result.outcome));
    });
  }

  const prompt = content.direction === "vorwaerts" ? content.term : content.translation;

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
    </Block>
  );
}
