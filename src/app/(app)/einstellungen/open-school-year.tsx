"use client";

import { useState, useTransition } from "react";

import { suggestNextSchoolYear } from "@/lib/school-year/rollover";

import { startNewSchoolYear, type ActiveSchoolYear } from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/**
 * Manuelle Eröffnung eines neuen Schuljahres (F-16b).
 *
 * Nur der manuelle Teil des §9-Sommer-Assistenten – keine automatische
 * Erinnerung nahe Schuljahresende (F-16c). Die Vorschlagswerte (Jahrgang +1,
 * Klasse unverändert) kommen aus `rollover.ts`, damit Formular und ein
 * künftiger automatischer Hinweis (F-16c) denselben Vorschlag rechnen.
 *
 * Fächer werden bewusst nicht mitgenommen (ADR 0009 D2) – ein Hinweis dazu
 * steht im Text, nicht nur in einem Commit-Kommentar.
 */
export function OpenSchoolYear({ current }: { current: ActiveSchoolYear }) {
  const suggestion = suggestNextSchoolYear(current);
  const [open, setOpen] = useState(false);
  const [gradeLevel, setGradeLevel] = useState(suggestion.gradeLevel);
  const [className, setClassName] = useState(suggestion.className ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startAction] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief focus-visible:outline-koenigsblau self-start rounded-md border px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
      >
        Neues Schuljahr eröffnen
      </button>
    );
  }

  function save() {
    setError(null);
    startAction(async () => {
      const result = await startNewSchoolYear({ gradeLevel, className });
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <div className="border-linie flex flex-col gap-3 rounded-[9px] border px-3 py-2.5">
      <p className="text-tinte-weich text-[0.8125rem] leading-relaxed">
        {`${current.label} wird archiviert, ${suggestion.label} wird das neue aktive Schuljahr. Fächer wählt sie danach neu unter „Fächer" – Vokabelstand und Lernfortschritt bleiben unabhängig davon erhalten.`}
      </p>

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
          placeholder="z. B. 9b"
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
          {pending ? "Wird eröffnet …" : `${suggestion.label} eröffnen`}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="text-tinte-leise hover:text-tinte-weich px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
