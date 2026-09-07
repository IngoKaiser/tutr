"use client";

import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CONSENT_NOTICE } from "@/lib/mail/consent";

import { completeRegistration, startRegistration as startRegistrationAction } from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/**
 * Selbstanlage des Profils (F-06).
 *
 * Kein `useActionState`: Zwischen den beiden Server Actions muss der Browser
 * seinen eigenen Dialog zeigen (Face ID), und der lässt sich nur aus einem
 * Klick heraus öffnen – nicht aus einem Server-Roundtrip heraus.
 */
export function RegistrationForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSubmitting(true);
    try {
      const start = await startRegistrationAction(null, formData);
      if (start.status === "error") {
        setError(start.message);
        return;
      }

      const response = await startRegistration({
        optionsJSON: start.options as PublicKeyCredentialCreationOptionsJSON,
      });

      const completion = await completeRegistration(response);
      if (completion.status === "error") {
        setError(completion.message);
        return;
      }

      router.push("/heute");
    } catch (problem) {
      // Abbruch im Face-ID-Dialog ist der häufigste Fall und kein Fehler des
      // Kindes – entsprechend formuliert.
      const name = problem instanceof Error ? problem.name : "";
      setError(
        name === "NotAllowedError"
          ? "Abgebrochen. Tipp noch einmal auf „Profil anlegen“, wenn du so weit bist."
          : "Dein Gerät konnte keinen Passkey anlegen. Probier es in einem anderen Browser.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Vorname</span>
        <input name="firstName" required autoFocus maxLength={40} className={FIELD} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Jahrgang</span>
        <select name="gradeLevel" required defaultValue="8" className={FIELD}>
          {Array.from({ length: 9 }, (_, i) => i + 5).map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">E-Mail deiner Eltern</span>
        <input
          type="email"
          name="parentEmail"
          required
          autoComplete="off"
          placeholder="mama@beispiel.de"
          className={FIELD}
        />
        <span className="text-tinte-leise text-[0.75rem] leading-normal">{CONSENT_NOTICE}</span>
      </label>

      {error ? (
        <p role="alert" className="text-offen text-[0.8125rem]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="bg-koenigsblau text-auf-koenigsblau focus-visible:outline-koenigsblau rounded-[9px] px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {submitting ? "Einen Moment …" : "Profil anlegen"}
      </button>
    </form>
  );
}
