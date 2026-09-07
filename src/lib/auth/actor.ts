import { sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { withActor, type Actor } from "@/db/actor";
import { actorAusSession, SESSION_COOKIE } from "@/lib/auth/student-session";
import { e2eActor, gewaehlteAnsicht, umschalterVerfuegbar } from "@/lib/dev-actor";
import { supabaseKonfiguration } from "@/lib/supabase/konfiguration";
import { createClient } from "@/lib/supabase/server";

import { actorFuerAuthUser } from "./onboarding";

/**
 * Der Actor für die laufende Anfrage.
 *
 * Reihenfolge:
 * 1. Test-Umgehung (nur Playwright, nur außerhalb der Produktion)
 * 2. Kind-Session aus dem Passkey-Cookie (F-06)
 * 3. Echte Supabase-Session → Elternteil
 * 4. Ansichts-Umschalter: angemeldetes Elternteil kann als Kind der eigenen
 *    Familie schauen
 *
 * Das Kind steht vor dem Elternteil, weil es auf dem eigenen Gerät sitzt: Wer
 * beides in einem Browser hat, ist beim Entwickeln – und dort will man die
 * gerade angelegte Kind-Session sehen, nicht die daneben liegende Eltern-
 * Anmeldung.
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

  const kekse = await cookies();
  const alsKind = await actorAusSession(kekse.get(SESSION_COOKIE)?.value);
  if (alsKind) {
    return { actor: alsKind, email: null, umschalter: false, ansicht: "student" };
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
    const kindAnsicht = await kindDerFamilie(eltern);
    if (kindAnsicht) {
      return { actor: kindAnsicht, email: user.email, umschalter: true, ansicht: "student" };
    }
  }

  return {
    actor: eltern,
    email: user.email,
    umschalter: umschalterVerfuegbar(),
    ansicht: "parent",
  };
}
