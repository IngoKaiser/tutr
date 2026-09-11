import { LoginError } from "./login-error";
import { MagicLinkForm } from "./magic-link-form";
import { PasskeyLogin } from "./passkey-login";

export const metadata = { title: "Anmelden · tutr" };
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
 * Zwei Wege hinein, in der Reihenfolge, in der sie gebraucht werden (ADR 0005):
 *
 * Das Kind zuerst, per Passkey – es ist die tägliche Nutzerin. Eltern kommen
 * seltener und über den Magic Link; typischerweise genau einmal, aus der
 * Einwilligungsmail heraus. Deshalb steht ihr Weg unten und leiser.
 */
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-koenigsblau text-xl font-bold tracking-tight">tutr</span>
        <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
      </div>

      <LoginError />

      {/* Der „Zum ersten Mal hier?"-Hinweis steckt in `PasskeyLogin` und
          erscheint nur, wenn dort auch der Passkey-Knopf steht: Auf einem
          Gerät ohne bekannten Passkey ist „Profil anlegen" schon die
          Hauptaktion, ein zweiter Hinweis darauf wäre Doppelung (F-14). */}
      <PasskeyLogin />

      <div className="border-linie flex items-center gap-3 border-t pt-6">
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-[0.9375rem] font-semibold">Ich bin ein Elternteil</h2>
            <p className="text-tinte-weich text-[0.8125rem] leading-normal">
              Du bekommst einen Link per E-Mail — kein Passwort, nichts zu merken.
            </p>
          </div>
          <MagicLinkForm />
        </div>
      </div>
    </main>
  );
}
