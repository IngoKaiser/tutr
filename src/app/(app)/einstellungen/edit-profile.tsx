"use client";

import { useState, useTransition } from "react";

import { updateOwnProfile, type OwnProfile } from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/**
 * Vorname, Jahrgang, Klasse selbst ändern (F-06c). Bis hierher konnte nur
 * ein Elternteil das Profil korrigieren – ein Kind ohne Elternkonto (ADR
 * 0006 D1) hatte keinen Weg, einen Tippfehler im eigenen Vornamen loszuwerden.
 *
 * Dieselbe „erst ansehen, dann bearbeiten"-Form wie `DeleteChild`, aber ohne
 * Bestätigungsschritt – das hier ist reversibel, ein falscher Jahrgang ist
 * kein Datenverlust.
 */
export function EditProfile({ profile }: { profile: OwnProfile }) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [gradeLevel, setGradeLevel] = useState(profile.gradeLevel);
  const [className, setClassName] = useState(profile.className ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startAction] = useTransition();

  function cancel() {
    setFirstName(profile.firstName);
    setGradeLevel(profile.gradeLevel);
    setClassName(profile.className ?? "");
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    startAction(async () => {
      const result = await updateOwnProfile({ firstName, gradeLevel, className });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        <dl className="text-[0.8125rem]">
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-tinte-leise">Vorname</dt>
            <dd className="text-tinte font-medium">{profile.firstName}</dd>
          </div>
          <div className="border-linie flex justify-between gap-3 border-t py-1">
            <dt className="text-tinte-leise">Jahrgang</dt>
            <dd className="text-tinte font-medium">{profile.gradeLevel}</dd>
          </div>
          <div className="border-linie flex justify-between gap-3 border-t py-1">
            <dt className="text-tinte-leise">Klasse</dt>
            <dd className="text-tinte font-medium">{profile.className ?? "–"}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief focus-visible:outline-koenigsblau self-start rounded-md border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
        >
          Bearbeiten
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Vorname</span>
        <input
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          autoFocus
          maxLength={40}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Jahrgang</span>
        <select
          value={gradeLevel}
          onChange={(event) => setGradeLevel(Number(event.target.value))}
          className={FIELD}
        >
          {Array.from({ length: 9 }, (_, i) => i + 5).map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Klasse (optional)</span>
        <input
          value={className}
          onChange={(event) => setClassName(event.target.value)}
          maxLength={20}
          placeholder="z. B. 8b"
          className={FIELD}
        />
      </label>

      {error ? <p className="text-offen text-[0.8125rem]">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief focus-visible:outline-koenigsblau rounded-md border px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-60"
        >
          {pending ? "Wird gespeichert …" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="text-tinte-leise hover:text-tinte-weich px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
