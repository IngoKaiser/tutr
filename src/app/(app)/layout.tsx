import { redirect } from "next/navigation";

import { abmelden } from "@/app/anmelden/actions";
import { ActorSwitch } from "@/components/dev/actor-switch";
import { BottomNav } from "@/components/shell/bottom-nav";
import { anmeldeStatus } from "@/lib/auth/actor";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { actor, email, umschalter, ansicht } = await anmeldeStatus();

  // Der Proxy leitet bereits um; das hier ist die zweite Sicherung für den
  // Fall, dass eine Route am Matcher vorbeiläuft. Die dritte und eigentliche
  // ist RLS – ohne Actor liefert die Datenbank ohnehin nichts.
  if (!actor) redirect("/anmelden");

  async function abmeldenUndZurueck() {
    "use server";
    await abmelden();
    redirect("/anmelden");
  }

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
