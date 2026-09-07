import Link from "next/link";

import { resendRestriction } from "@/lib/mail/resend";

import { RegistrationForm } from "./registration-form";

export const metadata = { title: "Profil anlegen · tutr" };

/**
 * Selbstanlage durch das Kind (ADR 0005). Kein Einladungslink, keine
 * Profilwahl: Wer hier ankommt, legt sich in einem Schritt an.
 */
export default function RegisterPage() {
  const restriction = resendRestriction();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-koenigsblau text-xl font-bold tracking-tight">tutr</span>
        <h1 className="text-2xl font-semibold tracking-tight">Leg dein Profil an</h1>
        <p className="font-lese text-tinte-weich text-[0.9375rem] leading-relaxed">
          Danach meldest du dich mit Face ID an — kein Passwort, nichts zu merken.
        </p>
      </div>

      {restriction ? (
        <p className="border-offen bg-offen-hell text-tinte rounded-[10px] border p-3 text-[0.8125rem] leading-normal">
          <strong className="text-offen">Nur in der Entwicklung:</strong> {restriction}
        </p>
      ) : null}

      <RegistrationForm />

      <p className="text-tinte-leise text-[0.8125rem] leading-normal">
        Du hast schon ein Profil?{" "}
        <Link href="/anmelden" className="text-koenigsblau underline underline-offset-2">
          Hier anmelden
        </Link>
        .
      </p>
    </main>
  );
}
