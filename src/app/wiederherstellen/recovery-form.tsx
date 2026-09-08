"use client";

import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { completeRecovery, startRecovery } from "./actions";

/**
 * Ein weiterer Passkey für ein bestehendes Kind (F-06d).
 *
 * Struktur wie `RegistrationForm` (F-06): kein `useActionState`, weil
 * zwischen den beiden Server Actions der Face-ID-Dialog des Browsers steht,
 * und der lässt sich nur aus einem Klick heraus öffnen.
 */
export function RecoveryForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setError(null);
    setSubmitting(true);
    try {
      const start = await startRecovery(token);
      if (start.status === "error") {
        setError(start.message);
        return;
      }

      const response = await startRegistration({
        optionsJSON: start.options as PublicKeyCredentialCreationOptionsJSON,
      });

      const completion = await completeRecovery(response);
      if (completion.status === "error") {
        setError(completion.message);
        return;
      }

      router.push("/heute");
    } catch (problem) {
      const name = problem instanceof Error ? problem.name : "";
      setError(
        name === "NotAllowedError"
          ? "Abgebrochen. Tipp noch einmal auf „Passkey einrichten“, wenn du so weit bist."
          : "Dein Gerät konnte keinen Passkey anlegen. Probier es in einem anderen Browser.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-offen text-[0.8125rem]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="bg-koenigsblau text-auf-koenigsblau focus-visible:outline-koenigsblau rounded-[9px] px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {submitting ? "Einen Moment …" : "Passkey einrichten"}
      </button>
    </div>
  );
}
