import Link from "next/link";

export const metadata = { title: "Konto gelöscht · tutr" };
/**
 * Dynamisch rendern, damit die Seite ein `nonce` bekommt (S-03a).
 *
 * Die Content-Security-Policy bindet Skripte an ein `nonce`, das der Proxy
 * je Anfrage würfelt (`lib/security/csp.ts`). Next hängt es beim Rendern an
 * seine Skript-Tags – **beim Rendern**, und das heißt: Eine zur Buildzeit
 * vorgerenderte Seite hat keins, ihre Skripte tragen kein `nonce`, und der
 * Browser führt keins davon aus. Ohne diese Zeile stünde ausgerechnet die
 * Anmeldung ohne JavaScript da.
 *
 * Der Rest der App braucht das nicht: Jede Seite dort liest die Sitzung und
 * ist damit ohnehin dynamisch. Nur die Seiten vor der Anmeldung kommen ohne
 * aus – und wurden deshalb statisch vorgerendert.
 */
export const dynamic = "force-dynamic";

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
