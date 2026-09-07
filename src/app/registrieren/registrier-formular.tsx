"use client";

import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EINWILLIGUNGSHINWEIS } from "@/lib/mail/einwilligung";

import { registrierungAbschliessen, registrierungStarten } from "./actions";

const FELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/**
 * Selbstanlage des Profils (F-06).
 *
 * Kein `useActionState`: Zwischen den beiden Server Actions muss der Browser
 * seinen eigenen Dialog zeigen (Face ID), und der lässt sich nur aus einem
 * Klick heraus öffnen – nicht aus einem Server-Roundtrip heraus.
 */
export function RegistrierFormular() {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(formData: FormData) {
    setFehler(null);
    setLaeuft(true);
    try {
      const start = await registrierungStarten(null, formData);
      if (start.zustand === "fehler") {
        setFehler(start.meldung);
        return;
      }

      const antwort = await startRegistration({
        optionsJSON: start.optionen as PublicKeyCredentialCreationOptionsJSON,
      });

      const fertig = await registrierungAbschliessen(antwort);
      if (fertig.zustand === "fehler") {
        setFehler(fertig.meldung);
        return;
      }

      router.push("/heute");
    } catch (problem) {
      // Abbruch im Face-ID-Dialog ist der häufigste Fall und kein Fehler des
      // Kindes – entsprechend formuliert.
      const name = problem instanceof Error ? problem.name : "";
      setFehler(
        name === "NotAllowedError"
          ? "Abgebrochen. Tipp noch einmal auf „Profil anlegen“, wenn du so weit bist."
          : "Dein Gerät konnte keinen Passkey anlegen. Probier es in einem anderen Browser.",
      );
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form action={absenden} className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Vorname</span>
        <input name="vorname" required autoFocus maxLength={40} className={FELD} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">Jahrgang</span>
        <select name="jahrgang" required defaultValue="8" className={FELD}>
          {Array.from({ length: 9 }, (_, i) => i + 5).map((jahr) => (
            <option key={jahr} value={jahr}>
              {jahr}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">E-Mail deiner Eltern</span>
        <input
          type="email"
          name="elternMail"
          required
          autoComplete="off"
          placeholder="mama@beispiel.de"
          className={FELD}
        />
        <span className="text-tinte-leise text-[0.75rem] leading-normal">
          {EINWILLIGUNGSHINWEIS}
        </span>
      </label>

      {fehler ? (
        <p role="alert" className="text-offen text-[0.8125rem]">
          {fehler}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={laeuft}
        className="bg-koenigsblau text-auf-koenigsblau focus-visible:outline-koenigsblau rounded-[9px] px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {laeuft ? "Einen Moment …" : "Profil anlegen"}
      </button>
    </form>
  );
}
