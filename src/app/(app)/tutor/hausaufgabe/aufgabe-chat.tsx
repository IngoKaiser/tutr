"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { SendenIcon } from "@/components/shell/icons";
import { TutorMarkdown } from "@/components/shell/markdown";
import { Block, ContextChip, Notice, PageHeader } from "@/components/shell/primitives";
import { prepareImageForUpload, type PreparedImage } from "@/lib/image";

import { ladeAufgabeStand, type AufgabeDetail } from "./actions";

const FIELD_RAHMEN =
  "border-linie-stark bg-flaeche focus-within:outline-koenigsblau rounded-[12px] border focus-within:outline-2 focus-within:outline-offset-1";

const NICHT_EINGERICHTET =
  "Der Hausaufgaben-Tutor ist gerade nicht eingerichtet. Deine Vokabeln, Karten und der Prüfungskalender funktionieren weiter.";

const STATUS_LABEL: Record<AufgabeDetail["status"], string> = {
  offen: "offen",
  in_arbeit: "in Arbeit",
  geloest: "gelöst",
  loesung_gezeigt: "Lösung gezeigt",
  uebersprungen: "übersprungen",
};

const ABGESCHLOSSEN = new Set<AufgabeDetail["status"]>([
  "geloest",
  "loesung_gezeigt",
  "uebersprungen",
]);

type Nachricht = { id: string; role: "nutzer" | "tutor"; content: string };
type Bahn = "verstehen" | "versuch";

/**
 * Der Dialog zu einer einzelnen Aufgabe (T-03 PR 2, §4a Schritt 2–4).
 *
 * Anders als `../chat.tsx` (freier Tutor-Chat) trägt jede Nachricht hier
 * eine **Bahn** (`verstehen`/`versuch`) und optional ein Foto vom
 * Lösungsweg – `POST /api/tutor` entscheidet daraus über `naechsterZug()`
 * (`lib/tutor/hint-ladder.ts`), was der Tutor in diesem Zug überhaupt tun
 * darf. Nach jeder Antwort holt `ladeAufgabeStand()` den neuen Zustand:
 * Der Stream selbst trägt ihn nicht, er entsteht erst, nachdem die
 * Antwort steht (Klassifizierung, `route.ts` `schreibeHausaufgabenZug()`).
 */
export function AufgabeChat({
  aufgabe,
  available,
}: {
  aufgabe: AufgabeDetail;
  available: boolean;
}) {
  const [messages, setMessages] = useState<Nachricht[]>(aufgabe.messages);
  const [stand, setStand] = useState({
    status: aufgabe.status,
    attempts: aufgabe.attempts,
    hintLevel: aufgabe.hintLevel,
  });
  const [bahn, setBahn] = useState<Bahn>("versuch");
  const [input, setInput] = useState("");
  const [bild, setBild] = useState<{ vorschauUrl: string; datei: PreparedImage } | null>(null);
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [streamText, setStreamText] = useState("");

  const abgeschlossen = ABGESCHLOSSEN.has(stand.status);

  async function fotoAusgewaehlt(file: File) {
    try {
      const datei = await prepareImageForUpload(file);
      setBild({ vorschauUrl: URL.createObjectURL(file), datei });
    } catch {
      setFehler("Das Foto ließ sich nicht lesen. Versuch es noch einmal.");
    }
  }

  function bildEntfernen() {
    if (bild) URL.revokeObjectURL(bild.vorschauUrl);
    setBild(null);
  }

  async function senden(loesungVerlangt: boolean) {
    const text = input.trim() || (loesungVerlangt ? "Zeig mir die Lösung." : "");
    if (!text && !bild) return;
    if (pending) return;

    setPending(true);
    setFehler(null);
    const eigeneNachricht = text || "(Foto vom Lösungsweg)";
    setMessages((prev) => [
      ...prev,
      { id: `lokal-${Date.now()}`, role: "nutzer", content: eigeneNachricht },
    ]);
    setInput("");
    const gesendetesBild = bild;
    bildEntfernen();
    setStreamText("");

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: aufgabe.taskId,
          bahn,
          message: text,
          loesungVerlangt,
          image: gesendetesBild?.datei ?? null,
        }),
      });

      if (!res.ok || !res.body) {
        const grund = (await res.text().catch(() => "")) || "Der Tutor antwortet gerade nicht.";
        throw new Error(grund);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let voll = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        voll += decoder.decode(value, { stream: true });
        setStreamText(voll);
      }

      setMessages((prev) => [...prev, { id: `tutor-${Date.now()}`, role: "tutor", content: voll }]);

      const neuerStand = await ladeAufgabeStand(aufgabe.taskId);
      if (neuerStand) setStand(neuerStand);
    } catch (problem) {
      setFehler(problem instanceof Error ? problem.message : "Da ging etwas schief.");
    } finally {
      setStreamText("");
      setPending(false);
    }
  }

  if (!available) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          title="Hausaufgabe"
          back={{ href: `/tutor/hausaufgabe/${aufgabe.sessionId}`, label: "Aufgabenliste" }}
        />
        <Notice>{NICHT_EINGERICHTET}</Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-papier border-linie sticky top-0 z-10 -mx-4 -mt-5 flex items-center gap-3 border-b px-4 py-2">
        <Link
          href={`/tutor/hausaufgabe/${aufgabe.sessionId}`}
          className="text-tinte-leise hover:text-koenigsblau -ml-1 inline-flex shrink-0 items-center gap-1 px-1 py-1 text-[0.8125rem] font-medium"
        >
          <span aria-hidden="true">‹</span>
          Aufgabenliste
        </Link>
        <ContextChip subject={aufgabe.subjectName} />
      </div>

      <Block>
        <div className="flex items-baseline gap-2">
          {aufgabe.label ? (
            <span className="text-tinte-leise shrink-0 text-[0.75rem] font-semibold tabular-nums">
              {aufgabe.label}
            </span>
          ) : null}
          <span className="text-tinte text-[0.9375rem]">{aufgabe.prompt}</span>
        </div>
        <span className="text-tinte-leise text-[0.75rem]">
          {STATUS_LABEL[stand.status]} · Versuch {stand.attempts} · Hinweis {stand.hintLevel}/4
        </span>
      </Block>

      {messages.length === 0 && !streamText ? (
        <Notice>
          Erklär, wo du stehst, oder versuch dich schon an der Aufgabe – ein Foto vom Rechenweg geht
          auch.
        </Notice>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`flex flex-col gap-1 ${m.role === "tutor" ? "items-start" : "items-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-[10px] border px-3 py-2 text-sm ${
                  m.role === "tutor"
                    ? "border-linie bg-papier text-tinte"
                    : "border-koenigsblau bg-koenigsblau-hell text-tinte whitespace-pre-wrap"
                }`}
              >
                {m.role === "tutor" ? <TutorMarkdown>{m.content}</TutorMarkdown> : m.content}
              </div>
            </li>
          ))}
          {streamText ? (
            <li className="flex flex-col items-start gap-1">
              <div className="border-linie bg-papier text-tinte max-w-[85%] rounded-[10px] border px-3 py-2 text-sm">
                <span className="whitespace-pre-wrap">
                  {streamText}
                  <span className="text-tinte-leise"> ▍</span>
                </span>
              </div>
            </li>
          ) : null}
        </ol>
      )}

      {fehler ? <Notice>{fehler}</Notice> : null}

      {abgeschlossen ? (
        <Block emphasized title="Aufgabe erledigt">
          <Link
            href={`/tutor/hausaufgabe/${aufgabe.sessionId}`}
            className="bg-koenigsblau text-auf-koenigsblau w-full rounded-[9px] border border-transparent px-4 py-2.5 text-center text-sm font-semibold"
          >
            Zur Aufgabenliste
          </Link>
        </Block>
      ) : (
        <div className="bg-papier border-linie sticky bottom-0 -mx-4 -mb-5 flex flex-col gap-2 border-t px-4 pt-2 pb-3">
          <div className="flex gap-1.5">
            {(
              [
                ["versuch", "Mein Versuch"],
                ["verstehen", "Ich verstehe die Aufgabe nicht"],
              ] as const
            ).map(([wert, label]) => (
              <button
                key={wert}
                type="button"
                onClick={() => setBahn(wert)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-center text-[0.75rem] font-medium ${
                  bahn === wert
                    ? "border-koenigsblau bg-koenigsblau-hell text-koenigsblau"
                    : "border-linie-stark bg-flaeche text-tinte-weich"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {bild ? (
            <div className="border-linie bg-flaeche flex items-center gap-2 rounded-[9px] border p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- Objekt-URL aus lokaler Datei */}
              <img src={bild.vorschauUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
              <span className="text-tinte-leise flex-1 text-[0.75rem]">Foto vom Lösungsweg</span>
              <button
                type="button"
                onClick={bildEntfernen}
                aria-label="Foto entfernen"
                className="text-tinte-leise hover:text-offen px-2 text-sm"
              >
                ✕
              </button>
            </div>
          ) : null}

          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void fotoAusgewaehlt(file);
            }}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void senden(false);
            }}
            className={`${FIELD_RAHMEN} flex items-end gap-1 py-1.5 pr-1.5 pl-3`}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void senden(false);
                }
              }}
              rows={1}
              placeholder={
                bahn === "verstehen" ? "Was genau ist unklar?" : "Dein Rechenweg oder Ergebnis …"
              }
              className="text-tinte placeholder:text-tinte-leise min-h-9 flex-1 resize-none bg-transparent py-1.5 outline-none"
            />
            <button
              type="button"
              onClick={() => fotoRef.current?.click()}
              aria-label="Foto vom Lösungsweg anhängen"
              className="text-tinte-leise hover:bg-papier-tief flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
            >
              📷
            </button>
            <button
              type="submit"
              disabled={pending || (!input.trim() && !bild)}
              aria-label={pending ? "Der Tutor schreibt" : "Senden"}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                !pending && (input.trim() || bild)
                  ? "bg-koenigsblau text-auf-koenigsblau"
                  : "bg-papier-tief text-tinte-leise"
              }`}
            >
              <SendenIcon className={pending ? "animate-pulse" : undefined} />
            </button>
          </form>

          {bahn === "versuch" ? (
            <button
              type="button"
              onClick={() => void senden(true)}
              disabled={pending}
              className="text-tinte-leise hover:text-koenigsblau self-start text-[0.75rem] font-medium disabled:opacity-50"
            >
              Ich komme nicht weiter — zeig mir die Lösung
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
