"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Eine Listenzeile, die sich nach links wegwischen lässt und dabei einen
 * „Löschen"-Knopf freilegt (V-11).
 *
 * Wischen ist der schnelle Weg; der freigelegte Knopf ist der verlässliche –
 * er ist ein echtes fokussierbares Ziel, sobald die Zeile offen steht, und
 * bleibt offen, bis er gedrückt oder daneben getippt wird. Ganz weit wischen
 * löscht direkt. Für Tastatur und Maus gibt es zusätzlich den „Löschen"-Knopf
 * im aufgeklappten Bearbeiten-Zustand der Zeile (siehe `vocab-list.tsx`).
 *
 * Kein Gesten-Framework: nur Pointer Events (Maus wie Finger). Eine
 * vertikale Bewegung gilt als Scrollen und bricht das Wischen ab.
 */

/** Ab hier rastet die Zeile offen ein und der Knopf ist sichtbar. */
const RASTET_AB = 64;
/** Ab hier wird beim Loslassen sofort gelöscht. */
const LOEST_AUS_AB = 148;
/** Weiter als so weit lässt sich nicht ziehen (etwas Widerstand am Ende). */
const MAX_ZUG = LOEST_AUS_AB + 32;

export function SwipeRow({
  children,
  onDelete,
  loeschLabel = "Löschen",
  disabled = false,
}: {
  children: ReactNode;
  onDelete: () => void;
  loeschLabel?: string;
  disabled?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [offen, setOffen] = useState(false);
  const [zieht, setZieht] = useState(false);
  const start = useRef<{ x: number; y: number; dx: number } | null>(null);
  const achse = useRef<"?" | "x" | "y">("?");
  const hatBewegt = useRef(false);

  function schliessen() {
    setOffen(false);
    setDx(0);
  }

  function loeschen() {
    schliessen();
    onDelete();
  }

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, dx: offen ? -RASTET_AB : 0 };
    achse.current = "?";
    hatBewegt.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const dX = e.clientX - start.current.x;
    const dY = e.clientY - start.current.y;

    if (achse.current === "?") {
      if (Math.abs(dX) < 6 && Math.abs(dY) < 6) return;
      achse.current = Math.abs(dX) > Math.abs(dY) ? "x" : "y";
      if (achse.current === "y") {
        start.current = null; // vertikal → Scrollen, nicht unsere Sache
        return;
      }
      setZieht(true);
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // jsdom / manche Browser bei synthetischen Events – unkritisch.
      }
    }

    hatBewegt.current = true;
    const roh = dX + start.current.dx;
    setDx(Math.max(Math.min(roh, 0), -MAX_ZUG));
  }

  function onPointerUp() {
    if (!start.current) {
      setZieht(false);
      return;
    }
    start.current = null;
    setZieht(false);
    if (-dx >= LOEST_AUS_AB) {
      loeschen();
      return;
    }
    if (-dx >= RASTET_AB) {
      setOffen(true);
      setDx(-RASTET_AB);
      return;
    }
    schliessen();
  }

  return (
    <li className="relative overflow-hidden rounded-[9px]">
      {/* Roter Grund samt Knopf, liegt hinter der Zeile. */}
      <div className="bg-offen absolute inset-y-0 right-0 flex items-stretch">
        <button
          type="button"
          onClick={loeschen}
          tabIndex={offen ? 0 : -1}
          aria-hidden={!offen}
          className="text-flaeche focus-visible:outline-flaeche px-4 text-[0.8125rem] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          {loeschLabel}
        </button>
      </div>

      {/* Die eigentliche Zeile, verschiebbar. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={schliessen}
        // Ein Klick nach echtem Ziehen darf nicht als Tippen durchgehen
        // (sonst klappt die Zeile beim Wischen auf).
        onClickCapture={(e) => {
          if (hatBewegt.current) {
            e.preventDefault();
            e.stopPropagation();
            hatBewegt.current = false;
          }
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: zieht ? "none" : "transform .18s ease",
          touchAction: "pan-y",
        }}
        className="bg-papier relative"
      >
        {children}
      </div>
    </li>
  );
}

/**
 * Rückgängig-Leiste zu eben gelöschten Zeilen (V-11) – der sichtbare Teil
 * des Fensters aus `useDeferredDelete`. Eine Zeile je schwebender Löschung.
 */
export function UndoLoeschen({
  eintraege,
  onZurueck,
}: {
  eintraege: { id: string; label: string }[];
  onZurueck: (id: string) => void;
}) {
  if (eintraege.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {eintraege.map((e) => (
        <div
          key={e.id}
          className="border-linie bg-papier-tief flex items-center justify-between gap-3 rounded-[9px] border px-3 py-2 text-[0.8125rem]"
        >
          <span className="text-tinte-leise truncate">„{e.label}“ gelöscht</span>
          <button
            type="button"
            onClick={() => onZurueck(e.id)}
            className="text-koenigsblau shrink-0 font-medium underline underline-offset-2"
          >
            Rückgängig
          </button>
        </div>
      ))}
    </div>
  );
}
