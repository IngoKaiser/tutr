import { mailEnv } from "@/lib/env";

/**
 * E-Mail-Versand über die Resend-API.
 *
 * Bewusst per `fetch` statt über das npm-Paket: Es ist ein POST auf einen
 * Endpunkt. Eine Abhängigkeit dafür trüge nichts bei.
 *
 * Ohne verifizierte Domain nimmt Resend nur `onboarding@resend.dev` als
 * Absender an – und liefert nur an die Adresse des eigenen Resend-Kontos aus.
 * Das ist beim Entwickeln in Ordnung, aber leicht zu vergessen, deshalb sagt
 * `resendEinschraenkung()` es der Entwicklungsumgebung laut.
 */

const ENDPUNKT = "https://api.resend.com/emails";
const STANDARD_ABSENDER = "tutr <onboarding@resend.dev>";

export type MailErgebnis =
  | { zustand: "gesendet" }
  | { zustand: "nicht-konfiguriert" }
  | { zustand: "fehler"; meldung: string };

export function resendKonfiguriert(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Ein Satz für die Entwicklungsumgebung, oder `null`, wenn alles eingerichtet
 * ist. Steht in der Oberfläche, nicht nur im Log – sonst fällt es erst auf,
 * wenn eine echte Elternadresse ins Leere läuft.
 */
export function resendEinschraenkung(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  if (!resendKonfiguriert()) {
    return "RESEND_API_KEY fehlt – die Einwilligungsmail wird nicht verschickt.";
  }
  const absender = process.env.RESEND_FROM ?? STANDARD_ABSENDER;
  if (absender.includes("@resend.dev")) {
    return (
      "Resend hat keine verifizierte Domain: Absender ist onboarding@resend.dev, " +
      "und zugestellt wird nur an die Adresse deines Resend-Kontos. " +
      "Eine echte Elternadresse erreicht die Einwilligungsmail so nicht."
    );
  }
  return null;
}

/**
 * Wirft nie. Ein Ausfall beim Versand darf keinen Ablauf abbrechen – die
 * Einwilligungsmail hält nach ADR 0005 ausdrücklich niemanden auf.
 */
export async function sendeMail(mail: {
  an: string;
  betreff: string;
  text: string;
}): Promise<MailErgebnis> {
  try {
    const { RESEND_API_KEY: schluessel, RESEND_FROM: absender } = mailEnv();
    if (!schluessel) return { zustand: "nicht-konfiguriert" };

    const antwort = await fetch(ENDPUNKT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schluessel}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: absender ?? STANDARD_ABSENDER,
        to: [mail.an],
        subject: mail.betreff,
        text: mail.text,
      }),
    });

    if (!antwort.ok) {
      // Der Text von Resend nennt den Grund (unverifizierte Domain, fremder
      // Empfänger). Der Schlüssel steht nur im Header, geht also nicht mit.
      return { zustand: "fehler", meldung: `${antwort.status}: ${await antwort.text()}` };
    }
    return { zustand: "gesendet" };
  } catch (fehler) {
    return { zustand: "fehler", meldung: fehler instanceof Error ? fehler.message : "unbekannt" };
  }
}
