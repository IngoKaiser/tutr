"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { anmeldungAbschliessen, anmeldungStarten } from "./passkey-actions";

/**
 * Anmeldung ohne Kennung (F-06). Ein Tipp, Face ID, drin – möglich nur, weil
 * der Passkey bei der Registrierung auffindbar angelegt wurde (ADR 0005).
 */
export function PasskeyAnmeldung() {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function anmelden() {
    setFehler(null);
    setLaeuft(true);
    try {
      const start = await anmeldungStarten();
      if (start.zustand === "fehler") {
        setFehler("Die Anmeldung ließ sich nicht starten.");
        return;
      }

      const antwort = await startAuthentication({
        optionsJSON: start.optionen as PublicKeyCredentialRequestOptionsJSON,
      });

      const fertig = await anmeldungAbschliessen(antwort);
      if (fertig.zustand === "fehler") {
        setFehler(fertig.meldung);
        return;
      }

      router.push("/heute");
    } catch (problem) {
      const name = problem instanceof Error ? problem.name : "";
      setFehler(
        name === "NotAllowedError"
          ? "Abgebrochen."
          : "Auf diesem Gerät ist kein Passkey für tutr hinterlegt.",
      );
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={anmelden}
        disabled={laeuft}
        className="bg-koenigsblau text-auf-koenigsblau focus-visible:outline-koenigsblau rounded-[9px] px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {laeuft ? "Einen Moment …" : "Mit Face ID anmelden"}
      </button>

      {fehler ? (
        <p role="alert" className="text-offen text-[0.8125rem]">
          {fehler}
        </p>
      ) : null}
    </div>
  );
}
