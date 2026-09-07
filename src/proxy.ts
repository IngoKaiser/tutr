import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { e2eActor } from "@/lib/dev-actor";
import { supabaseKonfiguration } from "@/lib/supabase/konfiguration";

/**
 * Heißt in Next 16 `proxy.ts`, nicht mehr `middleware.ts` – die alte
 * Konvention ist veraltet.
 *
 * Zwei Aufgaben, mehr nicht:
 * 1. Die Supabase-Session auffrischen, damit abgelaufene Tokens erneuert
 *    werden (der seit F-02 offene Punkt in `lib/supabase/server.ts`).
 * 2. Ein optimistischer Redirect auf die Anmeldung.
 *
 * Ausdrücklich *keine* Autorisierung. Next rät davon ab, und bei uns wäre es
 * ohnehin überflüssig: Die echte Grenze ist RLS – ohne Actor-Kontext liefert
 * die Datenbank nichts, egal welcher Weg hierher führt.
 */
export async function proxy(request: NextRequest) {
  let antwort = NextResponse.next({ request });
  // Playwright meldet sich noch nicht echt an (F-10) – bis dahin diese
  // Umgehung, die es außerhalb der Produktion und nur mit gesetzter
  // Umgebungsvariable gibt.
  if (e2eActor()) return antwort;

  const konfiguration = supabaseKonfiguration();
  const produktiv = process.env.NODE_ENV === "production";

  if (!konfiguration) {
    // Produktiv ist das eine Fehlkonfiguration: dann lieber die Anmeldung
    // zeigen als stillschweigend durchlassen. Sonst (Tests, lokaler Lauf
    // ohne .env) durchlassen – dort übernimmt der Dev-Actor.
    if (!produktiv) return antwort;
    const ziel = request.nextUrl.clone();
    ziel.pathname = "/anmelden";
    return NextResponse.redirect(ziel);
  }

  const supabase = createServerClient(konfiguration.url, konfiguration.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        antwort = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          antwort.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anmeldung ist die Tür – in jeder Umgebung. Der Ansichts-Umschalter für
  // die Kind-Sicht sitzt dahinter, nicht davor.
  if (!user) {
    const ziel = request.nextUrl.clone();
    ziel.pathname = "/anmelden";
    ziel.searchParams.set("weiter", request.nextUrl.pathname);
    return NextResponse.redirect(ziel);
  }

  return antwort;
}

export const config = {
  // Anmeldung, Auth-Rückweg und statische Dateien bleiben außen vor.
  matcher: [
    "/((?!anmelden|auth|_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest.webmanifest).*)",
  ],
};
