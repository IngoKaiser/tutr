import { redirect } from "next/navigation";

import { abmelden } from "@/app/anmelden/actions";
import { ActorSwitch } from "@/components/dev/actor-switch";
import { BottomNav } from "@/components/shell/bottom-nav";
import { anmeldeStatus } from "@/lib/auth/actor";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { actor, email, umschalter, ansicht, elternOhneKind } = await anmeldeStatus();

  async function abmeldenUndZurueck() {
    "use server";
    await abmelden();
    redirect("/anmelden");
  }

  // Angemeldet, aber mit keinem Kind verknüpft. Vor ADR 0006 konnte das nicht
  // passieren, weil der erste Login eine leere Familie anlegte – genau die
  // Geisterdaten, die jetzt wegfallen. Zurück auf die Anmeldeseite zu werfen
  // wäre falsch: Das Elternteil *ist* angemeldet, es hat nur nichts zu sehen.
  if (elternOhneKind) {
    return (
      <LeererRahmen email={email} abmelden={abmeldenUndZurueck}>
        <h1 className="text-2xl font-semibold tracking-tight">Noch kein Kind verknüpft</h1>
        <p className="font-lese text-tinte-weich text-[0.9375rem] leading-relaxed">
          Sobald Ihr Kind sich bei tutr anmeldet und <strong>{email}</strong> als Adresse der Eltern
          angibt, erscheint es hier. Sie bekommen dann eine Nachricht.
        </p>
        <p className="text-tinte-leise text-[0.8125rem] leading-normal">
          Sie haben eine Nachricht erhalten, sehen hier aber nichts? Dann wurde eine andere Adresse
          eingetragen als die, mit der Sie angemeldet sind.
        </p>
      </LeererRahmen>
    );
  }

  // Der Proxy leitet bereits um; das hier ist die zweite Sicherung für den
  // Fall, dass eine Route am Matcher vorbeiläuft. Die dritte und eigentliche
  // ist RLS – ohne Actor liefert die Datenbank ohnehin nichts.
  if (!actor) redirect("/anmelden");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-linie bg-flaeche border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-koenigsblau text-lg font-bold tracking-tight">tutr</span>

          <div className="flex items-center gap-3">
            {umschalter ? <ActorSwitch aktuell={ansicht} /> : null}
            {email ? (
              <>
                <span className="text-tinte-leise max-w-[10rem] truncate text-xs" title={email}>
                  {email}
                </span>
                <form action={abmeldenUndZurueck}>
                  <button
                    type="submit"
                    className="border-linie-stark bg-flaeche text-tinte-weich hover:text-tinte focus-visible:outline-koenigsblau rounded-md border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
                  >
                    Abmelden
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">{children}</main>

      <BottomNav />
    </div>
  );
}

/** Kopfbereich mit Abmelden, aber ohne Navigation – es gibt nichts zu navigieren. */
function LeererRahmen({
  email,
  abmelden,
  children,
}: {
  email: string | null;
  abmelden: () => Promise<void>;
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
            <form action={abmelden}>
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
