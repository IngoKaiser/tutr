"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  HakenIcon,
  KopierenIcon,
  LautsprecherAusIcon,
  LautsprecherIcon,
  MikrofonIcon,
  PauseIcon,
  PfeilRunterIcon,
  PlayIcon,
  SendenIcon,
  StoppIcon,
} from "@/components/shell/icons";
import { TutorMarkdown } from "@/components/shell/markdown";
import { Block, ContextChip, Notice } from "@/components/shell/primitives";
import { istEingeholt, naechsteLaenge } from "@/lib/tutor/stream-text";

import { useDiktat, useVorlesen } from "./use-speech";

const FIELD_RAHMEN =
  "border-linie-stark bg-flaeche focus-within:outline-koenigsblau rounded-[12px] border focus-within:outline-2 focus-within:outline-offset-1";

/** Fester Hinweis unter jeder Tutor-Antwort (ADR 0010 D5) – der Server sagt das, nicht das Modell. */
const HERKUNFT = "Allgemeinwissen — noch ohne dein Material und dein Lehrwerk.";

const NICHT_EINGERICHTET =
  "Der Tutor ist gerade nicht eingerichtet. Deine Vokabeln, Karten und der Prüfungskalender funktionieren weiter.";

/** Einmaliger Hinweis vor der ersten Diktat-Nutzung (ADR 0011 D1). */
const DIKTAT_HINWEIS_KEY = "tutr:diktat-hinweis";
const DIKTAT_HINWEIS =
  "Zum Diktieren schickt dein Browser die Aufnahme an seinen Hersteller (bei Chrome an Google, bei Safari an Apple) und gibt den Text zurück. Nichts davon läuft über tutr, und die Aufnahme wird nirgends gespeichert.";

export type ChatMessage = { id: string; role: "nutzer" | "tutor"; content: string };
type VorlesenSteuerung = ReturnType<typeof useVorlesen>;

/** Runder 36er-Knopf für die Icons im Eingabefeld. Das Icon erbt die Farbe (`currentColor`). */
const ICON_BUTTON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40";

/**
 * Ein Tutor-Gespräch (T-02, umgebaut in T-07).
 *
 * Zwei Ebenen (wie ChatGPT und Claude): `/tutor` ist die Übersicht, hier ist
 * das Gespräch. Der Kopf trägt deshalb einen `back` auf die Übersicht –
 * `primitives.tsx` verlangt das für jede Seite unterhalb eines
 * Fußleisten-Bereichs, und genau das hatte die erste Fassung vergessen.
 *
 * `sessionId` ist `null`, solange das Gespräch nur gedacht ist
 * (`/tutor/neu`): Erst die erste Frage legt es an, dann wandert die URL per
 * `replaceState` auf `/tutor/<id>` – ohne Navigation, damit der laufende
 * Stream nicht abreißt.
 */
export function Conversation({
  sessionId: anfangsId,
  subjectId,
  subjectName,
  subjectLanguage,
  topicTitle,
  entryPoint,
  initialMessages,
  available,
}: {
  sessionId: string | null;
  subjectId: string;
  subjectName: string;
  subjectLanguage: string | null;
  topicTitle: string | null;
  entryPoint: "freie_frage" | "verstehen";
  initialMessages: ChatMessage[];
  available: boolean;
}) {
  const [sessionId, setSessionId] = useState(anfangsId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [zielText, setZielText] = useState("");
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const vorlesen = useVorlesen();

  // Geglätteter Textfluss: `zielText` ist, was angekommen ist, `streamText`,
  // was steht. Siehe `lib/tutor/stream-text.ts`.
  const streamText = useSanfterText(zielText, !pending);
  const { amEnde, sentinelRef, nachUnten } = useAmEnde([messages, streamText]);
  useAutoVorlesen(messages, vorlesen);

  async function senden() {
    const frage = input.trim();
    if (!frage || pending) return;
    setInput("");
    setFehler(null);
    setPending(true);
    setMessages((prev) => [...prev, { id: `lokal-${Date.now()}`, role: "nutzer", content: frage }]);
    setZielText("");

    try {
      const payload = sessionId
        ? { sessionId, message: frage }
        : { subjectId, entryPoint, message: frage };
      const { text, neueSessionId } = await streameAntwort(payload, setZielText);
      setMessages((prev) => [...prev, { id: `tutor-${Date.now()}`, role: "tutor", content: text }]);
      if (!sessionId && neueSessionId) {
        setSessionId(neueSessionId);
        // URL nachziehen, ohne zu navigieren – ein Reload landet danach im
        // richtigen Gespräch, der Stream bleibt aber unangetastet.
        window.history.replaceState(null, "", `/tutor/${neueSessionId}`);
      }
    } catch (problem) {
      setFehler(problem instanceof Error ? problem.message : "Da ging etwas schief.");
    } finally {
      setZielText("");
      setPending(false);
    }
  }

  const leer = messages.length === 0 && !streamText;

  return (
    <div className="flex flex-col gap-3">
      {/* Angeheftete Kopfzeile (T-07b): Weg zurück und Fach-Kontext bleiben
          beim Scrollen sichtbar. Keine „Tutor“-Überschrift – der aktive
          Fußleisten-Reiter sagt das schon, und die h1 fraß nur Höhe.
          `-mx-4 px-4` + Hintergrund, damit durchgescrollte Bubbles nicht
          dahinter durchscheinen; `-mt-5` frisst das `py-5` der Hülle. */}
      <div className="bg-papier border-linie sticky top-0 z-10 -mx-4 -mt-5 flex items-center gap-3 border-b px-4 py-2">
        <Link
          href="/tutor"
          className="text-tinte-leise hover:text-koenigsblau -ml-1 inline-flex shrink-0 items-center gap-1 px-1 py-1 text-[0.8125rem] font-medium"
        >
          <span aria-hidden="true">‹</span>
          Gespräche
        </Link>
        <ContextChip subject={subjectName} topic={topicTitle} />
      </div>

      {leer ? (
        <Notice>
          {entryPoint === "verstehen"
            ? "Erzähl, was ihr gemacht habt und wo du aussteigst."
            : "Stell deine Frage — der Tutor kennt dein Fach, aber noch nicht dein Material."}
        </Notice>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} vorlesen={vorlesen} />
          ))}
          {streamText ? (
            <MessageBubble
              message={{ id: "live", role: "tutor", content: streamText }}
              vorlesen={vorlesen}
              live
            />
          ) : null}
        </ol>
      )}

      {fehler ? <Notice>{fehler}</Notice> : null}

      {/* Der Anker, an dem „bin ich unten?“ gemessen wird. */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      <Composer
        available={available}
        pending={pending}
        value={input}
        sprache="de-DE"
        zielsprache={subjectLanguage}
        onChange={setInput}
        onSend={() => void senden()}
        vorlesen={vorlesen}
        amEnde={amEnde}
        nachUnten={nachUnten}
      />
    </div>
  );
}

// --- Nachrichten ------------------------------------------------------

function MessageBubble({
  message,
  vorlesen,
  live = false,
}: {
  message: ChatMessage;
  vorlesen: VorlesenSteuerung;
  live?: boolean;
}) {
  const istTutor = message.role === "tutor";
  const laeuft = vorlesen.sprichtId === message.id && !vorlesen.pausiert;
  const angehalten = vorlesen.sprichtId === message.id && vorlesen.pausiert;
  const [kopiert, setKopiert] = useState(false);
  const kopierTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (kopierTimer.current !== null) window.clearTimeout(kopierTimer.current);
    },
    [],
  );

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(message.content);
      setKopiert(true);
      if (kopierTimer.current !== null) window.clearTimeout(kopierTimer.current);
      kopierTimer.current = window.setTimeout(() => setKopiert(false), 1600);
    } catch {
      // Ohne Recht auf die Zwischenablage bleibt es beim Versuch – kein
      // Grund, dem Kind eine Fehlermeldung hinzustellen.
    }
  }
  return (
    <li className={`flex flex-col gap-1 ${istTutor ? "items-start" : "items-end"}`}>
      <div
        className={`max-w-[85%] rounded-[10px] border px-3 py-2 text-sm ${
          istTutor
            ? "border-linie bg-papier text-tinte"
            : "border-koenigsblau bg-koenigsblau-hell text-tinte whitespace-pre-wrap"
        }`}
      >
        {istTutor ? (
          // Markdown erst rendern, wenn die Antwort steht (T-08). Während des
          // Streamens Klartext: halbfertiges Markdown (`**` ohne Ende) würde
          // sonst bei jedem Wort umspringen.
          live ? (
            <span className="whitespace-pre-wrap">
              {message.content}
              <span className="text-tinte-leise"> ▍</span>
            </span>
          ) : (
            <TutorMarkdown>{message.content}</TutorMarkdown>
          )
        ) : (
          message.content
        )}
      </div>
      {istTutor && !live ? (
        <div className="flex items-center gap-1">
          <NachrichtAktion label="Antwort kopieren" onClick={() => void kopieren()}>
            {kopiert ? <HakenIcon size={15} /> : <KopierenIcon size={15} />}
          </NachrichtAktion>
          {vorlesen.verfuegbar ? (
            <NachrichtAktion
              label={laeuft ? "Vorlesen anhalten" : angehalten ? "Weiterlesen" : "Vorlesen"}
              aktiv={laeuft || angehalten}
              onClick={() => {
                if (laeuft) vorlesen.pause();
                else if (angehalten) vorlesen.weiter();
                else vorlesen.liesVor(message.id, message.content);
              }}
            >
              {laeuft ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
            </NachrichtAktion>
          ) : null}
          <span className="text-tinte-leise ml-1 text-[0.6875rem]">{HERKUNFT}</span>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Ein kleiner Icon-Knopf unter einer Tutor-Antwort (T-10).
 *
 * Ersetzt die frühere Textschaltfläche „Vorlesen“/„Stopp“. Zwei Gründe:
 * Der Zustand „läuft gerade“ gehört ins Symbol (Play/Pause), nicht in
 * wechselnden Text – und zum Vorlesen kam mit dem Kopieren eine zweite
 * Aktion dazu, für die zwei nebeneinanderstehende Wörter zu laut wären.
 *
 * Die Bedeutung trägt das `aria-label`, nicht das Icon (`icons.tsx`).
 */
function NachrichtAktion({
  label,
  onClick,
  aktiv = false,
  children,
}: {
  label: string;
  onClick: () => void;
  aktiv?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`focus-visible:outline-koenigsblau flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ${
        aktiv ? "text-koenigsblau" : "text-tinte-leise hover:text-koenigsblau"
      }`}
    >
      {children}
    </button>
  );
}

// --- Eingabe ----------------------------------------------------------

function Composer({
  available,
  pending,
  value,
  sprache,
  zielsprache,
  onChange,
  onSend,
  vorlesen,
  amEnde,
  nachUnten,
}: {
  available: boolean;
  pending: boolean;
  value: string;
  sprache: string;
  zielsprache: string | null;
  onChange: (v: string) => void;
  onSend: () => void;
  vorlesen: VorlesenSteuerung;
  amEnde: boolean;
  nachUnten: () => void;
}) {
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const diktat = useDiktat({ sprache, onText: onChange });

  function mikrofon() {
    if (diktat.hoert) {
      diktat.umschalten(value);
      return;
    }
    let bestaetigt = false;
    try {
      bestaetigt = window.localStorage.getItem(DIKTAT_HINWEIS_KEY) === "1";
    } catch {
      // localStorage nicht verfügbar – dann den Hinweis lieber jedes Mal zeigen.
    }
    if (!bestaetigt) {
      setHinweisOffen(true);
      return;
    }
    vorlesen.stop();
    diktat.umschalten(value);
  }

  function hinweisWeg() {
    try {
      window.localStorage.setItem(DIKTAT_HINWEIS_KEY, "1");
    } catch {
      // egal
    }
    setHinweisOffen(false);
    vorlesen.stop();
    diktat.umschalten(value);
  }

  if (!available) {
    return (
      <Block>
        <Notice>{NICHT_EINGERICHTET}</Notice>
      </Block>
    );
  }

  const absendbar = value.trim().length > 0 && !pending;

  return (
    // `sticky bottom-0` im scrollenden `main`: klebt genau über der
    // Fußleiste, ohne deren Höhe zu kennen. `-mx-4 px-4` lässt den
    // Hintergrund bis an den Rand laufen, damit darunter kein Text
    // durchscheint. `-mb-5` frisst das `py-5` der Hülle.
    <div className="bg-papier border-linie sticky bottom-0 -mx-4 -mb-5 flex flex-col gap-2 border-t px-4 pt-2 pb-3">
      {!amEnde ? (
        <button
          type="button"
          onClick={nachUnten}
          aria-label="Zum Ende springen"
          className="border-linie-stark bg-flaeche text-tinte-weich hover:bg-papier-tief hover:text-tinte absolute -top-11 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border shadow-sm transition-colors"
        >
          <PfeilRunterIcon size={17} />
        </button>
      ) : null}

      {hinweisOffen ? (
        <Block>
          <Notice>{DIKTAT_HINWEIS}</Notice>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={hinweisWeg}
              className="bg-koenigsblau text-auf-koenigsblau rounded-[9px] px-4 py-2 text-sm font-semibold"
            >
              Verstanden, los
            </button>
            <button
              type="button"
              onClick={() => setHinweisOffen(false)}
              className="border-linie-stark bg-flaeche text-tinte rounded-[9px] border px-4 py-2 text-sm font-semibold"
            >
              Doch tippen
            </button>
          </div>
        </Block>
      ) : null}

      {diktat.hoert ? (
        <span className="text-koenigsblau text-[0.6875rem] font-medium">tutr hört zu …</span>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className={`${FIELD_RAHMEN} flex items-end gap-1 py-1.5 pr-1.5 pl-3`}
      >
        {/*
         * Wächst mit dem Text, bis zu einer Deckelhöhe – danach scrollt es
         * (V-13). Vorher stand hier `rows={1}` ohne jede Anpassung: Alles ab
         * der zweiten Zeile war einfach weg, ohne Bildlaufleiste oder
         * anderen Hinweis, dass mehr dasteht, als sichtbar ist.
         *
         * Reines CSS, kein `useEffect`, kein `scrollHeight`-Messen: Ein
         * unsichtbarer Zwilling mit demselben Text, derselben Schrift und
         * demselben Innenabstand bekommt über CSS Grid dieselbe Zelle wie
         * das Feld (`col-start-1 row-start-1`) – der Zwilling hat eine
         * natürliche Höhe (er ist nur Text), das Feld übernimmt sie über
         * die Zellhöhe. `value` ist ohnehin schon React-Zustand, der
         * Zwilling bekommt ihn einfach mit, kein Zusatzcode nötig. Die
         * Deckelhöhe (`max-h-40`) sitzt auf der gemeinsamen Hülle, die dann
         * selbst scrollt – eine einzige Bildlaufleiste für beide Ebenen.
         */}
        <div className="grid max-h-40 min-h-9 min-w-0 flex-1 overflow-y-auto text-sm">
          <div
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 py-1.5 [overflow-wrap:anywhere] whitespace-pre-wrap"
          >
            {value ? `${value} ` : " "}
          </div>
          <textarea
            value={value}
            onChange={(e) => {
              vorlesen.stop();
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder={
              zielsprache ? "Frag etwas — auf Deutsch." : "Frag etwas oder sag, wo es hakt."
            }
            className="text-tinte placeholder:text-tinte-leise col-start-1 row-start-1 w-full resize-none overflow-hidden bg-transparent py-1.5 outline-none"
          />
        </div>

        {vorlesen.verfuegbar ? (
          <button
            type="button"
            onClick={vorlesen.umschaltenImmer}
            aria-pressed={vorlesen.immerAn}
            aria-label={vorlesen.immerAn ? "Antworten vorlesen: an" : "Antworten vorlesen: aus"}
            className={`${ICON_BUTTON} ${
              vorlesen.immerAn
                ? "bg-koenigsblau-hell text-koenigsblau"
                : "text-tinte-leise hover:bg-papier-tief"
            }`}
          >
            {vorlesen.immerAn ? <LautsprecherIcon /> : <LautsprecherAusIcon />}
          </button>
        ) : null}

        {diktat.verfuegbar ? (
          <button
            type="button"
            onClick={mikrofon}
            aria-pressed={diktat.hoert}
            aria-label={diktat.hoert ? "Diktat beenden" : "Diktieren"}
            className={`${ICON_BUTTON} ${
              diktat.hoert
                ? "bg-koenigsblau text-auf-koenigsblau"
                : "text-tinte-leise hover:bg-papier-tief"
            }`}
          >
            {diktat.hoert ? <StoppIcon size={16} /> : <MikrofonIcon />}
          </button>
        ) : null}

        <button
          type="submit"
          disabled={!absendbar}
          aria-label={pending ? "Der Tutor schreibt" : "Frage senden"}
          className={`${ICON_BUTTON} ${
            absendbar
              ? "bg-koenigsblau text-auf-koenigsblau"
              : "bg-papier-tief text-tinte-leise cursor-default"
          }`}
        >
          <SendenIcon className={pending ? "animate-pulse" : undefined} />
        </button>
      </form>
    </div>
  );
}

// --- Haken -----------------------------------------------------------

/** Gibt den angekommenen Text gleichmäßig frei statt in Schüben (T-07). */
function useSanfterText(ziel: string, fertig: boolean): string {
  const [laenge, setLaenge] = useState(0);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      setLaenge((bisher) => {
        // Deckt auch den Rücksprung auf 0 ab (neue Antwort): `naechsteLaenge`
        // folgt einer Korrektur nach unten sofort.
        const naechste = naechsteLaenge(bisher, ziel.length, fertig);
        if (!istEingeholt(naechste, ziel.length)) id = requestAnimationFrame(tick);
        return naechste;
      });
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [ziel, fertig]);

  return ziel.slice(0, laenge);
}

/** So nah am Ende gilt noch als „unten“ (Pixel). */
const ENDE_TOLERANZ = 64;

/**
 * „Klebt“ der Blick am Ende? (T-07, neu gebaut in T-10.)
 *
 * Gemessen wird jetzt direkt am **Scroll-Container** – das ist `main` aus
 * dem App-Rahmen, gefunden über `closest()` vom Anker aus. Vorher hing das
 * an einem `IntersectionObserver`: Der meldet nichts, solange das Dokument
 * verborgen ist, und ließ den Pfeil nach unten damit auch dann aus, wenn er
 * gebraucht wurde. Eine Abfrage von `scrollTop`/`scrollHeight` ist
 * deterministisch, im Test nachvollziehbar und kennt keine solchen Löcher.
 *
 * Nebenwirkung, die eigentlich der Hauptpunkt ist: Mit dem Container in der
 * Hand lässt sich ein Gespräch beim Öffnen **ganz nach unten** setzen –
 * dorthin, wo man weiterliest.
 */
function useAmEnde(abhaengigkeiten: readonly unknown[]) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [amEnde, setAmEnde] = useState(true);

  const behaelter = useCallback(() => sentinelRef.current?.closest("main") ?? null, []);

  const springAnsEnde = useCallback(
    (sanft: boolean) => {
      const el = behaelter();
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: sanft ? "smooth" : "auto" });
    },
    [behaelter],
  );

  /** Für den Pfeil-Knopf – ohne Argument, damit kein Klick-Ereignis durchrutscht. */
  const nachUnten = useCallback(() => springAnsEnde(true), [springAnsEnde]);

  useEffect(() => {
    const el = behaelter();
    if (!el) return;
    const messen = () =>
      setAmEnde(el.scrollHeight - el.scrollTop - el.clientHeight <= ENDE_TOLERANZ);
    messen();
    el.addEventListener("scroll", messen, { passive: true });
    window.addEventListener("resize", messen);
    return () => {
      el.removeEventListener("scroll", messen);
      window.removeEventListener("resize", messen);
    };
  }, [behaelter]);

  // Beim Öffnen ans Ende, ohne Animation (T-10): Ein gespeichertes Gespräch
  // soll dort aufgehen, wo es aufgehört hat, nicht am Anfang. Zweimal, weil
  // Markdown und Schriften die Höhe nach dem ersten Layout noch ändern.
  useLayoutEffect(() => {
    springAnsEnde(false);
    const id = requestAnimationFrame(() => springAnsEnde(false));
    return () => cancelAnimationFrame(id);
  }, [springAnsEnde]);

  // Solange der Blick unten klebt, mitscrollen – wer hochgescrollt hat, wird
  // nicht zurückgerissen (das ist der Punkt, an dem sich Chats unangenehm
  // anfühlen).
  useEffect(() => {
    if (amEnde) springAnsEnde(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bewusst an den übergebenen Werten statt an einer festen Liste
  }, [amEnde, springAnsEnde, ...abhaengigkeiten]);

  return { amEnde, sentinelRef, nachUnten };
}

/** Liest eine neu hinzugekommene Tutor-Antwort vor, wenn „immer vorlesen“ an ist (ADR 0011 D2). */
function useAutoVorlesen(messages: ChatMessage[], vorlesen: VorlesenSteuerung) {
  const zuletztRef = useRef<string | null>(null);
  const bereitRef = useRef(false);
  const { immerAn, liesVor } = vorlesen;
  useEffect(() => {
    const erstesMal = !bereitRef.current;
    bereitRef.current = true;

    const letzte = messages[messages.length - 1];
    if (!letzte || letzte.role !== "tutor") return;

    /**
     * Beim Öffnen nur merken, nicht vorlesen (T-10). Ein gespeichertes
     * Gespräch soll nicht von selbst lossprechen – und auf iOS wird ein
     * `speak()` ohne vorausgegangene Nutzergeste ohnehin verworfen, wobei
     * weder `onend` noch `onerror` feuert: Genau daher kam der Knopf, der
     * beim Öffnen auf „Stopp“ stand, obwohl nichts lief.
     */
    if (erstesMal) {
      zuletztRef.current = letzte.id;
      return;
    }

    if (letzte.id === zuletztRef.current) return;
    zuletztRef.current = letzte.id;
    if (immerAn) liesVor(letzte.id, letzte.content);
  }, [messages, immerAn, liesVor]);
}

// --- Stream lesen ----------------------------------------------------

type SendePayload =
  | { sessionId: string; message: string }
  | { subjectId: string; entryPoint: "freie_frage" | "verstehen"; message: string };

/**
 * Schickt die Frage an `POST /api/tutor` und reicht den bisher angekommenen
 * Text an `onDelta` weiter. Wirft mit der Server-Fehlermeldung (deutscher
 * Satz), wenn die Antwort kein 2xx ist – auch das Rate-Limit (429) landet so
 * als lesbarer Hinweis in der Oberfläche.
 */
async function streameAntwort(
  payload: SendePayload,
  onDelta: (voll: string) => void,
): Promise<{ text: string; neueSessionId: string | null }> {
  const res = await fetch("/api/tutor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    const grund = (await res.text().catch(() => "")) || "Der Tutor antwortet gerade nicht.";
    throw new Error(grund);
  }

  const neueSessionId = res.headers.get("x-tutor-session");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let voll = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    voll += decoder.decode(value, { stream: true });
    onDelta(voll);
  }

  return { text: voll, neueSessionId };
}
