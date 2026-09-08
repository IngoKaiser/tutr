"use client";

import { useState, useTransition } from "react";

/**
 * Zweistufige Bestätigung, kein Eintippen (ADR 0006, Entscheidung im F-06e-
 * Planungsgespräch): Anders als beim Löschen eines Kindes gehen dabei keine
 * Lerndaten verloren – die Kinder bleiben unberührt –, und der Vorgang ist
 * umkehrbar: Bei erneuter Anmeldung mit derselben Adresse entsteht das Konto
 * über den Beitritt automatisch neu, sofern ein Kind diese Adresse weiter
 * einträgt.
 */
export function DeleteParentAccount({ action }: { action: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startAction] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="border-linie-stark bg-flaeche text-tinte-weich hover:text-tinte focus-visible:outline-koenigsblau rounded-md border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
      >
        Elternkonto löschen
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-tinte-weich text-[0.8125rem]">Wirklich löschen?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startAction(action)}
        className="border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief focus-visible:outline-koenigsblau rounded-md border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-50"
      >
        {pending ? "Wird gelöscht …" : "Ja, löschen"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-tinte-leise hover:text-tinte-weich px-2.5 py-1 text-xs font-medium disabled:opacity-50"
      >
        Abbrechen
      </button>
    </div>
  );
}
