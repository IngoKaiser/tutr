"use client";

import { useMemo, useState, useTransition } from "react";

import { Block, Button, Notice, PageHeader, Stack } from "@/components/shell/primitives";
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
  submitAnswer,
  type DueOverview,
  type SessionCardContent,
} from "./actions";

type Phase = "wahl" | "uebung" | "fertig";
type DirectionChoice = "vorwaerts" | "rueckwaerts" | "gemischt";

/**
 * Übungssession (V-02). Ein Client-Baustein statt einer eigenen Route –
 * es gibt nichts, worauf man tief verlinken müsste, und der Zustand
 * (Übersicht → Üben → Fertig) ist rein clientseitig.
 *
 * `PageHeader` lebt hier, nicht in `page.tsx`: Die Kopfzeile zeigt in der
 * Übersicht die fälligen Karten, während des Übens den Fortschritt dieser
 * Runde – zwei verschiedene Zahlen, die eine serverseitig eingefrorene
 * Kopfzeile nicht beide zeigen könnte.
 *
 * Treibt `session.ts` (die reine Warteschlange) mit echten Server-Aktionen:
 * Laden holt die fälligen Karten, jede Antwort geht einzeln an
 * `submitAnswer()` – der Server bewertet, das Ergebnis (Stapel) kommt
 * zurück. Zwischen Antwort und nächster Karte steht eine Rückmelde-Stufe:
 * `advance()` läuft erst, wenn „Weiter" angetippt wird, nicht automatisch –
 * ohne die Rückmeldung wäre Raten nicht von Wissen zu unterscheiden, und
 * ein automatischer Sprung nach X Sekunden wäre wieder eine unsichtbare Uhr,
 * die zur Eile drängt (§15).
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
      setPhase("uebung");
    });
  }

  function backToOverview() {
    setSession(null);
    setCards([]);
    setPhase("wahl");
  }

  if (phase === "fertig") {
    return (
      <>
        <PageHeader title="Üben" trailing="Geschafft" />
        <Block title="Geschafft" emphasized>
          <Notice>Alle fälligen Karten sind einmal gesessen. Bis zur nächsten Fälligkeit.</Notice>
          <Button onClick={backToOverview}>Zur Übersicht</Button>
        </Block>
      </>
    );
  }

  if (phase === "uebung" && session) {
    const done = session.graduated.size;
    return (
      <>
        <PageHeader title="Üben" trailing={`${done} von ${session.total}`} />
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
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Üben" trailing={overview ? `${overview.total} fällig` : undefined} />

      <div className="flex flex-col gap-3">
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
                    {pending ? "Einen Moment …" : "Loslegen"}
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
                  Nur {overview.total === 1 ? "das Kind übt" : "Kinder üben"} selbst – hier siehst
                  du nur den Stand.
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
      </div>
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

type Reveal = { outcome: Outcome; given: string; mode: "mc" | "tippen" };

function ActiveCard({
  cards,
  session,
  onResult,
  onExit,
}: {
  cards: SessionCardContent[];
  session: SessionState;
  onResult: (next: SessionState) => void;
  onExit: () => void;
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
      setReveal({ outcome: result.outcome, given, mode: content.mode });
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
