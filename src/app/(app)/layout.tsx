import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/anmelden/actions";
import { ActorSwitch } from "@/components/dev/actor-switch";
import { BottomNav } from "@/components/shell/bottom-nav";
import { StudentSwitch } from "@/components/shell/student-switch";
import { loginStatus } from "@/lib/auth/actor";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { actor, email, switcher, view, parentWithoutStudent, login } = await loginStatus();

  async function logoutAndRedirect() {
    "use server";
    await logout();
    redirect("/anmelden");
  }

  // Angemeldet, aber mit keinem Kind verknüpft. Vor ADR 0006 konnte das nicht
  // passieren, weil der erste Login eine leere Familie anlegte – genau die
  // Geisterdaten, die jetzt wegfallen. Zurück auf die Anmeldeseite zu werfen
  // wäre falsch: Das Elternteil *ist* angemeldet, es hat nur nichts zu sehen.
  if (parentWithoutStudent) {
    return (
      <EmptyShell email={email} logout={logoutAndRedirect}>
        <h1 className="text-2xl font-semibold tracking-tight">Noch kein Kind verknüpft</h1>
        <p className="font-lese text-tinte-weich text-[0.9375rem] leading-relaxed">
          Sobald Ihr Kind sich bei tutr anmeldet und <strong>{email}</strong> als Adresse der Eltern
          angibt, erscheint es hier. Sie bekommen dann eine Nachricht.
        </p>
        <p className="text-tinte-leise text-[0.8125rem] leading-normal">
          Sie haben eine Nachricht erhalten, sehen hier aber nichts? Dann wurde eine andere Adresse
          eingetragen als die, mit der Sie angemeldet sind.
        </p>
      </EmptyShell>
    );
  }

  // Der Proxy leitet bereits um; das hier ist die zweite Sicherung für den
  // Fall, dass eine Route am Matcher vorbeiläuft. Die dritte und eigentliche
  // ist RLS – ohne Actor liefert die Datenbank ohnehin nichts.
  if (!actor) redirect("/anmelden");

  return (
    // **Fester Rahmen statt scrollendem Dokument** (T-07): Die Höhe ist der
    // Bildschirm, gescrollt wird nur `main`. Das ist der Unterschied zwischen
    // einer Website und einer App – und die Voraussetzung dafür, dass der
    // Tutor-Composer per `sticky bottom-0` genau über der Fußleiste klebt,
    // ohne deren Höhe kennen zu müssen. Vorher wanderte er beim Lesen einer
    // langen Antwort aus dem Bild.
    <div className="app-rahmen flex h-dvh flex-col">
      <header className="border-linie bg-flaeche shrink-0 border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-koenigsblau text-lg font-bold tracking-tight">tutr</span>

          <div className="flex items-center gap-3">
            {view === "parent" && login && actor?.role === "parent" ? (
              <>
                <StudentSwitch students={login.students} current={actor.studentId} />
                <Link
                  href="/einstellungen"
                  className="text-tinte-leise hover:text-tinte text-xs font-medium"
                >
                  Einstellungen
                </Link>
              </>
            ) : null}
            {view === "student" && actor?.role === "student" ? (
              // Schmal (F-06e): Für die Kind-Rolle zeigt /einstellungen nur
              // „Konto löschen" – keine Kindliste, keine Geräteverwaltung.
              <Link
                href="/einstellungen"
                className="text-tinte-leise hover:text-tinte text-xs font-medium"
              >
                Einstellungen
              </Link>
            ) : null}
            {switcher ? <ActorSwitch current={view} /> : null}
            {email ? (
              <span className="text-tinte-leise max-w-[10rem] truncate text-xs" title={email}>
                {email}
              </span>
            ) : null}
            {/* Unabhängig von `email`, nicht daran gekoppelt: `email` bleibt
                für die Kind-Rolle immer leer (nur Eltern melden sich über
                Supabase an), ein Kind hatte deshalb hier gar keinen Weg,
                sich abzumelden – nur „Konto löschen" unter /einstellungen,
                das ist unwiderruflich und kein Ersatz. Gefunden beim
                Testen auf mytutr.de. */}
            {actor ? (
              <form action={logoutAndRedirect}>
                <button
                  type="submit"
                  className="border-linie-stark bg-flaeche text-tinte-weich hover:text-tinte focus-visible:outline-koenigsblau rounded-md border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
                >
                  Abmelden
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      {/* `min-h-0` ist hier nicht kosmetisch: Ohne das weigert sich ein
          Flex-Kind zu schrumpfen, `overflow-y-auto` liefe ins Leere und die
          Seite scrollte wieder als Ganzes.

          `container-type: size` macht `main` zum Größen-Container (T-12a):
          Seiten können sich damit über `cqh` auf die **sichtbare** Höhe
          beziehen, statt sie aus `100dvh` minus Kopf- und Fußleiste zu
          schätzen. Genau eine Seite braucht das – der Tutor-Chat, der seine
          drei Zonen (Kopfzeile, scrollende Nachrichten, festes Eingabefeld)
          ohne `position: sticky` bauen muss; auf dem iPhone rutschte das
          klebende Eingabefeld beim Scrollen mit nach oben.

          Bewusst **keine** feste Höhe auf der Hülle: Damit würden die Kinder
          einer Seite, die `flex flex-col` ist (also fast jeder), bei zu wenig
          Platz gestaucht statt überzulaufen – aus einer scrollenden
          Vokabelliste würde eine zusammengedrückte. Der Größen-Container
          lässt alle anderen Seiten unangetastet. */}
      <main className="[container-type:size] min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-2xl px-4 py-5">{children}</div>
      </main>

      <BottomNav />
    </div>
  );
}

/** Kopfbereich mit Abmelden, aber ohne Navigation – es gibt nichts zu navigieren. */
function EmptyShell({
  email,
  logout,
  children,
}: {
  email: string | null;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-linie bg-flaeche border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-koenigsblau text-lg font-bold tracking-tight">tutr</span>
          <div className="flex items-center gap-3">
            {email ? (
              <span className="text-tinte-leise max-w-[12rem] truncate text-xs" title={email}>
                {email}
              </span>
            ) : null}
            <form action={logout}>
              <button
                type="submit"
                className="border-linie-stark bg-flaeche text-tinte-weich hover:text-tinte focus-visible:outline-koenigsblau rounded-md border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10">
        {children}
      </main>
    </div>
  );
}
