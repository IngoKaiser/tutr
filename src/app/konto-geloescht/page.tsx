import Link from "next/link";

export const metadata = { title: "Konto gelöscht · tutr" };

/**
 * Nach `deleteMyAccount()`/`deleteMyParentAccount()` (F-06e).
 *
 * Ohne diese Seite liefe die Löschung in einen wortlosen Rauswurf: die
 * Session ist zu diesem Zeitpunkt schon beendet, ein Redirect auf
 * `/einstellungen` würde nur `redirect("/anmelden")` treffen. Diese Seite
 * sagt stattdessen, was passiert ist.
 */
export default function AccountDeletedPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-koenigsblau text-xl font-bold tracking-tight">tutr</span>
        <h1 className="text-2xl font-semibold tracking-tight">Konto gelöscht</h1>
      </div>
      <p className="text-tinte-weich text-[0.9375rem] leading-relaxed">
        Dein Konto und alle zugehörigen Daten sind gelöscht.
      </p>
      <Link
        href="/anmelden"
        className="border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief focus-visible:outline-koenigsblau self-start rounded-[9px] border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Zur Anmeldung
      </Link>
    </main>
  );
}
