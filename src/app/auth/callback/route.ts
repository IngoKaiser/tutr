import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Rückweg für den PKCE-Fluss: Supabase hat den Token bereits an seinem
 * eigenen Endpunkt eingelöst und schickt nur noch einen Code.
 *
 * Route Handler statt Server Action – begründete Ausnahme zur CLAUDE.md-Regel:
 * Supabase schickt den Nutzer per GET aus dem Mailprogramm hierher.
 *
 * Hier wird bewusst **kein** `token_hash` mehr angenommen. Das täte es früher,
 * ist aber ein GET, das einen Einmal-Token einlöst – genau der Weg, über den
 * Mailprogramme den Link vorab verbrauchen. Das Einlösen passiert
 * ausschließlich in `/anmelden/bestaetigen`, hinter einer abgeschickten Form.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const weiter = url.searchParams.get("weiter") ?? "/heute";
  // Nur app-interne Ziele, damit der Parameter keine offene Weiterleitung wird.
  const sicheresZiel = weiter.startsWith("/") && !weiter.startsWith("//") ? weiter : "/heute";

  const code = url.searchParams.get("code");
  if (!code) {
    const ziel = new URL("/anmelden", url.origin);
    ziel.searchParams.set("fehler", "kein-code");
    return NextResponse.redirect(ziel);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const ziel = new URL("/anmelden", url.origin);
    ziel.searchParams.set("fehler", error.code ?? "ungueltig");
    return NextResponse.redirect(ziel);
  }

  return NextResponse.redirect(new URL(sicheresZiel, url.origin));
}
