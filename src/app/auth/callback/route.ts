import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Rückweg des Magic Links: Code gegen Session tauschen.
 *
 * Route Handler statt Server Action – begründete Ausnahme zur CLAUDE.md-Regel
 * „Mutationen über Server Actions": Supabase schickt den Nutzer per GET aus
 * dem Mailprogramm hierher, dafür gibt es keine Server Action.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const weiter = url.searchParams.get("weiter") ?? "/heute";

  if (!code) {
    const ziel = new URL("/anmelden", url.origin);
    ziel.searchParams.set("fehler", "kein-code");
    return NextResponse.redirect(ziel);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const ziel = new URL("/anmelden", url.origin);
    ziel.searchParams.set("fehler", "abgelaufen");
    return NextResponse.redirect(ziel);
  }

  return NextResponse.redirect(new URL(weiter, url.origin));
}
