"use client";

import { useState, useTransition } from "react";

/**
 * Bestätigung durch Eintippen des Vornamens (ADR 0006 D5) – für beide Wege,
 * bei denen ein Kind-Konto verschwindet: „Elternteil löscht Kind" und „Kind
 * löscht sich selbst" (F-06e). Nicht für „Elternkonto löschen" – dafür gibt
 * es `DeleteParentAccount`, mit einer leichteren Bestätigung, weil dabei
 * keine Lerndaten verloren gehen.
 *
 * Kein `bg-offen`-Warnknopf: tutr verzichtet bewusst auf Dringlichkeits- und
 * Signalfarben (`globals.css`, „Kein Rot"). Das Gewicht trägt der Text und
 * der Zwischenschritt, nicht die Farbe des Knopfs.
 */
export function DeleteChild({
  firstName,
  buttonLabel,
  warning,
  action,
}: {
  firstName: string;
  buttonLabel: string;
  warning: string;
  action: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startAction] = useTransition();
  const match = typed.trim() === firstName;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-linie-stark bg-flaeche text-tinte-weich hover:text-tinte focus-visible:outline-koenigsblau rounded-md border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="border-offen flex flex-col gap-2 rounded-[9px] border px-3 py-2.5">
      <p className="text-tinte-weich text-[0.8125rem] leading-relaxed">{warning}</p>
      <label className="flex flex-col gap-1">
        <span className="text-tinte-leise text-[0.75rem]">{`Zum Bestätigen „${firstName}" eintippen:`}</span>
        <input
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className="border-linie-stark bg-flaeche text-tinte focus-visible:outline-koenigsblau rounded-md border px-2.5 py-1.5 text-[0.8125rem] focus-visible:outline-2 focus-visible:outline-offset-1"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!match || pending}
          onClick={() => startAction(action)}
          className="border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief focus-visible:outline-koenigsblau rounded-md border px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-50"
        >
          {pending ? "Wird gelöscht …" : buttonLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          disabled={pending}
          className="text-tinte-leise hover:text-tinte-weich px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
