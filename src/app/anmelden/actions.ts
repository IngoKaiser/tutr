"use server";

import { cookies, headers } from "next/headers";

import { revokeSession, SESSION_COOKIE } from "@/lib/auth/student-session";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkResult =
  { status: "sent"; email: string } | { status: "error"; message: string };

/**
 * Fordert einen Magic Link an.
 *
 * Die Fehlermeldung ist bewusst konkret: Der Versand läuft über Resend, und
 * ohne verifizierte Domain nimmt Resend nur die Adresse des eigenen Kontos an.
 * Ein stilles „Schau in dein Postfach" würde genau diesen Fall verschleiern.
 */
export async function requestMagicLink(
  _previous: MagicLinkResult | null,
  formData: FormData,
): Promise<MagicLinkResult> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { status: "error", message: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }

  const headerList = await headers();
  const origin = headerList.get("origin") ?? "http://localhost:3000";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return {
      status: "error",
      message: `Der Link konnte nicht verschickt werden: ${error.message}`,
    };
  }

  return { status: "sent", email };
}

/**
 * Abmelden gilt für beide Wege: Ein Browser kann eine Eltern-Session und eine
 * Kind-Session tragen, und „Abmelden" muss beide beenden – sonst führt der
 * Knopf sichtbar nichts aus.
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const studentToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (studentToken) {
    // Setzt `revoked_at`, damit die Geräteliste den Vorgang zeigt (F-06b).
    await revokeSession(studentToken);
    cookieStore.delete(SESSION_COOKIE);
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
}
