import { cookies } from "next/headers";

import type { Actor } from "@/db/actor";
import { actorFromSession, SESSION_COOKIE } from "@/lib/auth/student-session";
import { e2eActor, e2eLogin, activeView, switcherAvailable } from "@/lib/dev-actor";
import { selectedStudentId } from "@/lib/student-switch";
import { supabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { joinOrLogin, parentActor, type ParentLogin } from "./onboarding";

/**
 * Der Actor für die laufende Anfrage.
 *
 * Reihenfolge:
 * 1. Test-Umgehung (nur Playwright, nur außerhalb der Produktion)
 * 2. Kind-Session aus dem Passkey-Cookie (F-06)
 * 3. Echte Supabase-Session → Elternteil, mit einem gewählten Kind (F-06b)
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
 * ADR 0006 – ein leeres Konto anzulegen. Passt die Adresse zu keinem Kind
 * (`joinOrLogin()` findet nichts zum Beitreten), ist es derselbe Zustand.
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
  /** Verknüpfte Kinder, für den Kind-Umschalter (F-06b). Nur bei Eltern gefüllt. */
  login: ParentLogin | null;
};

const EMPTY: LoginStatus = {
  actor: null,
  email: null,
  switcher: false,
  view: "parent",
  parentWithoutStudent: false,
  login: null,
};

export async function loginStatus(): Promise<LoginStatus> {
  const testActor = e2eActor();
  if (testActor) {
    const testLogin = e2eLogin();
    // Der Kind-Umschalter (F-06b) muss auch unter dem Test-Bypass wirken,
    // sonst zeigte /einstellungen dort immer dasselbe Kind, egal was das
    // Cookie sagt – genau der Fehler, den der Playwright-Lauf hier gefunden
    // hat. Nur für die Eltern-Rolle: Als Kind gibt es nichts zu wechseln.
    const studentId =
      testActor.role === "parent" && testLogin
        ? await selectedStudentId(testLogin.students)
        : testActor.studentId;
    const actor: Actor =
      testActor.role === "parent" && studentId ? { ...testActor, studentId } : testActor;

    // Derselbe Ansichts-Umschalter wie beim echten Login (unten) – ohne ihn
    // gibt es unter dem Bypass keinen Weg zu einem Kind-Actor mit Schreib-
    // rechten, und `<ActorSwitch>` wird gar nicht erst gerendert (`switcher`
    // blieb hier immer `false`). Gefunden beim Bauen von V-02: Ohne diesen
    // Zweig hatten Vokabel-Policies ("Kind schreibt") keine
    // Browser-Abdeckung – ein Playwright-Test, der prüfte, konnte den
    // Umschalter nicht einmal finden.
    if (testActor.role === "parent" && switcherAvailable() && (await activeView()) === "student") {
      return {
        ...EMPTY,
        actor: { role: "student", studentId: actor.studentId },
        view: "student",
        switcher: true,
        login: testLogin,
      };
    }

    return {
      ...EMPTY,
      actor,
      view: testActor.role,
      switcher: testActor.role === "parent" && switcherAvailable(),
      login: testLogin,
    };
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

  const login = await joinOrLogin(user.id, user.email);
  if (!login) {
    // Angemeldet, aber weder ein bestehendes Konto noch ein Kind mit dieser
    // Adresse gefunden. Derselbe leere Zustand wie ein Konto ohne Kinder.
    return { ...EMPTY, email: user.email, parentWithoutStudent: true };
  }

  const studentId = await selectedStudentId(login.students);
  if (!studentId) {
    return { ...EMPTY, email: login.email, login, parentWithoutStudent: true };
  }

  const parent = parentActor(login, studentId);
  if (!parent) return EMPTY;

  if (switcherAvailable() && (await activeView()) === "student") {
    return {
      ...EMPTY,
      actor: { role: "student", studentId },
      email: login.email,
      switcher: true,
      view: "student",
      login,
    };
  }

  return {
    ...EMPTY,
    actor: parent,
    email: login.email,
    switcher: switcherAvailable(),
    view: "parent",
    login,
  };
}
