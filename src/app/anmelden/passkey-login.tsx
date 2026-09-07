"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
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
      const name = problem instanceof Error ? problem.name : "";
      setError(
        name === "NotAllowedError"
          ? "Abgebrochen."
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
        <p role="alert" className="text-offen text-[0.8125rem]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
