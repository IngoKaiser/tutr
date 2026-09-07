import { AnmeldeFormular } from "./anmelde-formular";

export const metadata = { title: "Anmelden · tutr" };

/**
 * Anmeldung des Elternteils (ADR 0002): E-Mail und Magic Link. Das Kind meldet
 * sich nie hier an – es kommt über einen Einladungslink (F-06).
 */
export default function AnmeldenPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-koenigsblau text-xl font-bold tracking-tight">tutr</span>
        <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
        <p className="font-lese text-tinte-weich text-[0.9375rem] leading-relaxed">
          Für Eltern. Du bekommst einen Link per E-Mail — kein Passwort, nichts zu merken.
        </p>
      </div>

      <AnmeldeFormular />

      <p className="text-tinte-leise text-[0.8125rem] leading-normal">
        Deine Tochter meldet sich nicht hier an. Sie bekommt von dir einen Einladungslink und
        richtet auf ihrem Gerät einen Passkey ein.
      </p>
    </main>
  );
}
