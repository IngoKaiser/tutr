import Link from "next/link";

import { recoveryCandidate } from "@/lib/auth/recovery";

import { RecoveryForm } from "./recovery-form";

export const metadata = { title: "Gerät einrichten · tutr" };

/**
 * Landeseite eines Wiederherstellungslinks (F-06d).
 *
 * Der Blick auf den Kandidaten hier ist rein lesend – `recoveryCandidate()`
 * verbraucht den Token nicht, nur `startRecovery()` gleich in `RecoveryForm`
 * prüft ihn erneut, und verbraucht wird er erst nach der erfolgreichen
 * WebAuthn-Zeremonie. Ein vorab öffnender Scanner sieht hier höchstens einen
 * Vornamen, richtet aber nichts ein.
 */
export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const candidate = token ? await recoveryCandidate(token) : null;

  if (!token || !candidate) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
        <span className="text-koenigsblau text-xl font-bold tracking-tight">tutr</span>
        <h1 className="text-2xl font-semibold tracking-tight">Dieser Link ist ungültig</h1>
        <p className="font-lese text-tinte-weich text-[0.9375rem] leading-relaxed">
          Er wurde schon verwendet, ist abgelaufen, oder es fehlt etwas in der Adresse. Bitte lass
          dir von deinen Eltern einen neuen geben.
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-koenigsblau text-xl font-bold tracking-tight">tutr</span>
        <h1 className="text-2xl font-semibold tracking-tight">Hallo {candidate.firstName}</h1>
        <p className="font-lese text-tinte-weich text-[0.9375rem] leading-relaxed">
          Richte auf diesem Gerät einen neuen Passkey ein, dann kommst du wieder rein. Dein altes
          Gerät entfernen deine Eltern danach in den Einstellungen.
        </p>
      </div>

      <RecoveryForm token={token} />
    </main>
  );
}
