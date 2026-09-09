"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Block, Button, Notice, PageHeader } from "@/components/shell/primitives";
import { LANGUAGE_OPTIONS, languageLabel } from "@/lib/subjects/languages";

import { createSubject, deleteSubject, updateSubject, type SubjectRow } from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/**
 * Die Fächer des aktiven Schuljahres (F-16a, ADR 0009 D1–D3).
 *
 * Kein „Jahrgang 8 · 8c" mehr, keine erfundenen Themen/Prozentzahlen aus der
 * F-07-Attrappe – die hätten neben echten Fächern genau die Unwahrheit
 * gezeigt, die §15 verbietet. Themen und Fortschritt kommen zurück, wenn
 * F-04e echte Daten liest.
 */
export function SubjectList({
  subjects,
  canManage,
}: {
  subjects: SubjectRow[] | null;
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Fächer" />

      {canManage ? <CreateSubjectForm /> : null}

      {subjects === null ? (
        <Notice>Zahlen sind gerade nicht verfügbar.</Notice>
      ) : subjects.length === 0 ? (
        <Notice>
          {canManage
            ? "Noch keine Fächer für dieses Schuljahr. Leg dein erstes Fach an."
            : "Noch keine Fächer für dieses Schuljahr."}
        </Notice>
      ) : (
        <Block>
          <ul className="flex flex-col gap-2">
            {subjects.map((subject) => (
              <SubjectRowItem key={subject.id} subject={subject} canManage={canManage} />
            ))}
          </ul>
        </Block>
      )}

      <Block title="Vokabeln">
        <Notice>Sets anlegen, Vokabeln einfügen oder von Hand eintragen.</Notice>
        <Link
          href="/faecher/vokabeln"
          className="text-koenigsblau text-[0.8125rem] font-medium underline underline-offset-2"
        >
          Zu den Vokabelsets
        </Link>
      </Block>
    </div>
  );
}

function CreateSubjectForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button quiet onClick={() => setOpen(true)}>
        Neues Fach anlegen
      </Button>
    );
  }

  function submit() {
    if (!name.trim()) return;
    setFehler(null);
    startTransition(async () => {
      const result = await createSubject({ name: name.trim(), language: language || null });
      if (!result) return;
      if (!result.ok) {
        setFehler(result.fehler);
        return;
      }
      setName("");
      setLanguage("");
      setOpen(false);
    });
  }

  return (
    <Block title="Neues Fach">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2.5"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8125rem] font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Englisch oder Geschichte"
            autoFocus
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8125rem] font-medium">Sprache</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={FIELD}>
            <option value="">Kein Sprachfach</option>
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {fehler ? (
          <p role="alert" className="text-offen text-[0.8125rem]">
            {fehler}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Einen Moment …" : "Anlegen"}
          </Button>
          <Button quiet type="button" onClick={() => setOpen(false)} disabled={pending}>
            Abbrechen
          </Button>
        </div>
      </form>
    </Block>
  );
}

function SubjectRowItem({ subject, canManage }: { subject: SubjectRow; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(subject.name);
  const [language, setLanguage] = useState(subject.language ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <li>
        <button
          type="button"
          onClick={() => canManage && setOpen(true)}
          disabled={!canManage}
          className="border-linie bg-papier hover:bg-papier-tief flex w-full items-center justify-between gap-3 rounded-[9px] border px-3 py-2.5 text-left disabled:cursor-default"
        >
          <span className="text-tinte text-[0.8125rem] font-medium">{subject.name}</span>
          {subject.language ? (
            <span className="text-tinte-leise shrink-0 text-[0.6875rem] font-semibold tracking-wide uppercase">
              {languageLabel(subject.language)}
            </span>
          ) : null}
        </button>
      </li>
    );
  }

  function save() {
    setFehler(null);
    startTransition(async () => {
      const result = await updateSubject(subject.id, { name, language: language || null });
      if (!result) return;
      if (!result.ok) {
        setFehler(result.fehler);
        return;
      }
      setOpen(false);
    });
  }

  function remove() {
    setFehler(null);
    startTransition(async () => {
      const result = await deleteSubject(subject.id);
      if (!result) return;
      if (!result.ok) {
        // Der Löschriegel: Erst Themen/Sets entfernen. Bleibt offen, damit
        // die Meldung sichtbar bleibt statt sofort wieder zuzuklappen.
        setFehler(result.fehler);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <li className="border-koenigsblau bg-koenigsblau-hell flex flex-col gap-2 rounded-[9px] border px-3 py-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-tinte-weich text-[0.75rem]">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD} autoFocus />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-tinte-weich text-[0.75rem]">Sprache</span>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className={FIELD}>
          <option value="">Kein Sprachfach</option>
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {fehler ? (
        <p role="alert" className="text-offen text-[0.8125rem]">
          {fehler}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={pending || !name.trim()}>
          {pending ? "…" : "Speichern"}
        </Button>
        <Button
          quiet
          onClick={() => {
            setOpen(false);
            setFehler(null);
          }}
          disabled={pending}
        >
          Abbrechen
        </Button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-tinte-leise hover:text-offen ml-auto text-xs font-medium disabled:opacity-50"
        >
          Fach löschen
        </button>
      </div>
    </li>
  );
}
