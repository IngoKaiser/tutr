"use client";

import { useActionState } from "react";

import { requestMagicLink, type MagicLinkResult } from "./actions";

export function MagicLinkForm() {
  const [result, submitAction, pending] = useActionState<MagicLinkResult | null, FormData>(
    requestMagicLink,
    null,
  );

  if (result?.status === "sent") {
    return (
      <div className="border-sicher bg-sicher-hell flex flex-col gap-2 rounded-[10px] border p-4">
        <p className="text-sicher text-sm font-semibold">Link ist unterwegs</p>
        <p className="text-tinte text-[0.8125rem]">
          Wir haben einen Anmeldelink an <strong>{result.email}</strong> geschickt. Er gilt eine
          Stunde. Du kannst dieses Fenster offen lassen.
        </p>
      </div>
    );
  }

  return (
    <form action={submitAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium">E-Mail-Adresse</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="du@beispiel.de"
          className="border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1"
        />
      </label>

      {result?.status === "error" ? (
        <p role="alert" className="text-offen text-[0.8125rem]">
          {result.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        // Leise statt königsblau: Auf der Anmeldeseite steht daneben der Weg
        // des Kindes, und zwei gleich starke Knöpfe hätten keine Rangfolge.
        className="border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief focus-visible:outline-koenigsblau rounded-[9px] border px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {pending ? "Wird verschickt …" : "Anmeldelink schicken"}
      </button>
    </form>
  );
}
