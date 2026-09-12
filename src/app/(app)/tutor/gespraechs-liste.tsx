"use client";

import Link from "next/link";

import { SwipeRow } from "@/components/shell/swipe-row";

import type { SessionSummary } from "./actions";

/**
 * Die Gesprächszeile und ihre zwei Anordnungen (T-19c, ADR 0014 D3).
 *
 * Zwei Listen zeigen dieselben Gespräche und meinen Verschiedenes:
 *
 * - `/tutor` zeigt **„Zuletzt"** – nach Zeit, flach, sechs Zeilen. Die Frage
 *   dort ist „woran war ich dran", und das ist eine Frage der Zeit.
 * - `/tutor/gespraeche` ist das **Archiv** – nach Fach gruppiert (ADR 0013 D6
 *   gilt dort weiter), mit Suche. Die Frage dort ist „wo war das nochmal",
 *   und dafür ist das Fach die bessere Schublade.
 *
 * Die Zeile selbst ist beide Male dieselbe und steht deshalb hier: Zwei
 * Kopien liefen auseinander, sobald eine angefasst wird – genau das war bei
 * der Chat-Kopfzeile passiert (T-18).
 */

export function GespraechsZeile({
  session,
  onLoeschen,
  /** Das Fach neben dem Datum – nur in der flachen Liste, wo keine Gruppe es schon sagt. */
  zeigeFach = false,
}: {
  session: SessionSummary;
  onLoeschen: (session: SessionSummary) => void;
  zeigeFach?: boolean;
}) {
  return (
    <SwipeRow onDelete={() => onLoeschen(session)}>
      <Link
        href={session.hausaufgabe ? `/tutor/hausaufgabe/${session.id}` : `/tutor/${session.id}`}
        className="border-linie bg-papier hover:bg-papier-tief flex items-center justify-between gap-3 rounded-[9px] border px-3 py-2.5"
      >
        <span className="text-tinte min-w-0 flex-1 truncate text-[0.8125rem]">{session.title}</span>
        <span className="text-tinte-leise flex shrink-0 items-baseline gap-2 text-[0.75rem]">
          {zeigeFach && session.subjectName ? <span>{session.subjectName}</span> : null}
          <span className="tabular-nums">{kurzDatum(session.updatedAt)}</span>
        </span>
      </Link>
    </SwipeRow>
  );
}

/** Die flache, nach Zeit sortierte Liste – „Zuletzt" auf `/tutor`. */
export function NachZeit({
  sessions,
  onLoeschen,
}: {
  sessions: SessionSummary[];
  onLoeschen: (session: SessionSummary) => void;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {sessions.map((s) => (
        <GespraechsZeile key={s.id} session={s} onLoeschen={onLoeschen} zeigeFach />
      ))}
    </ul>
  );
}

/**
 * Die nach Fach gruppierte Liste – das Archiv (§15: „Chatverlauf mit Titeln
 * pro Fach", ADR 0013 D6).
 *
 * Ein Gespräch ohne Fach (ADR 0013 D3) bekommt eine eigene Gruppe am Ende,
 * statt sich unter ein beliebiges Fach zu mischen.
 */
export function NachFach({
  sessions,
  onLoeschen,
}: {
  sessions: SessionSummary[];
  onLoeschen: (session: SessionSummary) => void;
}) {
  const nachFach = new Map<string, SessionSummary[]>();
  const ohneFach: SessionSummary[] = [];
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
      {faecher.map((fach) => (
        <FachGruppe
          key={fach}
          titel={fach}
          sessions={nachFach.get(fach) ?? []}
          onLoeschen={onLoeschen}
        />
      ))}
      {ohneFach.length > 0 ? (
        <FachGruppe titel="Noch nicht einsortiert" sessions={ohneFach} onLoeschen={onLoeschen} />
      ) : null}
    </div>
  );
}

function FachGruppe({
  titel,
  sessions,
  onLoeschen,
}: {
  titel: string;
  sessions: SessionSummary[];
  onLoeschen: (session: SessionSummary) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-tinte-weich text-[0.75rem] font-medium">{titel}</span>
      <ul className="flex flex-col gap-1.5">
        {sessions.map((s) => (
          <GespraechsZeile key={s.id} session={s} onLoeschen={onLoeschen} />
        ))}
      </ul>
    </div>
  );
}

/** `2026-09-10T…` → `10.09.` – im Gespräch zählt der Titel, das Datum ordnet nur ein. */
export function kurzDatum(wert: string): string {
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}
