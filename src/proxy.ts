import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/student-session";
import { e2eActor } from "@/lib/dev-actor";
import { supabaseConfig } from "@/lib/supabase/config";

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
  let response = NextResponse.next({ request });
  // Playwright meldet sich noch nicht echt an (F-10) – bis dahin diese
  // Umgehung, die es außerhalb der Produktion und nur mit gesetzter
  // Umgebungsvariable gibt.
  if (e2eActor()) return response;

  // Das Kind meldet sich mit einem Passkey an, nicht über Supabase (F-06).
  // Optimistisch wie der Rest hier: dass das Cookie *gilt*, prüft
  // `actorFromSession()` – und danach ohnehin RLS.
  if (request.cookies.has(SESSION_COOKIE)) return response;

  const settings = supabaseConfig();
  const production = process.env.NODE_ENV === "production";

  if (!settings) {
    // Produktiv ist das eine Fehlkonfiguration: dann lieber die Anmeldung
    // zeigen als stillschweigend durchlassen. Sonst (Tests, lokaler Lauf
    // ohne .env) durchlassen – dort übernimmt der Dev-Actor.
    if (!production) return response;
    const target = request.nextUrl.clone();
    target.pathname = "/anmelden";
    return NextResponse.redirect(target);
  }

  const supabase = createServerClient(settings.url, settings.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
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
    const target = request.nextUrl.clone();
    target.pathname = "/anmelden";
    target.searchParams.set("weiter", request.nextUrl.pathname);
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  // Anmeldung, Auth-Rückweg und statische Dateien bleiben außen vor.
  matcher: [
    "/((?!anmelden|registrieren|auth|_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest.webmanifest).*)",
  ],
};
