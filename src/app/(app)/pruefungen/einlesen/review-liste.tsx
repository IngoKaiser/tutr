"use client";

import { useEffect, useMemo, useState } from "react";

import { Block, Button, LinkButton, Notice, PageHeader } from "@/components/shell/primitives";
import { matchesOwnGroups, suggestOwnGroups } from "@/lib/calendar/group-match";
import type { CalendarImportDraft } from "@/lib/calendar/import-draft";
import { matchReimport, type ReimportCandidate } from "@/lib/calendar/reimport-match";
import { eventTypeLabel, type CalendarEventType } from "@/lib/calendar/upcoming";
import { loeseFachZuordnungAuf } from "@/lib/tutor/fach-zuordnung";

import { setEventStatus } from "../actions";
import {
  ladeReviewKontext,
  speichereEigeneGruppen,
  uebernehmen,
  type ReviewKontext,
} from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte rounded-md border px-2 py-1.5 text-[0.8125rem]";
const MINI_BUTTON =
  "border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50";

/** `2026-10-09` → `09.10.2026`. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

type EingeordneteZeile = {
  index: number;
  draft: CalendarImportDraft;
  subjectId: string | null;
  zeigenProminent: boolean;
  bucket: "neu" | "verschoben" | "unveraendert";
  altesDatum: string | null;
  matchedId: string | null;
};

/**
 * Review-Screen des Kalender-Imports (K-03, in K-02c aufgegangen, ADR 0016
 * D2/D3/D7/D8). Kein Schreiben ohne „Übernehmen" – bis dahin lebt alles hier
 * in React-State.
 */
export function ReviewListe({ drafts }: { drafts: CalendarImportDraft[] }) {
  const [kontext, setKontext] = useState<ReviewKontext | null | "laedt">("laedt");
  const [ownGroupsEntwurf, setOwnGroupsEntwurf] = useState<Record<string, boolean>>({});
  const [ownGroupsBestaetigt, setOwnGroupsBestaetigt] = useState<string[] | null>(null);
  const [ausgewaehlt, setAusgewaehlt] = useState<Record<number, boolean>>({});
  const [fachUeberschreibung, setFachUeberschreibung] = useState<Record<number, string>>({});
  const [entfalleneStatus, setEntfalleneStatus] = useState<Record<string, "abgesagt">>({});
  const [wirdUebernommen, setWirdUebernommen] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ angelegt: number; aktualisiert: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    void ladeReviewKontext().then(setKontext);
  }, []);

  const blocker = useMemo(() => drafts.filter((d) => d.type === "blocker"), [drafts]);
  const normal = useMemo(() => drafts.filter((d) => d.type !== "blocker"), [drafts]);

  const alleTokens = useMemo(() => [...new Set(normal.flatMap((d) => d.groups))], [normal]);

  const ownGroups =
    ownGroupsBestaetigt ?? (kontext && kontext !== "laedt" ? kontext.ownGroups : null);
  const brauchtEinrichtung = ownGroups === null && alleTokens.length > 0;

  const zeilen = useMemo((): EingeordneteZeile[] => {
    if (!kontext || kontext === "laedt" || brauchtEinrichtung) return [];

    const mitIndex = normal.map((draft, index) => ({ draft, index }));
    const kandidaten: { index: number; subjectId: string; candidate: ReimportCandidate }[] = [];
    for (const { draft, index } of mitIndex) {
      const treffer =
        draft.subjectGuess && draft.subjectGuess !== "unklar"
          ? loeseFachZuordnungAuf(draft.subjectGuess, kontext.subjects)
          : null;
      if (treffer) {
        kandidaten.push({
          index,
          subjectId: treffer.id,
          candidate: {
            subjectId: treffer.id,
            groups: draft.groups,
            date: draft.date,
            title: draft.title,
          },
        });
      }
    }

    const reimport = matchReimport(
      kontext.existingEvents,
      kandidaten.map((k) => k.candidate),
    );

    const ergebnisNachIndex = new Map(
      kandidaten.map((k, i) => [k.index, { subjectId: k.subjectId, match: reimport.drafts[i]! }]),
    );

    return mitIndex.map(({ draft, index }) => {
      const eintrag = ergebnisNachIndex.get(index);
      const groupMatch = ownGroups ? matchesOwnGroups(draft.groups, ownGroups) : true;
      const bucket = eintrag?.match.bucket ?? "neu";
      return {
        index,
        draft,
        subjectId: eintrag?.subjectId ?? null,
        zeigenProminent: draft.relevant && groupMatch,
        bucket,
        altesDatum:
          bucket === "verschoben"
            ? (kontext.existingEvents.find((e) => e.id === eintrag?.match.matchedId)?.date ?? null)
            : null,
        matchedId: eintrag?.match.matchedId ?? null,
      };
    });
  }, [kontext, brauchtEinrichtung, normal, ownGroups]);

  const entfallen = useMemo(() => {
    if (!kontext || kontext === "laedt" || brauchtEinrichtung) return [];
    const genutzt = new Set(
      zeilen.map((z) => z.matchedId).filter((id): id is string => id !== null),
    );
    return kontext.existingEvents.filter((e) => !genutzt.has(e.id));
  }, [kontext, brauchtEinrichtung, zeilen]);

  const neuUndVerschoben = zeilen.filter((z) => z.bucket !== "unveraendert");
  const unveraendertAnzahl = zeilen.filter((z) => z.bucket === "unveraendert").length;
  const prominent = neuUndVerschoben.filter((z) => z.zeigenProminent);
  const andere = neuUndVerschoben.filter((z) => !z.zeigenProminent);

  function gruppenTokenUmschalten(token: string) {
    setOwnGroupsEntwurf((prev) => ({ ...prev, [token]: !(prev[token] ?? vorausgewaehlt(token)) }));
  }

  function vorausgewaehlt(token: string): boolean {
    if (!kontext || kontext === "laedt") return false;
    return suggestOwnGroups(alleTokens, kontext.className).includes(token);
  }

  async function gruppenEinrichtungSpeichern() {
    const gewaehlt = alleTokens.filter((t) => ownGroupsEntwurf[t] ?? vorausgewaehlt(t));
    await speichereEigeneGruppen(gewaehlt);
    setOwnGroupsBestaetigt(gewaehlt);
  }

  async function absagen(eventId: string) {
    await setEventStatus(eventId, "abgesagt");
    setEntfalleneStatus((prev) => ({ ...prev, [eventId]: "abgesagt" }));
  }

  async function uebernehmenKlick() {
    setFehler(null);
    setWirdUebernommen(true);
    const neu = neuUndVerschoben
      .filter((z) => z.bucket === "neu" && (ausgewaehlt[z.index] ?? z.zeigenProminent))
      .map((z) => ({
        subjectId: fachUeberschreibung[z.index] ?? z.subjectId ?? "",
        type: z.draft.type as CalendarEventType,
        title: z.draft.title,
        date: z.draft.date,
        groups: z.draft.groups,
      }));
    const verschoben = neuUndVerschoben
      .filter((z) => z.bucket === "verschoben" && (ausgewaehlt[z.index] ?? z.zeigenProminent))
      .map((z) => ({ eventId: z.matchedId!, date: z.draft.date }));

    const result = await uebernehmen({ neu, verschoben });
    setWirdUebernommen(false);
    if (!result) {
      setFehler("Dafür fehlt die Berechtigung.");
      return;
    }
    if (!result.ok) {
      setFehler(result.fehler);
      return;
    }
    setErgebnis({ angelegt: result.angelegt, aktualisiert: result.aktualisiert });
  }

  if (kontext === "laedt") {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Übersicht" back={{ href: "/pruefungen", label: "Prüfungen" }} />
        <Notice>Wird geladen …</Notice>
      </div>
    );
  }
  if (!kontext) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Übersicht" back={{ href: "/pruefungen", label: "Prüfungen" }} />
        <Notice>Für dieses Konto fehlt noch ein Schuljahr.</Notice>
      </div>
    );
  }

  if (ergebnis) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Übersicht" back={{ href: "/pruefungen", label: "Prüfungen" }} />
        <Notice>
          {ergebnis.angelegt} {ergebnis.angelegt === 1 ? "Termin" : "Termine"} angelegt
          {ergebnis.aktualisiert > 0
            ? `, ${ergebnis.aktualisiert} ${ergebnis.aktualisiert === 1 ? "Termin" : "Termine"} verschoben`
            : ""}
          .
        </Notice>
        <LinkButton href="/pruefungen">Zu den Prüfungen</LinkButton>
      </div>
    );
  }

  if (brauchtEinrichtung) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          title="Welche Zeilen betreffen dich?"
          back={{ href: "/pruefungen", label: "Prüfungen" }}
        />
        <Block title="Eigene Klasse/Kurse">
          <Notice>
            Der Plan nennt mehrere Klassen. Häk an, was zu dir gehört – auch mehrere, wenn du in
            einem Fach in einem eigenen Kurs bist (z.&nbsp;B. „8.5 Eng&ldquo;). Das merkt sich tutr
            für künftige Importe.
          </Notice>
          <ul className="flex flex-col gap-1.5">
            {alleTokens.map((token) => (
              <li key={token}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ownGroupsEntwurf[token] ?? vorausgewaehlt(token)}
                    onChange={() => gruppenTokenUmschalten(token)}
                  />
                  {token}
                </label>
              </li>
            ))}
          </ul>
          <Button onClick={() => void gruppenEinrichtungSpeichern()}>Weiter</Button>
        </Block>
      </div>
    );
  }

  const angehaktOhneFach = prominent
    .concat(andere)
    .filter(
      (z) =>
        z.bucket === "neu" &&
        (ausgewaehlt[z.index] ?? z.zeigenProminent) &&
        !(fachUeberschreibung[z.index] ?? z.subjectId),
    );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Übersicht" back={{ href: "/pruefungen", label: "Prüfungen" }} />

      {prominent.length === 0 && andere.length === 0 && unveraendertAnzahl === 0 ? (
        <Notice>Keine Termine erkannt.</Notice>
      ) : null}

      {prominent.length > 0 ? (
        <Block title="Neu bzw. verschoben">
          <ul className="flex flex-col gap-2">
            {prominent.map((z) => (
              <ZeilenEintrag
                key={z.index}
                zeile={z}
                kontext={kontext}
                checked={ausgewaehlt[z.index] ?? z.zeigenProminent}
                onCheckedChange={(v) => setAusgewaehlt((prev) => ({ ...prev, [z.index]: v }))}
                subjectId={fachUeberschreibung[z.index] ?? z.subjectId ?? ""}
                onSubjectChange={(v) =>
                  setFachUeberschreibung((prev) => ({ ...prev, [z.index]: v }))
                }
              />
            ))}
          </ul>
        </Block>
      ) : null}

      {unveraendertAnzahl > 0 ? (
        <Notice>
          {unveraendertAnzahl} {unveraendertAnzahl === 1 ? "Termin steht" : "Termine stehen"} schon
          unverändert im Kalender.
        </Notice>
      ) : null}

      {entfallen.length > 0 ? (
        <Block title="Im neuen Plan nicht mehr dabei">
          <ul className="flex flex-col gap-2">
            {entfallen.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {e.title} ({formatDate(e.date)})
                </span>
                {entfalleneStatus[e.id] ? (
                  <span className="text-tinte-leise text-xs">Abgesagt</span>
                ) : (
                  <button type="button" className={MINI_BUTTON} onClick={() => void absagen(e.id)}>
                    Termin absagen
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {andere.length > 0 ? (
        <details>
          <summary className="text-tinte-leise cursor-pointer text-xs">
            {andere.length} weitere, vermutlich nicht relevante{" "}
            {andere.length === 1 ? "Zeile" : "Zeilen"} anzeigen
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {andere.map((z) => (
              <ZeilenEintrag
                key={z.index}
                zeile={z}
                kontext={kontext}
                checked={ausgewaehlt[z.index] ?? false}
                onCheckedChange={(v) => setAusgewaehlt((prev) => ({ ...prev, [z.index]: v }))}
                subjectId={fachUeberschreibung[z.index] ?? z.subjectId ?? ""}
                onSubjectChange={(v) =>
                  setFachUeberschreibung((prev) => ({ ...prev, [z.index]: v }))
                }
              />
            ))}
          </ul>
        </details>
      ) : null}

      {blocker.length > 0 ? (
        <Notice>
          Ferien/Fahrten in diesem Plan (werden nicht gespeichert):{" "}
          {blocker.map((b) => `${b.title} (${formatDate(b.date)})`).join(", ")}
        </Notice>
      ) : null}

      {fehler ? <Notice>{fehler}</Notice> : null}
      {angehaktOhneFach.length > 0 ? (
        <Notice>Bei {angehaktOhneFach.length} angehakten Zeilen fehlt noch ein Fach.</Notice>
      ) : null}

      <Button
        onClick={() => void uebernehmenKlick()}
        disabled={wirdUebernommen || angehaktOhneFach.length > 0}
      >
        {wirdUebernommen ? "Wird übernommen …" : "Übernehmen"}
      </Button>
    </div>
  );
}

function ZeilenEintrag({
  zeile,
  kontext,
  checked,
  onCheckedChange,
  subjectId,
  onSubjectChange,
}: {
  zeile: EingeordneteZeile;
  kontext: ReviewKontext;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  subjectId: string;
  onSubjectChange: (subjectId: string) => void;
}) {
  const { draft } = zeile;
  return (
    <li className="border-linie bg-flaeche flex flex-col gap-1.5 rounded-[9px] border p-2.5">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="text-tinte text-[0.8125rem] font-medium">
            {draft.displayName ?? draft.title}
          </div>
          <div className="text-tinte-leise text-[0.75rem]">
            {eventTypeLabel(draft.type as CalendarEventType)} ·{" "}
            {zeile.bucket === "verschoben" && zeile.altesDatum
              ? `${formatDate(zeile.altesDatum)} → ${formatDate(draft.date)}`
              : formatDate(draft.date)}
            {draft.confidence === "niedrig" ? " · unsicher erkannt" : ""}
          </div>
          {draft.note ? <div className="text-tinte-leise text-[0.75rem]">{draft.note}</div> : null}
        </div>
      </div>
      <select
        className={FIELD}
        value={subjectId}
        onChange={(e) => onSubjectChange(e.target.value)}
        disabled={zeile.bucket === "verschoben"}
      >
        <option value="">Fach wählen</option>
        {kontext.subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </li>
  );
}
