"use client";

import Link from "next/link";
import { useState } from "react";

import { Block, Notice, PageHeader } from "@/components/shell/primitives";

import type { TutorOverview } from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/**
 * Die Gesprächsübersicht (T-07) – Ebene 1 des Tutors.
 *
 * Vorher hing die Historie unter dem laufenden Gespräch, wo sie niemand
 * braucht und wo sie den Composer nach unten schob. Jetzt ist sie das, was
 * §15 verlangt: „Chatverlauf mit Titeln pro Fach … Wiedereinstieg in eine
 * alte Session möglich" – und der Ort, an dem ein neues Gespräch beginnt.
 *
 * Angelegt wird ein Gespräch **nicht** hier: `/tutor/neu` trägt Fach und
 * Einstieg in der URL, die Zeile in der Datenbank entsteht erst mit der
 * ersten Frage. So sammeln sich keine leeren Gespräche an, nur weil jemand
 * einmal geschaut hat.
 */
export function TutorOverviewView({ overview }: { overview: TutorOverview | null }) {
  if (!overview) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Tutor" />
        <Notice>Der Tutor ist gerade nicht verfügbar.</Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Tutor" />
      <NeuesGespraech subjects={overview.subjects} />
      <Historie sessions={overview.sessions} />
    </div>
  );
}

function NeuesGespraech({ subjects }: { subjects: TutorOverview["subjects"] }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [entryPoint, setEntryPoint] = useState<"freie_frage" | "verstehen">("freie_frage");

  if (subjects.length === 0) {
    return (
      <Block>
        <Notice>
          Leg zuerst unter „Fächer&ldquo; ein Fach im aktuellen Schuljahr an — der Tutor braucht ein
          Fach, um zu wissen, worüber ihr redet.
        </Notice>
      </Block>
    );
  }

  return (
    <Block title="Neues Gespräch">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Fach</span>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={FIELD}>
          {subjects.map((s) => (
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
              className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-medium ${
                entryPoint === wert
                  ? "border-koenigsblau bg-koenigsblau-hell text-koenigsblau"
                  : "border-linie-stark bg-flaeche text-tinte-weich"
              }`}
            >
              <input
                type="radio"
                name="einstieg"
                value={wert}
                checked={entryPoint === wert}
                onChange={() => setEntryPoint(wert)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <span className="text-tinte-leise text-[0.6875rem]">
          {entryPoint === "verstehen"
            ? "Du hast etwas im Unterricht nicht verstanden — der Tutor fragt nach, wo es hakt."
            : "Stell irgendeine Frage zum Fach."}
        </span>
      </fieldset>

      {/* `URLSearchParams` statt Zusammenkleben: kodiert die Werte, egal was
          im Feld steht. CodeQL hatte die Interpolation zu Recht als
          „DOM text reinterpreted as HTML" markiert – und ein Fach-Name mit
          `&` hätte die URL ohnehin zerlegt. */}
      <Link
        href={`/tutor/neu?${new URLSearchParams({ fach: subjectId, einstieg: entryPoint }).toString()}`}
        className="bg-koenigsblau text-auf-koenigsblau focus-visible:outline-koenigsblau w-full rounded-[9px] border border-transparent px-4 py-2.5 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Gespräch beginnen
      </Link>
    </Block>
  );
}

function Historie({ sessions }: { sessions: TutorOverview["sessions"] }) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Ueberschrift>Frühere Gespräche</Ueberschrift>
        <Notice>Noch keine. Das erste steht oben.</Notice>
      </div>
    );
  }

  // Nach Fach gruppieren (§15: „Chatverlauf mit Titeln pro Fach").
  const nachFach = new Map<string, TutorOverview["sessions"]>();
  for (const s of sessions) {
    const liste = nachFach.get(s.subjectName) ?? [];
    liste.push(s);
    nachFach.set(s.subjectName, liste);
  }
  const faecher = [...nachFach.keys()].sort((a, b) => a.localeCompare(b, "de"));

  return (
    <div className="flex flex-col gap-3">
      <Ueberschrift>Frühere Gespräche</Ueberschrift>
      {faecher.map((fach) => (
        <div key={fach} className="flex flex-col gap-1.5">
          <span className="text-tinte-weich text-[0.75rem] font-medium">{fach}</span>
          <ul className="flex flex-col gap-1.5">
            {(nachFach.get(fach) ?? []).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/tutor/${s.id}`}
                  className="border-linie bg-papier hover:bg-papier-tief flex items-center justify-between gap-3 rounded-[9px] border px-3 py-2.5"
                >
                  <span className="text-tinte min-w-0 flex-1 truncate text-[0.8125rem]">
                    {s.title}
                  </span>
                  <span className="text-tinte-leise shrink-0 text-[0.75rem] tabular-nums">
                    {kurzDatum(s.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Ueberschrift({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-tinte-leise text-[0.6875rem] font-semibold tracking-wider uppercase">
      {children}
    </span>
  );
}

/** `2026-09-10T…` → `10.09.` – im Gespräch zählt der Titel, das Datum ordnet nur ein. */
function kurzDatum(wert: string): string {
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}
