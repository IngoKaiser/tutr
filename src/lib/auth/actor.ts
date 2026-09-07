import { cookies } from "next/headers";

import type { Actor } from "@/db/actor";
import { actorFromSession, SESSION_COOKIE } from "@/lib/auth/student-session";
import { e2eActor, activeView, switcherAvailable } from "@/lib/dev-actor";
import { supabaseConfig } from "@/lib/supabase/config";
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
  return (await loginStatus()).actor;
}

export type LoginStatus = {
  actor: Actor | null;
  email: string | null;
  /** Umschalter anzeigen? Nur außerhalb der Produktion und nur angemeldet. */
  switcher: boolean;
  view: "parent" | "student";
  /** Angemeldetes Elternteil ohne verknüpftes Kind – der leere Zustand. */
  parentWithoutStudent: boolean;
};

const EMPTY: LoginStatus = {
  actor: null,
  email: null,
  switcher: false,
  view: "parent",
  parentWithoutStudent: false,
};

export async function loginStatus(): Promise<LoginStatus> {
  const testActor = e2eActor();
  if (testActor) {
    return { ...EMPTY, actor: testActor, view: testActor.role };
  }

  const cookieStore = await cookies();
  const asStudent = await actorFromSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (asStudent) {
    return { ...EMPTY, actor: asStudent, view: "student" };
  }

  if (!supabaseConfig()) return EMPTY;

  const supabase = await createClient();
  // getUser() prüft das Token serverseitig; getSession() würde dem Cookie
  // glauben. Für eine Autorisierungsentscheidung ist nur ersteres zulässig.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return EMPTY;

  const login = await parentLogin(user.id);
  if (!login) return EMPTY;

  const student = login.students[0];
  if (!student) {
    return { ...EMPTY, email: login.email, parentWithoutStudent: true };
  }

  // Solange es keine Kindauswahl gibt (F-06b), ist es das erste Kind.
  const parent = parentActor(login, student.id);
  if (!parent) return EMPTY;

  if (switcherAvailable() && (await activeView()) === "student") {
    return {
      ...EMPTY,
      actor: { role: "student", studentId: student.id },
      email: login.email,
      switcher: true,
      view: "student",
    };
  }

  return {
    ...EMPTY,
    actor: parent,
    email: login.email,
    switcher: switcherAvailable(),
    view: "parent",
  };
}
