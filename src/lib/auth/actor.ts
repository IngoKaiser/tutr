import type { Actor } from "@/db/actor";
import { currentActor as devActor, devActorEnabled } from "@/lib/dev-actor";
import { createClient } from "@/lib/supabase/server";

import { actorFuerAuthUser } from "./onboarding";

/**
 * Der Actor für die laufende Anfrage.
 *
 * Reihenfolge: echte Supabase-Session zuerst, Dev-Actor nur als Rückfall und
 * nur außerhalb der Produktion. So funktioniert der Eltern/Kind-Umschalter aus
 * F-07 weiter, solange F-06 (Anmeldung des Kindes) noch fehlt – ohne dass er
 * jemals eine echte Anmeldung überschreiben könnte.
 *
 * `null` heißt: nicht angemeldet. Aufrufer müssen das behandeln.
 */
export async function currentActor(): Promise<Actor | null> {
  const supabase = await createClient();

  // getUser() prüft das Token serverseitig; getSession() würde dem Cookie
  // glauben. Für eine Autorisierungsentscheidung ist nur ersteres zulässig.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    const { actor } = await actorFuerAuthUser(user.id, user.email);
    return actor;
  }

  return devActorEnabled() ? devActor() : null;
}

/** Für die Anzeige im Kopfbereich: Wer ist angemeldet, und wie? */
export async function anmeldeStatus(): Promise<{
  actor: Actor | null;
  email: string | null;
  istDevActor: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    const { actor } = await actorFuerAuthUser(user.id, user.email);
    return { actor, email: user.email, istDevActor: false };
  }

  const dev = devActorEnabled() ? await devActor() : null;
  return { actor: dev, email: null, istDevActor: dev !== null };
}
