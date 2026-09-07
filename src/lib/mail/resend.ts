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
 * `resendRestriction()` es der Entwicklungsumgebung laut.
 */

const ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "tutr <onboarding@resend.dev>";

export type SendResult =
  { status: "sent" } | { status: "not-configured" } | { status: "error"; message: string };

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Ein Satz für die Entwicklungsumgebung, oder `null`, wenn alles eingerichtet
 * ist. Steht in der Oberfläche, nicht nur im Log – sonst fällt es erst auf,
 * wenn eine echte Elternadresse ins Leere läuft.
 */
export function resendRestriction(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  if (!resendConfigured()) {
    return "RESEND_API_KEY fehlt – die Einwilligungsmail wird nicht verschickt.";
  }
  const from = process.env.RESEND_FROM ?? DEFAULT_FROM;
  if (from.includes("@resend.dev")) {
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
export async function sendMail(mail: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendResult> {
  try {
    const { RESEND_API_KEY: apiKey, RESEND_FROM: from } = mailEnv();
    if (!apiKey) return { status: "not-configured" };

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from ?? DEFAULT_FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
    });

    if (!response.ok) {
      // Der Text von Resend nennt den Grund (unverifizierte Domain, fremder
      // Empfänger). Der Schlüssel steht nur im Header, geht also nicht mit.
      return { status: "error", message: `${response.status}: ${await response.text()}` };
    }
    return { status: "sent" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "unbekannt" };
  }
}
