"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = [
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
export async function confirmLogin(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;
  // `weiter` bleibt deutsch: der Wert wandert durch die sichtbare URL.
  const next = String(formData.get("weiter") ?? "/heute");
  const safeTarget = next.startsWith("/") && !next.startsWith("//") ? next : "/heute";

  if (!tokenHash || !ALLOWED_TYPES.includes(type)) {
    redirect("/anmelden?fehler=kein-code");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    redirect(`/anmelden?fehler=${encodeURIComponent(error.code ?? "ungueltig")}`);
  }

  redirect(safeTarget);
}
