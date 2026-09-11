import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/student-session";
import { e2eActor } from "@/lib/dev-actor";
import { baueCsp, neuesNonce } from "@/lib/security/csp";
import { supabaseConfig } from "@/lib/supabase/config";

/**
 * Heißt in Next 16 `proxy.ts`, nicht mehr `middleware.ts` – die alte
 * Konvention ist veraltet.
 *
 * Drei Aufgaben, mehr nicht:
 * 1. Die Content-Security-Policy setzen (S-03a). Sie steht hier statt in
 *    `next.config.ts`, weil sie ein `nonce` trägt, das je Anfrage neu
 *    gewürfelt wird – siehe `lib/security/csp.ts`.
 * 2. Die Supabase-Session auffrischen, damit abgelaufene Tokens erneuert
 *    werden (der seit F-02 offene Punkt in `lib/supabase/server.ts`).
 * 3. Ein optimistischer Redirect auf die Anmeldung.
 *
 * Ausdrücklich *keine* Autorisierung. Next rät davon ab, und bei uns wäre es
 * ohnehin überflüssig: Die echte Grenze ist RLS – ohne Actor-Kontext liefert
 * die Datenbank nichts, egal welcher Weg hierher führt.
 *
 * **Warum der Proxy seit S-03a auch auf der Anmeldeseite läuft:** Die CSP
 * muss auf *jeder* HTML-Antwort stehen, sonst schützt sie ausgerechnet die
 * Seite nicht, auf der Fremde landen. Die Seiten ohne Anmeldung standen
 * deshalb vorher im `matcher`-Ausschluss und stehen jetzt in
 * `OHNE_ANMELDUNG` – aus einer Wegbeschreibung („hier läuft nichts") ist eine
 * Fallunterscheidung („hier läuft nur die Kopfzeile") geworden.
 */

/**
 * Seiten, die ohne Anmeldung erreichbar sein müssen.
 *
 * `wiederherstellen` (F-06d): Wer hier ankommt, hat per Definition noch keine
 * gültige Session – sonst bräuchte es den Link nicht. `konto-geloescht`
 * (F-06e) aus demselben Grund, nur umgekehrt: `logout()` ist schon gelaufen,
 * bevor der Redirect hierher zeigt – ohne diese Ausnahme überlebte die Seite
 * den Redirect auf `/anmelden` nie.
 */
const OHNE_ANMELDUNG = /^\/(anmelden|registrieren|wiederherstellen|konto-geloescht|auth)(\/|$)/;

export async function proxy(request: NextRequest) {
  const nonce = neuesNonce();
  const csp = baueCsp(nonce, {
    supabaseUrl: supabaseConfig()?.url ?? null,
    dev: process.env.NODE_ENV === "development",
  });

  /**
   * Weiterreichen – mit der CSP an **beiden** Enden.
   *
   * Auf der Antwort steht sie für den Browser. Auf der *Anfrage* liest Next
   * sie selbst aus, zieht das `nonce` heraus und hängt es an seine eigenen
   * Skript-Tags; ohne diesen zweiten Platz bliebe die Seite ohne JavaScript
   * stehen. Die Kopfzeilen werden bei jedem Aufruf neu aus `request` gebaut,
   * weil der Supabase-Zweig unten zwischendurch Cookies daran ändert.
   */
  const weiter = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    const antwort = NextResponse.next({ request: { headers } });
    antwort.headers.set("content-security-policy", csp);
    return antwort;
  };

  const zurAnmeldung = (weiterZu?: string) => {
    const target = request.nextUrl.clone();
    target.pathname = "/anmelden";
    if (weiterZu) target.searchParams.set("weiter", weiterZu);
    const antwort = NextResponse.redirect(target);
    antwort.headers.set("content-security-policy", csp);
    return antwort;
  };

  // Playwright meldet sich noch nicht echt an (F-10) – bis dahin diese
  // Umgehung, die es außerhalb der Produktion und nur mit gesetzter
  // Umgebungsvariable gibt. Die CSP gilt trotzdem: Sonst prüfte die E2E-Suite
  // eine App, die es so nicht gibt.
  if (e2eActor()) return weiter();

  if (OHNE_ANMELDUNG.test(request.nextUrl.pathname)) return weiter();

  // Das Kind meldet sich mit einem Passkey an, nicht über Supabase (F-06).
  // Optimistisch wie der Rest hier: dass das Cookie *gilt*, prüft
  // `actorFromSession()` – und danach ohnehin RLS.
  if (request.cookies.has(SESSION_COOKIE)) return weiter();

  const settings = supabaseConfig();
  const production = process.env.NODE_ENV === "production";

  if (!settings) {
    // Produktiv ist das eine Fehlkonfiguration: dann lieber die Anmeldung
    // zeigen als stillschweigend durchlassen. Sonst (Tests, lokaler Lauf
    // ohne .env) durchlassen – dort übernimmt der Dev-Actor.
    return production ? zurAnmeldung() : weiter();
  }

  let response = weiter();

  const supabase = createServerClient(settings.url, settings.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // `weiter()` liest `request.headers` frisch – die eben gesetzten
        // Cookies stehen darin schon drin.
        response = weiter();
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
  if (!user) return zurAnmeldung(request.nextUrl.pathname);

  return response;
}

export const config = {
  // Statische Dateien bleiben außen vor – sie tragen kein HTML und brauchen
  // keine CSP. `robots.txt` ausdrücklich mit dabei (D-01): Ohne die Ausnahme
  // leitete der Proxy auch sie auf `/anmelden` um, und ein Crawler bekäme
  // eine Weiterleitung statt der Datei – die Anweisung, ihn auszusperren,
  // käme nie an. Beim Entwickeln unsichtbar, weil der Dev-Actor-Bypass oben
  // den Proxy überspringt; erst der echte Deploy hat es gezeigt.
  //
  // Die Seiten ohne Anmeldung standen bis S-03a ebenfalls hier – sie stehen
  // jetzt in `OHNE_ANMELDUNG`, weil auch sie die CSP tragen müssen.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest.webmanifest|robots.txt).*)",
  ],
};
