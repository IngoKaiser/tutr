"use client";

import { useRef, useState } from "react";

import { createRecoveryLink } from "./actions";

/**
 * Erzeugt und zeigt einen Wiederherstellungslink (F-06d).
 *
 * Der Link ist bewusst **kein** `<a>` – ein Klick soll ihn kopieren, nicht
 * das Elternteil selbst auf die Einrichtungsseite des Kindes schicken.
 *
 * `navigator.clipboard` braucht einen sicheren Kontext (https oder
 * localhost). Ruft jemand die App über eine bloße IP im lokalen Netz auf,
 * schlägt das *lautlos* fehl, wenn man nicht hinsieht – deshalb der
 * Textauswahl-Rückfall statt eines Hakens, der dann lügen würde.
 */
export function RecoveryLink({ firstName }: { firstName: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "selected" | "error">("idle");
  const linkRef = useRef<HTMLSpanElement>(null);

  async function handleCreate() {
    setCreating(true);
    setCopyState("idle");
    try {
      const url = await createRecoveryLink();
      setLink(url);
      if (!url) setCopyState("error");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
    } catch {
      // Kein sicherer Kontext oder Berechtigung verweigert – dann wenigstens
      // markieren, damit ⌘C/Strg+C funktioniert.
      const range = document.createRange();
      if (linkRef.current) range.selectNodeContents(linkRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setCopyState("selected");
    }
    setTimeout(() => setCopyState("idle"), 4000);
  }

  if (!link) {
    return (
      <button
        type="button"
        onClick={handleCreate}
        disabled={creating}
        className="border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2 text-[0.8125rem] font-medium focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-60"
      >
        {creating ? "Einen Moment …" : "Wiederherstellungslink erzeugen"}
      </button>
    );
  }

  if (copyState === "error") {
    return (
      <p className="text-offen text-[0.8125rem]">
        Der Link ließ sich nicht erzeugen. Bitte versuch es noch einmal.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="border-linie-stark bg-papier flex items-center gap-2 rounded-[9px] border px-3 py-2">
        <span
          ref={linkRef}
          onClick={handleCopy}
          className="text-tinte flex-1 cursor-pointer truncate text-[0.8125rem] underline decoration-dotted underline-offset-2 select-all"
          title="Klicken zum Kopieren"
        >
          {link}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="border-linie-stark bg-flaeche text-tinte-weich hover:text-tinte shrink-0 rounded-md border px-2 py-1 text-xs font-medium"
        >
          {copyState === "copied"
            ? "✓ Kopiert"
            : copyState === "selected"
              ? "Markiert"
              : "Kopieren"}
        </button>
      </div>
      {copyState === "selected" ? (
        <p className="text-offen text-[0.75rem]">Zum Kopieren markiert — ⌘C oder Strg+C.</p>
      ) : (
        <p className="text-tinte-leise text-[0.75rem] leading-normal">
          Wer diesen Link hat, kann sich als {firstName} anmelden. Er gilt zwei Stunden und
          funktioniert einmal.
        </p>
      )}
    </div>
  );
}
