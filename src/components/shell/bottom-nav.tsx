"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

/**
 * Die fünf Bereiche aus Konzept §5. Immer alle sichtbar – sie soll sehen,
 * was es gibt, statt es zu suchen.
 */
const BEREICHE = [
  { segment: "heute", href: "/heute", label: "Heute" },
  { segment: "faecher", href: "/faecher", label: "Fächer" },
  { segment: "ueben", href: "/ueben", label: "Üben" },
  { segment: "pruefungen", href: "/pruefungen", label: "Prüfungen" },
  { segment: "tutor", href: "/tutor", label: "Tutor" },
] as const;

export function BottomNav() {
  const aktiv = useSelectedLayoutSegment();

  return (
    <nav
      aria-label="Bereiche"
      className="border-linie bg-flaeche sticky bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {BEREICHE.map((b) => {
          const istAktiv = aktiv === b.segment;
          return (
            <li key={b.segment} className="flex-1">
              <Link
                href={b.href}
                aria-current={istAktiv ? "page" : undefined}
                className={`focus-visible:outline-koenigsblau flex flex-col items-center gap-1 px-1 py-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${
                  istAktiv ? "text-koenigsblau font-semibold" : "text-tinte-leise hover:text-tinte"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-0.5 w-6 rounded-full ${istAktiv ? "bg-koenigsblau" : "bg-transparent"}`}
                />
                {b.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
