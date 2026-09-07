import { cookies } from "next/headers";

import type { Actor } from "@/db/actor";
import { SEED_IDS, SEED_PARENT_EMAIL } from "@/db/seed-ids";
import type { ParentLogin } from "@/lib/auth/onboarding";

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
 *    Kind-Ansicht eines verknüpften Kindes sehen, ohne sich als dieses Kind
 *    anmelden zu müssen.
 *
 * Der Unterschied ist wichtig: Die Tür verlangt jetzt auch beim Entwickeln
 * eine Anmeldung. Nur die Rolle dahinter ist wählbar.
 */

function notProduction(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Nur für Playwright. Umgeht die Anmeldung – deshalb doppelt abgesichert. */
export function e2eActor(): Actor | null {
  if (!notProduction()) return null;

  const role = process.env.TUTR_E2E_ACTOR;
  if (role !== "parent" && role !== "student") return null;

  return role === "parent"
    ? { role: "parent", parentId: SEED_IDS.parentOne, studentId: SEED_IDS.studentOne }
    : { role: "student", studentId: SEED_IDS.studentOne };
}

/**
 * Das Gegenstück zu `e2eActor()` für die Eltern-Rolle: die Kindliste, die
 * `loginStatus()` sonst über `joinOrLogin()` aus der Datenbank läse. Ohne
 * das bliebe `login` in jedem Playwright-Lauf `null` – der Kind-Umschalter
 * und die Einstellungsseite (F-06b) brauchen ihn aber, um zu prüfen, was
 * bei mehr als einem Kind passiert. Spiegelt exakt, was `npm run db:seed`
 * anlegt (Mia und Ben, ein gemeinsames Elternkonto).
 */
export function e2eLogin(): ParentLogin | null {
  if (!e2eActor()) return null;
  return {
    parentId: SEED_IDS.parentOne,
    email: SEED_PARENT_EMAIL,
    students: [
      { id: SEED_IDS.siblingOne, firstName: "Ben" },
      { id: SEED_IDS.studentOne, firstName: "Mia" },
    ],
  };
}

/** Ist der Ansichts-Umschalter verfügbar? */
export function switcherAvailable(): boolean {
  return notProduction();
}

/** Welche Ansicht ist gewählt? Ohne Cookie: die eigene Rolle, also Eltern. */
export async function activeView(): Promise<DevRole> {
  if (!switcherAvailable()) return "parent";
  const store = await cookies();
  return store.get(DEV_ACTOR_COOKIE)?.value === "student" ? "student" : "parent";
}
