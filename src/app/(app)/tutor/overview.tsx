"use client";

import Link from "next/link";

import { Block, Notice, PageHeader } from "@/components/shell/primitives";
import type { Auslastung } from "@/lib/ai/rate-limit";

import type { TutorOverview } from "./actions";
import { Conversation } from "./chat";

/**
 * `/tutor` (T-07, umgebaut in T-13): Historie plus der Beginn eines neuen
 * Gesprächs, in einer Komponente.
 *
 * **Kein eigenes Formular mehr** (ADR 0013 D1): Diese Seite rendert einfach
 * `Conversation` mit `sessionId={null}`, `subjectId={null}` – genau dieselbe
 * Komponente wie ein bestehendes Gespräch auf `/tutor/<id>`. Solange nichts
 * geschickt wurde, füllt `leerInhalt` (die Historie hier unten) den Platz,
 * an dem sonst Nachrichten stünden; sobald die erste Frage raus ist, blendet
 * `Conversation` sie automatisch aus (`leer` wird `false`) und zeigt
 * stattdessen die Antwort. Kopfzeile (Rückweg + Fach-Chip) erscheint erst,
 * sobald ein Gespräch existiert – auf dieser Seite gibt es vorher nichts,
 * wohin man „zurück" gehen könnte.
 *
 * Angelegt wird die Session **nicht** hier: Die Zeile in der Datenbank
 * entsteht erst mit der ersten Frage, drüben im Sendeweg. So sammeln sich
 * keine leeren Gespräche an, nur weil jemand einmal geschaut hat.
 */
export function TutorOverviewView({
  overview,
  available,
  auslastung,
}: {
  overview: TutorOverview | null;
  available: boolean;
  auslastung: Auslastung | null;
}) {
  if (!overview) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Tutor" />
        <Block>
          <Notice>Der Tutor ist gerade nicht verfügbar.</Notice>
        </Block>
      </div>
    );
  }

  return (
    <Conversation
      sessionId={null}
      subjectId={null}
      subjectName={null}
      subjectLanguage={null}
      topicTitle={null}
      entryPoint="freie_frage"
      initialMessages={[]}
      available={available}
      auslastung={auslastung}
      alleFaecher={overview.subjects}
      leerInhalt={<Historie sessions={overview.sessions} />}
    />
  );
}

function Historie({ sessions }: { sessions: TutorOverview["sessions"] }) {
  if (sessions.length === 0) {
    return (
      <Notice>Noch keine Gespräche. Schreib einfach los – die erste Frage startet eins.</Notice>
    );
  }

  // Nach Fach gruppieren (§15: „Chatverlauf mit Titeln pro Fach"). Ein
  // Gespräch ohne Fach (ADR 0013 D3, „noch nicht einsortiert") bekommt eine
  // eigene Gruppe am Ende, statt sich unter ein beliebiges Fach zu mischen.
  const nachFach = new Map<string, TutorOverview["sessions"]>();
  const ohneFach: TutorOverview["sessions"] = [];
  for (const s of sessions) {
    if (s.subjectName === null) {
      ohneFach.push(s);
      continue;
    }
    const liste = nachFach.get(s.subjectName) ?? [];
    liste.push(s);
    nachFach.set(s.subjectName, liste);
  }
  const faecher = [...nachFach.keys()].sort((a, b) => a.localeCompare(b, "de"));

  return (
    <div className="flex flex-col gap-3">
      <Ueberschrift>Frühere Gespräche</Ueberschrift>
      {faecher.map((fach) => (
        <FachGruppe key={fach} titel={fach} sessions={nachFach.get(fach) ?? []} />
      ))}
      {ohneFach.length > 0 ? (
        <FachGruppe titel="Noch nicht einsortiert" sessions={ohneFach} />
      ) : null}
    </div>
  );
}

function FachGruppe({ titel, sessions }: { titel: string; sessions: TutorOverview["sessions"] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-tinte-weich text-[0.75rem] font-medium">{titel}</span>
      <ul className="flex flex-col gap-1.5">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              href={s.hausaufgabe ? `/tutor/hausaufgabe/${s.id}` : `/tutor/${s.id}`}
              className="border-linie bg-papier hover:bg-papier-tief flex items-center justify-between gap-3 rounded-[9px] border px-3 py-2.5"
            >
              <span className="text-tinte min-w-0 flex-1 truncate text-[0.8125rem]">{s.title}</span>
              <span className="text-tinte-leise shrink-0 text-[0.75rem] tabular-nums">
                {kurzDatum(s.updatedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
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
