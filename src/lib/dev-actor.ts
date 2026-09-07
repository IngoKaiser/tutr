import { cookies } from "next/headers";

import type { Actor } from "@/db/actor";
import { SEED_IDS } from "@/db/seed-ids";
import { DEV_ACTOR_COOKIE, type DevRole } from "./dev-actor-shared";

/**
 * Platzhalter-Actor für die Entwicklung, bis F-05 (Auth Eltern) und F-06
 * (Auth Kind) echte Sessions liefern.
 *
 * Die App-Shell muss wissen, *ob* gerade ein Elternteil oder ein Kind vor ihr
 * sitzt – nicht, *wie* es sich angemeldet hat. Genau diese Lücke füllt der
 * Dev-Actor, und nur sie.
 *
 * Sicherheitsgrenze: In Produktion gibt es ihn nicht. `devActorEnabled()` ist
 * die einzige Stelle, die das entscheidet, und sie prüft `NODE_ENV` – kein
 * Feature-Flag, kein Cookie, nichts, was sich von außen setzen ließe.
 */

export { DEV_ACTOR_COOKIE, type DevRole } from "./dev-actor-shared";

export function devActorEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function actorFor(rolle: DevRole): Actor {
  return rolle === "parent"
    ? { role: "parent", familyId: SEED_IDS.familieA, userId: SEED_IDS.elternteilA }
    : { role: "student", familyId: SEED_IDS.familieA, studentId: SEED_IDS.kindA };
}

/**
 * Der aktuelle Actor. Gibt in Produktion `null` zurück – dort übernehmen
 * F-05/F-06. Aufrufer müssen den Fall behandeln, statt einen Actor anzunehmen.
 */
export async function currentActor(): Promise<Actor | null> {
  if (!devActorEnabled()) return null;

  const store = await cookies();
  const wert = store.get(DEV_ACTOR_COOKIE)?.value;
  // Voreinstellung Kind: Sie ist die Hauptnutzerin, Eltern schauen nur zu.
  return actorFor(wert === "parent" ? "parent" : "student");
}
