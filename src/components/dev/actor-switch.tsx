"use client";

import { useTransition } from "react";

import { setDevRole } from "@/lib/dev-actor-action";
import type { DevRole } from "@/lib/dev-actor-shared";

/**
 * Nur in der Entwicklung sichtbar (das Layout rendert die Komponente in
 * Produktion gar nicht erst). Steht bis F-05/F-06 stellvertretend für die
 * Anmeldung: Die Shell muss wissen, ob Elternteil oder Kind davorsitzt.
 */
export function ActorSwitch({ aktuell }: { aktuell: DevRole }) {
  const [wechselt, starteWechsel] = useTransition();

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-tinte-leise">Dev-Ansicht</span>
      <div
        role="group"
        aria-label="Rolle für die Entwicklung"
        className="border-linie-stark flex overflow-hidden rounded-md border"
      >
        {(["student", "parent"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => starteWechsel(() => setDevRole(r))}
            aria-pressed={aktuell === r}
            disabled={wechselt}
            className={`focus-visible:outline-koenigsblau px-2.5 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${
              aktuell === r
                ? "bg-koenigsblau text-auf-koenigsblau"
                : "text-tinte-weich hover:text-tinte bg-transparent"
            }`}
          >
            {r === "student" ? "Kind" : "Eltern"}
          </button>
        ))}
      </div>
    </div>
  );
}
