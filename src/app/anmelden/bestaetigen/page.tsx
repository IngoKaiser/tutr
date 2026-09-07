import Link from "next/link";

import { confirmLogin } from "./actions";

export const metadata = { title: "Anmeldung bestätigen · tutr" };

/**
 * Zwischenseite zwischen Mail-Link und Anmeldung.
 *
 * Der Grund ist nicht Zeremonie, sondern Notwendigkeit: Mailprogramme und
 * Sicherheits-Scanner öffnen Links vorab, um sie zu prüfen, und verbrauchen
 * dabei den Einmal-Token – der eigene Klick lief dann ins Leere. Diese Seite
 * tut beim Laden **nichts**. Eingelöst wird erst beim Drücken des Knopfes,
 * also durch eine abgeschickte Form, die kein Scanner auslöst.
 */
export default async function ConfirmLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; weiter?: string }>;
}) {
  const { token_hash: tokenHash, type, weiter } = await searchParams;

  if (!tokenHash || !type) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
        <span className="text-koenigsblau text-xl font-bold tracking-tight">tutr</span>
        <h1 className="text-2xl font-semibold tracking-tight">Dieser Link ist unvollständig</h1>
        <p className="font-lese text-tinte-weich text-[0.9375rem] leading-relaxed">
          Am besten forderst du einen neuen an.
        </p>
        <Link
          href="/anmelden"
          className="bg-koenigsblau text-auf-koenigsblau rounded-[9px] px-4 py-2.5 text-center text-sm font-semibold"
        >
          Zur Anmeldung
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-koenigsblau text-xl font-bold tracking-tight">tutr</span>
        <h1 className="text-2xl font-semibold tracking-tight">Fast geschafft</h1>
        <p className="font-lese text-tinte-weich text-[0.9375rem] leading-relaxed">
          Ein Klick noch, dann bist du drin.
        </p>
      </div>

      <form action={confirmLogin}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="weiter" value={weiter ?? "/heute"} />
        <button
          type="submit"
          className="bg-koenigsblau text-auf-koenigsblau focus-visible:outline-koenigsblau w-full rounded-[9px] px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Anmeldung abschließen
        </button>
      </form>

      <p className="text-tinte-leise text-[0.8125rem] leading-normal">
        Dieser Zwischenschritt hat einen Grund: Manche Mailprogramme öffnen Links vorab, um sie zu
        prüfen. Weil hier erst dein Klick zählt, kann ihn niemand vorher verbrauchen.
      </p>
    </main>
  );
}
