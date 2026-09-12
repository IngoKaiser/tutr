"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
      <PageHeader title="Üben" />

      <div className="flex flex-col gap-3">
        {setLoadFailed ? (
          <Notice>
            Dieses Set ließ sich gerade nicht laden – vielleicht wurde es in der Zwischenzeit
            gelöscht oder ist leer.
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
          </>
        )}
      </div>
    </>
  );
}

/**
 * Ein Fach, für sich ladend. `subject.total` ist immer > 0 – nur Fächer mit
 * fälligen Karten stehen überhaupt in `bySubject` (siehe `loadDueBySubject()`).
 *
 * Keine Richtungswahl mehr hier (V-04, ADR 0008 Nachtrag): „Loslegen" mischt
 * immer beide Richtungen. Wer gezielt eine Richtung oder ein einzelnes Set
 * will, geht über die Set-Seite (Set-Modus).
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
      <Stack
        confident={subject.wiederholen}
        practicing={subject.neu}
        again={subject.erneutLernen}
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
