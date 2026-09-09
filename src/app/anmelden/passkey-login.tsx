"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { completeLogin, startLogin } from "./passkey-actions";

/**
 * Anmeldung ohne Kennung (F-06). Ein Tipp, Face ID, drin – möglich nur, weil
 * der Passkey bei der Registrierung auffindbar angelegt wurde (ADR 0005).
 */
export function PasskeyLogin() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
