/**
 * Die Content-Security-Policy (S-03a) – der letzte offene Punkt aus F-07.
 *
 * Die übrigen Sicherheits-Header stehen in `next.config.ts`, weil sie für
 * jede Antwort gleich lauten. Diese hier kann das nicht: Sie trägt ein
 * `nonce`, das je Anfrage neu gewürfelt wird, und entsteht deshalb im Proxy
 * (`src/proxy.ts`). Der Bau selbst steht hier, als reine Funktion – eine
 * Kopfzeile, die im Ernstfall die ganze App lahmlegt, soll prüfbar sein,
 * ohne dass ein Browser läuft.
 *
 * **Was die CSP hier wirklich abwehrt.** Der Tutor rendert Text, den ein
 * Sprachmodell geschrieben hat, als Markdown – und Markdown aus einer
 * fremden Quelle ist genau der Weg, auf dem sonst ein `<script>` in die
 * Seite kommt. `markdown.tsx` lässt kein rohes HTML durch, das ist die erste
 * Linie; die CSP ist die zweite, für den Fall, dass die erste einmal
 * nachgibt.
 */

/** Woher der Browser reden darf, außer mit uns selbst. */
export type CspUmgebung = {
  /**
   * Die Supabase-Adresse für `connect-src`: Die Anmeldung des Elternteils
   * läuft im Browser (`lib/supabase/client.ts`) und spricht direkt mit
   * Supabase. `null`, wenn nichts konfiguriert ist (CI-Build, lokaler Lauf
   * ohne `.env`) – dann steht sie schlicht nicht in der Liste.
   */
  supabaseUrl: string | null;
  /**
   * Entwicklungsmodus. React baut dort Fehler-Stacks mit `eval` nach, und
   * Next liefert seine Styles über JavaScript aus – beides ist in Produktion
   * nicht nötig und darf dort auch nicht erlaubt sein.
   */
  dev: boolean;
};

/**
 * Baut die Kopfzeile für **eine** Anfrage.
 *
 * Zu den Entscheidungen, die nicht selbsterklärend sind:
 *
 * - **`script-src` mit `nonce` und `strict-dynamic`**, nicht `'unsafe-inline'`.
 *   Next hängt seine eigenen Skripte an das `nonce`, das es aus dieser
 *   Kopfzeile liest; `strict-dynamic` erlaubt, was diese Skripte nachladen.
 *   Ein eingeschleustes `<script>` hat das `nonce` nicht und läuft nicht.
 *   Der Preis steht in der Next-Dokumentation: Seiten mit `nonce` müssen
 *   dynamisch gerendert werden. Für diese App kostet das nichts – jede Seite
 *   liest ohnehin die Sitzung und ist damit längst dynamisch.
 *
 * - **`style-src` mit `'unsafe-inline'`**, bewusst. KaTeX setzt seine
 *   Formeln über `style`-Attribute an den Elementen (`height`, `vertical-align`
 *   je Zeichen), und die Balken in `Auslastungsbalken`, `Mastery` und
 *   `SwipeRow` tun dasselbe mit `width` und `transform`. Ein `nonce` gilt für
 *   `<style>`-Elemente, nicht für `style`-Attribute – ohne `'unsafe-inline'`
 *   stünde jede Formel falsch und jeder Balken leer da. Der Gewinn wäre auch
 *   gering: Die Angriffe, gegen die diese Datei steht, brauchen
 *   **Skript**-Ausführung, und die bleibt gesperrt.
 *
 * - **`connect-src`** kennt nur uns selbst und Supabase. Der Anthropic-Aufruf
 *   steht ausdrücklich **nicht** darin: Er läuft auf dem Server (ADR 0010 D1),
 *   der Browser spricht nie direkt mit dem Modell. Stünde die Adresse hier,
 *   wäre das ein falsches Versprechen darüber, wie die App gebaut ist.
 *
 * - **`frame-ancestors 'none'`** doppelt sich mit `X-Frame-Options: DENY`
 *   aus `next.config.ts`. Das ist Absicht: Der alte Header ist der, den
 *   ältere Browser verstehen, dieser der, der zählt.
 */
export function baueCsp(nonce: string, { supabaseUrl, dev }: CspUmgebung): string {
  const verbindungen = ["'self'", ...(supabaseUrl ? [supabaseUrl] : [])];

  const regeln = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // `blob:` für die Foto-Vorschau (`URL.createObjectURL`, ADR 0007 D1),
    // `data:` für die verkleinerten Bilder aus `lib/image.ts`.
    "img-src 'self' blob: data:",
    // `next/font` lädt die Schriften zur Buildzeit herunter und liefert sie
    // von uns aus – keine Google-Adresse nötig. KaTeX bringt seine eigenen
    // mit, ebenfalls gebündelt.
    "font-src 'self'",
    `connect-src ${verbindungen.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // **Kein `upgrade-insecure-requests`** – und das ist keine Auslassung.
    //
    // Die Direktive hebt jede `http:`-Anfrage der Seite auf `https:`. In
    // Produktion tut sie damit nichts, was `Strict-Transport-Security`
    // (`next.config.ts`) nicht schon täte: Es gibt genau einen Origin, und
    // jede Unteranfrage geht relativ dorthin. Auf `http://localhost` dagegen
    // richtet sie Schaden an – WebKit nimmt localhost **nicht** von der
    // Aufwertung aus, hebt also auch `/_next/static/...` auf `https:` und
    // bekommt vom Entwicklungsserver einen TLS-Fehler. Ergebnis: eine Seite
    // ganz ohne JavaScript.
    //
    // Gefunden über 20 rote E2E-Tests, ausschließlich im `[mobile]`-Projekt
    // (iPhone 14, WebKit) – Chrome nimmt localhost aus, deshalb war
    // `[desktop]` durchgehend grün.
  ];

  return regeln.join("; ");
}

/**
 * Ein frisches `nonce` je Anfrage.
 *
 * `crypto.randomUUID()` statt einer eigenen Zufallsquelle: Der Wert muss
 * unvorhersagbar sein – wer ihn erraten kann, hebt die ganze Kopfzeile auf –
 * und die Web-Crypto-API ist die einzige, die im Edge-Runtime des Proxys
 * überhaupt zur Verfügung steht.
 */
export function neuesNonce(): string {
  return btoa(crypto.randomUUID());
}
