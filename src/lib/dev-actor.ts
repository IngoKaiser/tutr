import { cookies } from "next/headers";

import type { Actor } from "@/db/actor";
import { SEED_IDS } from "@/db/seed-ids";

import { DEV_ACTOR_COOKIE, type DevRole } from "./dev-actor-shared";

export { DEV_ACTOR_COOKIE, type DevRole } from "./dev-actor-shared";

/**
 * Zwei getrennte Dinge, die vorher eines waren:
 *
 * 1. **Test-Umgehung** (`TUTR_E2E_ACTOR`): verzichtet auf die Anmeldung.
 *    Ausschließlich für Playwright, bis F-10 die Tests echt anmelden kann.
 *    Zwei Bedingungen müssen zutreffen – nicht Produktion *und* die Variable
 *    gesetzt. In Produktion existiert sie nicht.
 *
 * 2. **Ansichts-Umschalter** (Cookie): setzt eine *echte* Anmeldung voraus
 *    und wechselt nur die Sicht. Ein angemeldetes Elternteil kann so die
 *    Kind-Ansicht der eigenen Familie sehen, solange F-06 fehlt und ein Kind
 *    sich noch gar nicht anmelden kann.
 *
 * Der Unterschied ist wichtig: Die Tür verlangt jetzt auch beim Entwickeln
 * eine Anmeldung. Nur die Rolle dahinter ist wählbar.
 */

function nichtProduktion(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Nur für Playwright. Umgeht die Anmeldung – deshalb doppelt abgesichert. */
export function e2eActor(): Actor | null {
  if (!nichtProduktion()) return null;

  const rolle = process.env.TUTR_E2E_ACTOR;
  if (rolle !== "parent" && rolle !== "student") return null;

  return rolle === "parent"
    ? { role: "parent", familyId: SEED_IDS.familieA, userId: SEED_IDS.elternteilA }
    : { role: "student", familyId: SEED_IDS.familieA, studentId: SEED_IDS.kindA };
}

/** Ist der Ansichts-Umschalter verfügbar? */
export function umschalterVerfuegbar(): boolean {
  return nichtProduktion();
}

/** Welche Ansicht ist gewählt? Ohne Cookie: die eigene Rolle, also Eltern. */
export async function gewaehlteAnsicht(): Promise<DevRole> {
  if (!umschalterVerfuegbar()) return "parent";
  const store = await cookies();
  return store.get(DEV_ACTOR_COOKIE)?.value === "student" ? "student" : "parent";
}
