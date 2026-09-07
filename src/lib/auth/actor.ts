import { cookies } from "next/headers";

import type { Actor } from "@/db/actor";
import { actorAusSession, SESSION_COOKIE } from "@/lib/auth/student-session";
import { e2eActor, gewaehlteAnsicht, umschalterVerfuegbar } from "@/lib/dev-actor";
import { supabaseKonfiguration } from "@/lib/supabase/konfiguration";
import { createClient } from "@/lib/supabase/server";

import { parentActor, parentLogin } from "./onboarding";

/**
 * Der Actor für die laufende Anfrage.
 *
 * Reihenfolge:
 * 1. Test-Umgehung (nur Playwright, nur außerhalb der Produktion)
 * 2. Kind-Session aus dem Passkey-Cookie (F-06)
 * 3. Echte Supabase-Session → Elternteil, mit einem seiner Kinder
 * 4. Ansichts-Umschalter: Das Elternteil kann dasselbe Kind in dessen eigener
 *    Sicht ansehen
 *
 * Das Kind steht vor dem Elternteil, weil es auf dem eigenen Gerät sitzt: Wer
 * beides in einem Browser hat, ist beim Entwickeln – und dort will man die
 * gerade angelegte Kind-Session sehen, nicht die daneben liegende Eltern-
 * Anmeldung.
 *
 * Ein Elternteil **ohne** verknüpftes Kind bekommt `null` als Actor, aber
 * seine Adresse zurück: Es ist angemeldet, hat nur nichts zu sehen. Genau
 * diesen Zustand zeigt die Oberfläche als leeren Zustand an, statt – wie vor
 * ADR 0006 – ein leeres Konto anzulegen.
 */
export async function currentActor(): Promise<Actor | null> {
  return (await anmeldeStatus()).actor;
}

export type AnmeldeStatus = {
  actor: Actor | null;
  email: string | null;
  /** Umschalter anzeigen? Nur außerhalb der Produktion und nur angemeldet. */
  umschalter: boolean;
  ansicht: "parent" | "student";
  /** Angemeldetes Elternteil ohne verknüpftes Kind – der leere Zustand. */
  elternOhneKind: boolean;
};

const LEER: AnmeldeStatus = {
  actor: null,
  email: null,
  umschalter: false,
  ansicht: "parent",
  elternOhneKind: false,
};

export async function anmeldeStatus(): Promise<AnmeldeStatus> {
  const ausTest = e2eActor();
  if (ausTest) {
    return { ...LEER, actor: ausTest, ansicht: ausTest.role };
  }

  const kekse = await cookies();
  const alsKind = await actorAusSession(kekse.get(SESSION_COOKIE)?.value);
  if (alsKind) {
    return { ...LEER, actor: alsKind, ansicht: "student" };
  }

  if (!supabaseKonfiguration()) return LEER;

  const supabase = await createClient();
  // getUser() prüft das Token serverseitig; getSession() würde dem Cookie
  // glauben. Für eine Autorisierungsentscheidung ist nur ersteres zulässig.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return LEER;

  const login = await parentLogin(user.id);
  if (!login) return LEER;

  const kind = login.students[0];
  if (!kind) {
    return { ...LEER, email: login.email, elternOhneKind: true };
  }

  // Solange es keine Kindauswahl gibt (F-06b), ist es das erste Kind.
  const eltern = parentActor(login, kind.id);
  if (!eltern) return LEER;

  if (umschalterVerfuegbar() && (await gewaehlteAnsicht()) === "student") {
    return {
      ...LEER,
      actor: { role: "student", studentId: kind.id },
      email: login.email,
      umschalter: true,
      ansicht: "student",
    };
  }

  return {
    ...LEER,
    actor: eltern,
    email: login.email,
    umschalter: umschalterVerfuegbar(),
    ansicht: "parent",
  };
}
