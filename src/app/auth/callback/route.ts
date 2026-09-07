import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Rückweg aus der Anmelde-Mail.
 *
 * Route Handler statt Server Action – begründete Ausnahme zur CLAUDE.md-Regel:
 * Supabase schickt den Nutzer per GET aus dem Mailprogramm hierher.
 *
 * Zwei Wege werden unterstützt, damit die App mit den Standard-Vorlagen
 * *und* mit den empfohlenen Token-Hash-Vorlagen funktioniert:
 *
 *   ?code=…                    PKCE, Supabase hat den Token bereits eingelöst
 *   ?token_hash=…&type=…       wir lösen ihn selbst ein (robuster gegen
 *                              Mail-Scanner, die Links vorab öffnen)
 */

const ERLAUBTE_TYPEN: EmailOtpType[] = [
  "signup",
  "magiclink",
  "email",
  "invite",
  "recovery",
  "email_change",
];

function zurueckZurAnmeldung(url: URL, grund: string) {
  const ziel = new URL("/anmelden", url.origin);
  ziel.searchParams.set("fehler", grund);
  return NextResponse.redirect(ziel);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const weiter = url.searchParams.get("weiter") ?? url.searchParams.get("redirect_to") ?? "/heute";
  // Nur app-interne Ziele, damit der Parameter keine offene Weiterleitung wird.
  const sicheresZiel = weiter.startsWith("/") && !weiter.startsWith("//") ? weiter : "/heute";

  const supabase = await createClient();

  const tokenHash = url.searchParams.get("token_hash");
  const typ = url.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && typ && ERLAUBTE_TYPEN.includes(typ)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typ });
    if (error) return zurueckZurAnmeldung(url, error.code ?? "ungueltig");
    return NextResponse.redirect(new URL(sicheresZiel, url.origin));
  }

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return zurueckZurAnmeldung(url, error.code ?? "ungueltig");
    return NextResponse.redirect(new URL(sicheresZiel, url.origin));
  }

  // Weder Code noch Token-Hash: Supabase hat den Grund vermutlich ins
  // Hash-Fragment geschrieben, das den Server nie erreicht. Die Anmeldeseite
  // liest es clientseitig aus.
  return zurueckZurAnmeldung(url, "kein-code");
}
