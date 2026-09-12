"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { initialsFromLabel } from "@/lib/format/initials";

/**
 * Kontomenü hinter einem Avatar (F-15).
 *
 * Vorher standen „Einstellungen", die E-Mail-Adresse und „Abmelden" als drei
 * einzelne Elemente nebeneinander im Kopfbereich – auf dem Handy schmal, und
 * jeder weitere Eintrag hätte es enger gemacht. Ein Avatar mit Menü ist der
 * übliche Weg, das zu bündeln.
 *
 * Initiale statt Foto: Ein Bild widerspräche der Pseudonymität des
 * Kind-Profils (§11). Dieselbe Menü-Mechanik wie beim Fach-Chip im Tutor
 * (`chat.tsx`, `FachChip`) – `useState` + ein `mousedown`-Listener aufs
 * Dokument, kein eigenes Popover-Paket.
 */
export function AccountMenu({
  label,
  email,
  logout,
}: {
  /** Vorname (Kind) oder E-Mail-Adresse (Elternteil) – ergibt die Initiale. */
  label: string;
  /** Nur Eltern haben eine, ein Kind meldet sich nie über Supabase an. */
  email?: string | null;
  logout: () => Promise<void>;
}) {
  const [offen, setOffen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [offen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-label="Kontomenü öffnen"
        aria-expanded={offen}
        className="bg-koenigsblau focus-visible:outline-koenigsblau flex size-8 items-center justify-center rounded-full text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {initialsFromLabel(label)}
      </button>

      {offen ? (
        <div className="border-linie-stark bg-flaeche absolute top-10 right-0 z-20 flex w-48 flex-col overflow-hidden rounded-[10px] border shadow-lg">
          {email ? (
            <span
              className="text-tinte-leise border-linie truncate border-b px-3 py-2 text-xs"
              title={email}
            >
              {email}
            </span>
          ) : null}
          <Link
            href="/einstellungen"
            onClick={() => setOffen(false)}
            className="text-tinte hover:bg-papier-tief px-3 py-2 text-left text-[0.8125rem]"
          >
            Einstellungen
          </Link>
          <form action={logout} className="contents">
            <button
              type="submit"
              className="text-tinte hover:bg-papier-tief border-linie border-t px-3 py-2 text-left text-[0.8125rem]"
            >
              Abmelden
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
