"use client";

import Link from "next/link";
import { useState } from "react";

import { TutorMarkdown } from "@/components/shell/markdown";
import { Block, ChatKopf, ContextChip, Notice, PageHeader } from "@/components/shell/primitives";
import type { Auslastung } from "@/lib/ai/rate-limit";

import { ladeAuslastung } from "../actions";
import { Composer, type ComposerAnhang } from "../composer";
import { ladeAufgabeStand, type AufgabeDetail } from "./actions";

const NICHT_EINGERICHTET =
  "Der Hausaufgaben-Tutor ist gerade nicht eingerichtet. Deine Vokabeln, Karten und der Prüfungskalender funktionieren weiter.";

const STATUS_LABEL: Record<AufgabeDetail["status"], string> = {
  offen: "offen",
  in_arbeit: "in Arbeit",
  geloest: "gelöst",
  loesung_gezeigt: "Lösung gezeigt",
  uebersprungen: "gehört nicht dazu",
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
  auslastung: anfangsAuslastung,
}: {
  aufgabe: AufgabeDetail;
  available: boolean;
  /** Stand beim Öffnen; der Composer zeigt ihn als Pegel und frischt nach jedem Zug auf (S-03e). */
  auslastung: Auslastung | null;
}) {
  const [messages, setMessages] = useState<Nachricht[]>(aufgabe.messages);
  const [stand, setStand] = useState({
    status: aufgabe.status,
    attempts: aufgabe.attempts,
    hintLevel: aufgabe.hintLevel,
  });
  const [bahn, setBahn] = useState<Bahn>("versuch");
  const [input, setInput] = useState("");
  const [anhang, setAnhang] = useState<ComposerAnhang | null>(null);
  const [auslastung, setAuslastung] = useState(anfangsAuslastung);
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");

  const abgeschlossen = ABGESCHLOSSEN.has(stand.status);

  async function senden(loesungVerlangt: boolean) {
    const text = input.trim() || (loesungVerlangt ? "Zeig mir die Lösung." : "");
    if (!text && !anhang) return;
    if (pending) return;

    setPending(true);
    setFehler(null);
    const eigeneNachricht = text || "(Foto vom Lösungsweg)";
    setMessages((prev) => [
      ...prev,
      { id: `lokal-${Date.now()}`, role: "nutzer", content: eigeneNachricht },
    ]);
    setInput("");
    const gesendetesBild = anhang?.datei ?? null;
    if (anhang) URL.revokeObjectURL(anhang.vorschauUrl);
    setAnhang(null);
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
          image: gesendetesBild,
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
      setAuslastung(await ladeAuslastung());
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
          title="Aufgabe"
          back={{ href: `/tutor/hausaufgabe/${aufgabe.sessionId}`, label: "Aufgabenliste" }}
        />
        <Notice>{NICHT_EINGERICHTET}</Notice>
      </div>
    );
  }

  return (
    // Drei Zonen wie im freien Chat (T-12a): Kopfzeile fest, nur die Mitte
    // scrollt, Eingabefeld fest. `position: sticky` im scrollenden `main`
    // rutschte auf dem iPhone mit nach oben. Zur Höhe siehe `chat.tsx`.
    <div className="flex h-[calc(100cqh-2.5rem)] min-h-0 flex-col">
      {/* Dieselbe Leiste wie im freien Chat (T-18) – sie stand hier zweimal
          fast gleich im Code. */}
      <ChatKopf
        zurueck={{ href: `/tutor/hausaufgabe/${aufgabe.sessionId}`, label: "Aufgabenliste" }}
      >
        <ContextChip subject={aufgabe.subjectName} />
      </ChatKopf>

      {/* Die einzige scrollende Fläche – Aufgabenstellung, Verlauf, Fehler. */}
      {/* `-mx-4 px-4` wie im freien Chat (T-16): Der Scrollbereich reicht bis
          an den Bildschirmrand, sonst zeichnet iOS seine überlagernde
          Bildlaufleiste über die Karten statt daneben. */}
      <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
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
            Erklär, wo du stehst, oder versuch dich schon an der Aufgabe – ein Foto vom Rechenweg
            geht auch.
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
      </div>

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
        <Composer
          wert={input}
          onChange={setInput}
          onSend={() => void senden(false)}
          pending={pending}
          platzhalter={
            bahn === "verstehen" ? "Was genau ist unklar?" : "Dein Rechenweg oder Ergebnis …"
          }
          auslastung={auslastung}
          anhang={anhang}
          onAnhang={setAnhang}
          kinder={
            <div className="flex flex-col gap-2">
              {/* Die zwei Bahnen aus §4a stehen über der Tastenreihe, nicht
                  darin: Sie gehören zur Aufgabe, nicht zum Tippen – und die
                  Wahl gilt für die nächste Nachricht, nicht für den Anhang. */}
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
                    aria-pressed={bahn === wert}
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
          }
        />
      )}
    </div>
  );
}
