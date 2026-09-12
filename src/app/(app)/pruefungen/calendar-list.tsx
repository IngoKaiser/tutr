"use client";

import { useState, useTransition } from "react";

import { Block, Button, LinkButton, Notice, PageHeader } from "@/components/shell/primitives";
import {
  countdownLabel,
  daysUntil,
  eventTypeLabel,
  splitByHorizon,
  EVENT_TYPE_OPTIONS,
  type CalendarEvent,
} from "@/lib/calendar/upcoming";

import {
  createEvent,
  deleteEvent,
  setEventStatus,
  updateEvent,
  type CalendarSubject,
  type EventInput,
  type EventResult,
} from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

const MINI_BUTTON =
  "border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50";

const QUIET_LINK =
  "text-tinte-leise hover:text-tinte-weich px-2 py-1 text-xs font-medium disabled:opacity-50";

/** `2026-10-09` → `09.10.2026`. Das Datum kommt schon als ISO aus der DB. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Prüfungskalender (K-01, Konzept §6 M7): Termine von Hand.
 *
 * Drei Fenster (`splitByHorizon`): die nächsten vier Wochen zuerst, dann
 * „später im Schuljahr", dann die Historie (vorbei oder abgesagt). Absagen
 * ist ein Statuswechsel, kein Löschen – der Termin rutscht nur in die
 * Historie. Beide Rollen dürfen eintragen (ADR 0004 D4).
 *
 * Ohne Datenbank (`events === null`, CI-E2E) bleibt nur der Hinweis.
 */
export function CalendarList({
  events,
  subjects,
  todayISO,
  canManage,
}: {
  events: CalendarEvent[] | null;
  subjects: CalendarSubject[] | null;
  todayISO: string;
  canManage: boolean;
}) {
  const today = new Date(`${todayISO}T00:00:00Z`);
  const { kommend, spaeter, vergangen } = splitByHorizon(events ?? [], today);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Prüfungen" trailing="nächste 4 Wochen" />

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <CreateEventForm subjects={subjects} />
          <LinkButton href="/pruefungen/einlesen" quiet>
            Klausurplan einlesen
          </LinkButton>
        </div>
      ) : null}

      {events === null ? (
        <Notice>Die Termine sind gerade nicht verfügbar.</Notice>
      ) : events.length === 0 ? (
        <Notice>Noch kein Termin eingetragen.</Notice>
      ) : (
        <>
          <Section
            title="Kommend"
            empty="In den nächsten vier Wochen steht nichts an."
            events={kommend}
            today={today}
            canManage={canManage}
            subjects={subjects}
          />
          {spaeter.length > 0 ? (
            <Section
              title="Später im Schuljahr"
              events={spaeter}
              today={today}
              canManage={canManage}
              subjects={subjects}
            />
          ) : null}
          {vergangen.length > 0 ? (
            <Section
              title="Vergangen & abgesagt"
              events={vergangen}
              today={today}
              canManage={canManage}
              subjects={subjects}
              historie
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  events,
  today,
  canManage,
  subjects,
  historie = false,
}: {
  title: string;
  empty?: string;
  events: CalendarEvent[];
  today: Date;
  canManage: boolean;
  subjects: CalendarSubject[] | null;
  historie?: boolean;
}) {
  return (
    <Block title={title} trailing={events.length > 0 ? String(events.length) : undefined}>
      {events.length === 0 ? (
        empty ? (
          <Notice>{empty}</Notice>
        ) : null
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              today={today}
              canManage={canManage}
              subjects={subjects}
              historie={historie}
            />
          ))}
        </ul>
      )}
    </Block>
  );
}

function EventRow({
  event,
  today,
  canManage,
  subjects,
  historie,
}: {
  event: CalendarEvent;
  today: Date;
  canManage: boolean;
  subjects: CalendarSubject[] | null;
  historie: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const abgesagt = event.status === "abgesagt";
  const tage = daysUntil(event.date, today);

  if (editing && canManage) {
    return (
      <li className="border-koenigsblau bg-koenigsblau-hell rounded-[9px] border px-3 py-2.5">
        <EventForm
          subjects={subjects}
          initial={{
            subjectId: event.subjectId,
            type: event.type,
            title: event.title,
            date: event.date,
          }}
          submitLabel="Speichern"
          action={(input) => updateEvent(event.id, input)}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="border-linie flex flex-col gap-2 rounded-[9px] border px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-tinte block truncate text-[0.8125rem] font-medium">
            {event.title}
            {abgesagt ? <span className="text-tinte-leise font-normal"> · abgesagt</span> : null}
          </span>
          <span className="text-tinte-leise text-[0.75rem]">
            {event.subjectName} · {eventTypeLabel(event.type)} · {formatDate(event.date)}
          </span>
        </div>
        {!abgesagt ? (
          <span className="text-tinte-leise shrink-0 text-[0.75rem] tabular-nums">
            {countdownLabel(tage)}
          </span>
        ) : null}
      </div>

      {canManage && !confirming ? (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setEditing(true)} className={MINI_BUTTON}>
            Bearbeiten
          </button>
          {!historie && !abgesagt ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => setEventStatus(event.id, "abgesagt"))}
              className={MINI_BUTTON}
            >
              Absagen
            </button>
          ) : null}
          {abgesagt ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => setEventStatus(event.id, "geplant"))}
              className={MINI_BUTTON}
            >
              Wieder planen
            </button>
          ) : null}
          <button type="button" onClick={() => setConfirming(true)} className={QUIET_LINK}>
            Löschen
          </button>
        </div>
      ) : null}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-tinte-weich text-xs">Termin ganz entfernen?</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => deleteEvent(event.id))}
            className={MINI_BUTTON}
          >
            {pending ? "…" : "Ja, löschen"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className={QUIET_LINK}
          >
            Abbrechen
          </button>
        </div>
      ) : null}
    </li>
  );
}

function CreateEventForm({ subjects }: { subjects: CalendarSubject[] | null }) {
  const [open, setOpen] = useState(false);

  if (!subjects || subjects.length === 0) {
    return (
      <Notice>
        Lege zuerst unter „Fächer&ldquo; ein Fach im aktuellen Schuljahr an, dann lässt sich ein
        Termin eintragen.
      </Notice>
    );
  }

  if (!open) {
    return (
      <Button quiet onClick={() => setOpen(true)}>
        Termin eintragen
      </Button>
    );
  }

  return (
    <Block title="Neuer Termin">
      <EventForm
        subjects={subjects}
        initial={{ subjectId: subjects[0]!.id, type: "klassenarbeit", title: "", date: "" }}
        submitLabel="Eintragen"
        action={(input) => createEvent(input)}
        onDone={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </Block>
  );
}

function EventForm({
  subjects,
  initial,
  submitLabel,
  action,
  onDone,
  onCancel,
}: {
  subjects: CalendarSubject[] | null;
  initial: EventInput;
  submitLabel: string;
  action: (input: EventInput) => Promise<EventResult | null>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [subjectId, setSubjectId] = useState(initial.subjectId);
  const [type, setType] = useState(initial.type);
  const [title, setTitle] = useState(initial.title);
  const [date, setDate] = useState(initial.date);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setFehler(null);
    if (title.trim().length < 2) {
      setFehler("Bitte einen Titel mit mindestens zwei Zeichen eintragen.");
      return;
    }
    if (!date) {
      setFehler("Bitte ein Datum wählen.");
      return;
    }
    startTransition(async () => {
      const result = await action({ subjectId, type, title: title.trim(), date });
      if (!result || result.ok) {
        onDone();
      } else {
        setFehler(result.fehler);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2.5"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Fach</span>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={FIELD}>
          {(subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Art</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className={FIELD}>
          {EVENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Titel</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z. B. Unité 3 oder Bruchrechnung"
          autoFocus
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Datum</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={FIELD}
        />
      </label>

      {fehler ? <p className="text-offen text-xs">{fehler}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Einen Moment …" : submitLabel}
        </Button>
        <Button quiet type="button" onClick={onCancel} disabled={pending}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
