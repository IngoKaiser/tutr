"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const ERLAUBTE_TYPEN: EmailOtpType[] = [
  "signup",
  "magiclink",
  "email",
  "invite",
  "recovery",
  "email_change",
];

/**
 * Löst den Anmelde-Token ein. Bewusst eine Server Action und **kein** GET:
 * Ein Vorab-Öffner im Mailprogramm macht nur GET-Anfragen. Solange das Einlösen
 * an eine abgeschickte Form gebunden ist, kann er den Einmal-Token nicht
 * verbrauchen.
 */
export async function anmeldungBestaetigen(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const typ = String(formData.get("type") ?? "") as EmailOtpType;
  const weiter = String(formData.get("weiter") ?? "/heute");
  const sicheresZiel = weiter.startsWith("/") && !weiter.startsWith("//") ? weiter : "/heute";

  if (!tokenHash || !ERLAUBTE_TYPEN.includes(typ)) {
    redirect("/anmelden?fehler=kein-code");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typ });

  if (error) {
    redirect(`/anmelden?fehler=${encodeURIComponent(error.code ?? "ungueltig")}`);
  }

  redirect(sicheresZiel);
}
