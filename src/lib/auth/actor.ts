import { sql } from "drizzle-orm";

import { withActor, type Actor } from "@/db/actor";
import { e2eActor, gewaehlteAnsicht, umschalterVerfuegbar } from "@/lib/dev-actor";
import { supabaseKonfiguration } from "@/lib/supabase/konfiguration";
import { createClient } from "@/lib/supabase/server";

import { actorFuerAuthUser } from "./onboarding";

/**
 * Der Actor für die laufende Anfrage.
 *
 * Reihenfolge:
 * 1. Test-Umgehung (nur Playwright, nur außerhalb der Produktion)
 * 2. Echte Supabase-Session → Elternteil
 * 3. Ansichts-Umschalter: angemeldetes Elternteil kann als Kind der eigenen
 *    Familie schauen, solange F-06 fehlt
 *
 * Ohne Session gibt es `null` – auch beim Entwickeln. Die Anmeldung ist die
 * Tür, der Umschalter regelt nur die Sicht dahinter.
 */
export async function currentActor(): Promise<Actor | null> {
  return (await anmeldeStatus()).actor;
}

/** Ein Kind der Familie – für die Kind-Ansicht des angemeldeten Elternteils. */
async function kindDerFamilie(eltern: Actor): Promise<Actor | null> {
  const zeilen = await withActor(eltern, (tx) =>
    tx.execute<{ id: string }>(sql`select id from student order by first_name limit 1`),
  );
  const kind = zeilen[0];
  return kind ? { role: "student", familyId: eltern.familyId, studentId: kind.id } : null;
}

export async function anmeldeStatus(): Promise<{
  actor: Actor | null;
  email: string | null;
  /** Umschalter anzeigen? Nur außerhalb der Produktion und nur angemeldet. */
  umschalter: boolean;
  ansicht: "parent" | "student";
}> {
  const ausTest = e2eActor();
  if (ausTest) {
    return { actor: ausTest, email: null, umschalter: false, ansicht: ausTest.role };
  }

  if (!supabaseKonfiguration()) {
    return { actor: null, email: null, umschalter: false, ansicht: "parent" };
  }

  const supabase = await createClient();
  // getUser() prüft das Token serverseitig; getSession() würde dem Cookie
  // glauben. Für eine Autorisierungsentscheidung ist nur ersteres zulässig.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { actor: null, email: null, umschalter: false, ansicht: "parent" };
  }

  const { actor: eltern } = await actorFuerAuthUser(user.id, user.email);

  if (umschalterVerfuegbar() && (await gewaehlteAnsicht()) === "student") {
    const alsKind = await kindDerFamilie(eltern);
    if (alsKind) {
      return { actor: alsKind, email: user.email, umschalter: true, ansicht: "student" };
    }
  }

  return {
    actor: eltern,
    email: user.email,
    umschalter: umschalterVerfuegbar(),
    ansicht: "parent",
  };
}
