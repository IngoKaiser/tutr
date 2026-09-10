"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Block, Button, ContextChip, Notice, PageHeader } from "@/components/shell/primitives";

import type { SessionView, TutorOverview } from "./actions";
import { useDiktat, useVorlesen } from "./use-speech";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/** Fester Hinweis unter jeder Tutor-Antwort (ADR 0010 D5) – der Server sagt das, nicht das Modell. */
const HERKUNFT = "Allgemeinwissen — noch ohne dein Material und dein Lehrwerk.";

const NICHT_EINGERICHTET =
  "Der Tutor ist gerade nicht eingerichtet. Deine Vokabeln, Karten und der Prüfungskalender funktionieren weiter.";

/** Einmaliger Hinweis vor der ersten Diktat-Nutzung (ADR 0011 D1, §. 2). */
const DIKTAT_HINWEIS_KEY = "tutr:diktat-hinweis";
const DIKTAT_HINWEIS =
  "Zum Diktieren schickt dein Browser die Aufnahme an seinen Hersteller (bei Chrome an Google, bei Safari an Apple) und gibt den Text zurück. Nichts davon läuft über tutr, und die Aufnahme wird nirgends gespeichert.";

type ChatMessage = { id: string; role: "nutzer" | "tutor"; content: string };
type Draft = { subjectId: string; entryPoint: "freie_frage" | "verstehen" };
type VorlesenSteuerung = ReturnType<typeof useVorlesen>;

const MINI_BUTTON =
  "border-linie-stark bg-flaeche text-tinte-weich hover:bg-papier-tief rounded-md border px-2 py-1 text-[0.6875rem] font-medium disabled:opacity-50";

export function TutorChat({
  overview,
  active,
  activeId,
  available,
}: {
  overview: TutorOverview | null;
  active: SessionView | null;
  activeId: string | null;
  available: boolean;
}) {
  if (!overview) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Tutor" />
        <Notice>Der Tutor ist gerade nicht verfügbar.</Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Tutor" />
      {active ? (
        <Conversation overview={overview} active={active} available={available} />
      ) : (
        <StartForm overview={overview} available={available} />
      )}
      <PreviousSessions sessions={overview.sessions} activeId={activeId} />
    </div>
  );
}

// --- gemeinsame Bausteine ---------------------------------------------

function MessageList({
  messages,
  streamText,
  vorlesen,
}: {
  messages: ChatMessage[];
  streamText: string;
  vorlesen: VorlesenSteuerung;
}) {
  const endeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endeRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamText]);

  return (
    <>
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
      <div ref={endeRef} />
    </>
  );
}

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
  const spricht = vorlesen.sprichtId === message.id;
  return (
    <li className={`flex flex-col gap-1 ${istTutor ? "items-start" : "items-end"}`}>
      <div
        className={`max-w-[85%] rounded-[10px] border px-3 py-2 text-sm whitespace-pre-wrap ${
          istTutor
            ? "border-linie bg-papier text-tinte"
            : "border-koenigsblau bg-koenigsblau-hell text-tinte"
        }`}
      >
        {message.content}
        {live ? <span className="text-tinte-leise"> ▍</span> : null}
      </div>
      {istTutor && !live ? (
        <div className="flex items-center gap-2">
          <span className="text-tinte-leise text-[0.6875rem]">{HERKUNFT}</span>
          {vorlesen.verfuegbar ? (
            <button
              type="button"
              onClick={() =>
                spricht ? vorlesen.stop() : vorlesen.liesVor(message.id, message.content)
              }
              className="text-koenigsblau text-[0.6875rem] font-medium"
            >
              {spricht ? "Stopp" : "Vorlesen"}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Composer({
  available,
  pending,
  disabled,
  placeholder,
  label,
  value,
  sprache,
  onChange,
  onSend,
  onTippen,
  vorlesen,
}: {
  available: boolean;
  pending: boolean;
  disabled: boolean;
  placeholder: string;
  label: string;
  value: string;
  sprache: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onTippen: () => void;
  vorlesen: VorlesenSteuerung;
}) {
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const diktat = useDiktat({ sprache, onText: onChange });

  function mikrofon() {
    if (diktat.hoert) {
      diktat.umschalten(value);
      return;
    }
    let bestaetigt = true;
    try {
      bestaetigt = window.localStorage.getItem(DIKTAT_HINWEIS_KEY) === "1";
    } catch {
      // localStorage nicht verfügbar – dann den Hinweis lieber jedes Mal zeigen.
      bestaetigt = false;
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className="flex flex-col gap-2"
    >
      {hinweisOffen ? (
        <Block>
          <Notice>{DIKTAT_HINWEIS}</Notice>
          <div className="flex gap-2">
            <Button type="button" onClick={hinweisWeg}>
              Verstanden, los
            </Button>
            <Button type="button" quiet onClick={() => setHinweisOffen(false)}>
              Doch tippen
            </Button>
          </div>
        </Block>
      ) : null}

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => {
            vorlesen.stop();
            onTippen();
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={2}
          placeholder={placeholder}
          className={`${FIELD} w-full resize-none ${diktat.verfuegbar ? "pr-11" : ""}`}
        />
        {diktat.verfuegbar ? (
          <button
            type="button"
            onClick={mikrofon}
            aria-pressed={diktat.hoert}
            aria-label={diktat.hoert ? "Diktat beenden" : "Diktieren"}
            className={`absolute top-2 right-2 rounded-md border px-2 py-1 text-xs font-medium ${
              diktat.hoert
                ? "border-koenigsblau bg-koenigsblau text-auf-koenigsblau"
                : "border-linie-stark bg-flaeche text-tinte-weich hover:bg-papier-tief"
            }`}
          >
            {diktat.hoert ? "● Stopp" : "🎤"}
          </button>
        ) : null}
      </div>

      {diktat.hoert ? (
        <span className="text-koenigsblau text-[0.6875rem] font-medium">tutr hört zu …</span>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={disabled}>
          {pending ? "Der Tutor schreibt …" : label}
        </Button>
        {vorlesen.verfuegbar ? (
          <button
            type="button"
            onClick={vorlesen.umschaltenImmer}
            aria-pressed={vorlesen.immerAn}
            className={`${MINI_BUTTON} shrink-0 ${
              vorlesen.immerAn ? "border-koenigsblau text-koenigsblau" : ""
            }`}
          >
            {vorlesen.immerAn ? "Vorlesen: an" : "Vorlesen: aus"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** Liest eine neu hinzugekommene Tutor-Antwort vor, wenn „immer vorlesen" an ist (ADR 0011 D2). */
function useAutoVorlesen(messages: ChatMessage[], vorlesen: VorlesenSteuerung) {
  const zuletztRef = useRef<string | null>(null);
  const { immerAn, liesVor } = vorlesen;
  useEffect(() => {
    const letzte = messages[messages.length - 1];
    if (!letzte || letzte.role !== "tutor" || letzte.id === zuletztRef.current) return;
    zuletztRef.current = letzte.id;
    if (immerAn) liesVor(letzte.id, letzte.content);
  }, [messages, immerAn, liesVor]);
}

// --- laufendes Gespräch --------------------------------------------------

function Conversation({
  overview,
  active,
  available,
}: {
  overview: TutorOverview;
  active: SessionView;
  available: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    active.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
  );
  const [streamText, setStreamText] = useState("");
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const vorlesen = useVorlesen();
  useAutoVorlesen(messages, vorlesen);

  async function senden() {
    const frage = input.trim();
    if (!frage || pending) return;
    setInput("");
    setFehler(null);
    setPending(true);
    setMessages((prev) => [...prev, { id: `lokal-${Date.now()}`, role: "nutzer", content: frage }]);
    setStreamText("");

    try {
      const { text } = await streameAntwort(
        { sessionId: active.id, message: frage },
        setStreamText,
      );
      setMessages((prev) => [...prev, { id: `tutor-${Date.now()}`, role: "tutor", content: text }]);
    } catch (problem) {
      setFehler(problem instanceof Error ? problem.message : "Da ging etwas schief.");
    } finally {
      setStreamText("");
      setPending(false);
    }
  }

  const fach = overview.subjects.find((s) => s.name === active.subjectName);

  return (
    <div className="flex flex-col gap-3">
      <ContextChip subject={active.subjectName} topic={active.topicTitle ?? "ohne Thema"} />
      <MessageList messages={messages} streamText={streamText} vorlesen={vorlesen} />
      {fehler ? <Notice>{fehler}</Notice> : null}
      <Composer
        available={available}
        pending={pending}
        disabled={pending || !input.trim()}
        label="Fragen"
        placeholder={
          fach?.language ? "Frag etwas — auf Deutsch." : "Frag etwas oder sag, wo es hakt."
        }
        value={input}
        sprache="de-DE"
        onChange={setInput}
        onSend={() => void senden()}
        onTippen={vorlesen.stop}
        vorlesen={vorlesen}
      />
    </div>
  );
}

// --- neues Gespräch ----------------------------------------------------

function StartForm({ overview, available }: { overview: TutorOverview; available: boolean }) {
  const [draft, setDraft] = useState<Draft>({
    subjectId: overview.subjects[0]?.id ?? "",
    entryPoint: "freie_frage",
  });
  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const vorlesen = useVorlesen();
  useAutoVorlesen(messages, vorlesen);

  if (overview.subjects.length === 0) {
    return (
      <Block>
        <Notice>
          Leg zuerst unter „Fächer&ldquo; ein Fach im aktuellen Schuljahr an — der Tutor braucht ein
          Fach, um zu wissen, worüber ihr redet.
        </Notice>
      </Block>
    );
  }

  async function senden() {
    const frage = input.trim();
    if (!frage || pending) return;
    setInput("");
    setFehler(null);
    setPending(true);
    setMessages((prev) => [...prev, { id: `lokal-${Date.now()}`, role: "nutzer", content: frage }]);
    setStreamText("");

    try {
      const payload = sessionId
        ? { sessionId, message: frage }
        : { subjectId: draft.subjectId, entryPoint: draft.entryPoint, message: frage };
      const { text, neueSessionId } = await streameAntwort(payload, setStreamText);
      setMessages((prev) => [...prev, { id: `tutor-${Date.now()}`, role: "tutor", content: text }]);
      if (!sessionId && neueSessionId) {
        setSessionId(neueSessionId);
        window.history.replaceState(null, "", `/tutor?s=${neueSessionId}`);
      }
    } catch (problem) {
      setFehler(problem instanceof Error ? problem.message : "Da ging etwas schief.");
    } finally {
      setStreamText("");
      setPending(false);
    }
  }

  const gestartet = messages.length > 0 || sessionId !== null;
  const fach = overview.subjects.find((s) => s.id === draft.subjectId);

  return (
    <div className="flex flex-col gap-3">
      {gestartet && fach ? (
        <ContextChip subject={fach.name} topic="ohne Thema" />
      ) : (
        <Block title="Neues Gespräch">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium">Fach</span>
            <select
              value={draft.subjectId}
              onChange={(e) => setDraft((d) => ({ ...d, subjectId: e.target.value }))}
              className={FIELD}
            >
              {overview.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[0.8125rem] font-medium">Einstieg</legend>
            <div className="flex gap-1.5">
              {(
                [
                  ["freie_frage", "Freie Frage"],
                  ["verstehen", "Verstehen"],
                ] as const
              ).map(([wert, label]) => (
                <label
                  key={wert}
                  className={`flex-1 rounded-md border px-3 py-2 text-center text-xs font-medium ${
                    draft.entryPoint === wert
                      ? "border-koenigsblau bg-koenigsblau-hell text-koenigsblau"
                      : "border-linie-stark bg-flaeche text-tinte-weich"
                  }`}
                >
                  <input
                    type="radio"
                    name="einstieg"
                    value={wert}
                    checked={draft.entryPoint === wert}
                    onChange={() => setDraft((d) => ({ ...d, entryPoint: wert }))}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
            <span className="text-tinte-leise text-[0.6875rem]">
              {draft.entryPoint === "verstehen"
                ? "Du hast etwas im Unterricht nicht verstanden — der Tutor fragt nach, wo es hakt."
                : "Stell irgendeine Frage zum Fach."}
            </span>
          </fieldset>
        </Block>
      )}

      {gestartet ? (
        <MessageList messages={messages} streamText={streamText} vorlesen={vorlesen} />
      ) : null}
      {fehler ? <Notice>{fehler}</Notice> : null}

      <Composer
        available={available}
        pending={pending}
        disabled={pending || !input.trim()}
        label={gestartet ? "Fragen" : "Los"}
        placeholder={
          draft.entryPoint === "verstehen"
            ? "Was habt ihr gemacht, und wo steigst du aus?"
            : "Deine Frage …"
        }
        value={input}
        sprache="de-DE"
        onChange={setInput}
        onSend={() => void senden()}
        onTippen={vorlesen.stop}
        vorlesen={vorlesen}
      />
    </div>
  );
}

// --- bisherige Gespräche ----------------------------------------------

function PreviousSessions({
  sessions,
  activeId,
}: {
  sessions: TutorOverview["sessions"];
  activeId: string | null;
}) {
  const andere = sessions.filter((s) => s.id !== activeId);
  if (andere.length === 0 && !activeId) return null;

  return (
    <div className="border-linie flex flex-col gap-2 border-t pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-tinte-leise text-[0.6875rem] font-semibold tracking-wider uppercase">
          Frühere Gespräche
        </span>
        {activeId ? (
          <Link href="/tutor" className="text-koenigsblau text-xs font-medium">
            Neues Gespräch
          </Link>
        ) : null}
      </div>
      {andere.length === 0 ? (
        <Notice>Noch keine.</Notice>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {andere.map((s) => (
            <li key={s.id}>
              <Link
                href={`/tutor?s=${s.id}`}
                className="border-linie bg-papier hover:bg-papier-tief flex items-center justify-between gap-3 rounded-[9px] border px-3 py-2"
              >
                <span className="text-tinte min-w-0 flex-1 truncate text-[0.8125rem]">
                  {s.title}
                </span>
                <span className="text-tinte-leise shrink-0 text-[0.75rem]">{s.subjectName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Stream lesen ----------------------------------------------------

type SendePayload =
  | { sessionId: string; message: string }
  | { subjectId: string; entryPoint: "freie_frage" | "verstehen"; message: string };

/**
 * Schickt die Frage an `POST /api/tutor` und reicht die Wortdeltas an
 * `onDelta` weiter (den vollen Text bisher, nicht nur das neue Stück).
 * Wirft mit der Server-Fehlermeldung (deutscher Satz), wenn die Antwort
 * kein 2xx ist – auch das Rate-Limit (429) landet so als lesbarer Hinweis
 * in der Oberfläche.
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
