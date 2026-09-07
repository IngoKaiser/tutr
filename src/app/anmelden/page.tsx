import Link from "next/link";

import { AnmeldeFehler } from "./anmelde-fehler";
import { AnmeldeFormular } from "./anmelde-formular";
import { PasskeyAnmeldung } from "./passkey-anmeldung";

export const metadata = { title: "Anmelden · tutr" };

/**
 * Zwei Wege hinein, in der Reihenfolge, in der sie gebraucht werden (ADR 0005):
 *
 * Das Kind zuerst, per Passkey – es ist die tägliche Nutzerin. Eltern kommen
 * seltener und über den Magic Link; typischerweise genau einmal, aus der
 * Einwilligungsmail heraus. Deshalb steht ihr Weg unten und leiser.
 */
export default function AnmeldenPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-koenigsblau text-xl font-bold tracking-tight">tutr</span>
        <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
      </div>

      <AnmeldeFehler />

      <div className="flex flex-col gap-3">
        <PasskeyAnmeldung />
        <p className="text-tinte-leise text-[0.8125rem] leading-normal">
          Zum ersten Mal hier?{" "}
          <Link href="/registrieren" className="text-koenigsblau underline underline-offset-2">
            Profil anlegen
          </Link>
          .
        </p>
      </div>

      <div className="border-linie flex items-center gap-3 border-t pt-6">
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-[0.9375rem] font-semibold">Ich bin ein Elternteil</h2>
            <p className="text-tinte-weich text-[0.8125rem] leading-normal">
              Du bekommst einen Link per E-Mail — kein Passwort, nichts zu merken.
            </p>
          </div>
          <AnmeldeFormular />
        </div>
      </div>
    </main>
  );
}
