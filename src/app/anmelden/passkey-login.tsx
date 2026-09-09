"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { kenntPasskeyAufDiesemGeraet, merkePasskeyAufDiesemGeraet } from "@/lib/auth/passkey-hint";

import { completeLogin, startLogin } from "./passkey-actions";

/** Die Notiz ändert sich während eines Seitenbesuchs nicht – nichts zu abonnieren. */
function abonniereNichts(): () => void {
  return () => {};
}

/**
 * Anmeldung ohne Kennung (F-06). Ein Tipp, Face ID, drin – möglich nur, weil
 * der Passkey bei der Registrierung auffindbar angelegt wurde (ADR 0005).
 *
 * **Auf einem fremden Gerät wird die Zeremonie gar nicht erst gestartet**
 * (F-14). Sonst zeigt das Betriebssystem seinen eigenen Dialog mit
 * „QR-Code scannen" und „Sicherheitsschlüssel verwenden" – lauter Wege, die
 * jemand ohne Profil nicht gehen kann, und die aussehen, als sei etwas
 * kaputt. Ob ein Passkey existiert, lässt sich nicht abfragen (WebAuthn
 * verrät das absichtlich nie), deshalb entscheidet die Gerätenotiz aus
 * `passkey-hint.ts` – mit sichtbarem Ausweg für den Fall, dass sie irrt.
 */
export function PasskeyLogin() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [trotzdem, setTrotzdem] = useState(false);
  // `useSyncExternalStore` statt Effekt: `localStorage` gibt es auf dem
  // Server nicht, und die Server-Momentaufnahme (`true`) verhindert, dass
  // jemand mit Passkey beim Laden kurz den falschen Text sieht.
  const kenntGeraet = useSyncExternalStore(
    abonniereNichts,
    kenntPasskeyAufDiesemGeraet,
    () => true,
  );

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      const start = await startLogin();
      if (start.status === "error") {
        setError("Die Anmeldung ließ sich nicht starten.");
        return;
      }

      const response = await startAuthentication({
        optionsJSON: start.options as PublicKeyCredentialRequestOptionsJSON,
      });

      const completion = await completeLogin(response);
      if (completion.status === "error") {
        setError(completion.message);
        return;
      }

      // Ab jetzt weiß dieser Browser, dass hier ein Passkey liegt – beim
      // nächsten Mal führt der Weg ohne Umweg zur Anmeldung (F-14).
      merkePasskeyAufDiesemGeraet();
      router.push("/heute");
    } catch (problem) {
      // `NotAllowedError` heißt beides: „bewusst abgebrochen" UND „kein
      // passender Passkey da, das Betriebssystem hat den Dialog trotzdem
      // gezeigt (QR-Code, Sicherheitsschlüssel) und der Rückweg lief über
      // Abbrechen". WebAuthn unterscheidet die beiden Fälle absichtlich
      // nicht – aus Datenschutzgründen darf eine Seite nie erfahren, ob
      // *irgendein* Passkey existiert. Vorher stand hier „Abgebrochen." für
      // beide Fälle, und genau im zweiten – häufigeren – Fall war das
      // irreführend: Es klang nach einem eigenen Fehler, nicht nach „du hast
      // hier noch kein Profil". Gefunden beim Testen auf mytutr.de.
      const name = problem instanceof Error ? problem.name : "";
      setError(
        name === "NotAllowedError"
          ? "Keine Anmeldung zustande gekommen."
          : "Auf diesem Gerät ist kein Passkey für tutr hinterlegt.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Auf einem Gerät, von dem wir keinen Passkey kennen, führt der erste
  // Weg zur Registrierung – nicht in den Systemdialog des Betriebssystems.
  if (!kenntGeraet && !trotzdem) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href="/registrieren"
          className="bg-koenigsblau text-auf-koenigsblau focus-visible:outline-koenigsblau rounded-[9px] px-4 py-2.5 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Profil anlegen
        </Link>
        <p className="text-tinte-weich text-[0.8125rem] leading-normal">
          Auf diesem Gerät ist noch kein Zugang eingerichtet. Leg dir ein Profil an – das dauert
          keine Minute und braucht kein Passwort.
        </p>
        {/* Der Ausweg für den Fall, dass die Gerätenotiz irrt – etwa nach
            gelöschten Browserdaten. Klein, aber sichtbar: Die Notiz darf
            sich irren, sie darf niemanden aussperren. */}
        <button
          type="button"
          onClick={() => setTrotzdem(true)}
          className="text-tinte-leise hover:text-tinte self-start text-[0.8125rem] underline underline-offset-2"
        >
          Ich habe hier schon einen Passkey
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleLogin}
        disabled={submitting}
        className="bg-koenigsblau text-auf-koenigsblau focus-visible:outline-koenigsblau rounded-[9px] px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {submitting ? "Einen Moment …" : "Mit Face ID anmelden"}
      </button>

      <p className="text-tinte-leise text-[0.8125rem] leading-normal">
        Zum ersten Mal hier?{" "}
        <Link href="/registrieren" className="text-koenigsblau underline underline-offset-2">
          Profil anlegen
        </Link>
        .
      </p>

      {error ? (
        <div className="flex flex-col gap-1">
          <p role="alert" className="text-offen text-[0.8125rem]">
            {error}
          </p>
          {/* Direkt unter dem Fehler, nicht nur als kleiner Hinweis weiter
              oben: Genau hier merkt jemand, dass es noch kein Profil gibt –
              der nächste Schritt soll an dieser Stelle stehen, nicht
              gesucht werden müssen. */}
          <p className="text-tinte-leise text-[0.8125rem] leading-normal">
            Noch kein Profil?{" "}
            <Link href="/registrieren" className="text-koenigsblau underline underline-offset-2">
              Jetzt anlegen
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
