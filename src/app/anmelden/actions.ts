"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export type AnmeldeErgebnis =
  { zustand: "gesendet"; email: string } | { zustand: "fehler"; meldung: string };

/**
 * Fordert einen Magic Link an.
 *
 * Die Fehlermeldung ist bewusst konkret: Der Versand läuft über Resend, und
 * ohne verifizierte Domain nimmt Resend nur die Adresse des eigenen Kontos an.
 * Ein stilles „Schau in dein Postfach" würde genau diesen Fall verschleiern.
 */
export async function magicLinkAnfordern(
  _vorher: AnmeldeErgebnis | null,
  formData: FormData,
): Promise<AnmeldeErgebnis> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { zustand: "fehler", meldung: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }

  const kopf = await headers();
  const herkunft = kopf.get("origin") ?? "http://localhost:3000";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${herkunft}/auth/callback` },
  });

  if (error) {
    return {
      zustand: "fehler",
      meldung: `Der Link konnte nicht verschickt werden: ${error.message}`,
    };
  }

  return { zustand: "gesendet", email };
}

export async function abmelden(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
