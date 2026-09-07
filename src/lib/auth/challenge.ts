import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { authEnv } from "@/lib/env";

/**
 * Der Zwischenstand zwischen „Optionen holen" und „Antwort prüfen" (F-06).
 *
 * Zu merken ist mindestens die WebAuthn-Challenge, bei der Registrierung
 * zusätzlich das Profil und die frisch erzeugten IDs. Die naheliegende Wahl
 * wäre eine Tabelle. Ein signiertes Cookie kommt ohne aus: Der Zwischenstand
 * ist ohnehin an genau diesen Browser gebunden, er lebt fünf Minuten, und er
 * hat keinen Wert, der eine Zeile rechtfertigt.
 *
 * Signiert werden muss er trotzdem, aus zwei Gründen:
 *
 * 1. Ein httpOnly-Cookie schützt nur vor JavaScript im Browser. Wer HTTP-
 *    Anfragen selbst baut, setzt den Cookie-Header frei – und eine selbst
 *    gewählte Challenge macht das Wiedereinspielen einer mitgeschnittenen
 *    Antwort möglich.
 * 2. Im Cookie stehen die IDs, unter denen gleich Familie und Profil
 *    entstehen. Dürfte der Client sie wählen, könnte er ein Kind-Profil in
 *    eine fremde Familie schreiben – die INSERT-Policy prüft nur gegen den
 *    Actor-Kontext, und der käme dann aus seiner Eingabe.
 */

const COOKIE_NAME = "tutr_webauthn";
const LEBENSDAUER_MS = 5 * 60 * 1000;

export type ChallengeZweck = "registrieren" | "anmelden";

export const challengeCookieName = COOKIE_NAME;
export const challengeMaxAge = LEBENSDAUER_MS / 1000;

type Inhalt = { challenge: string; ablauf: number };

function signatur(zweck: ChallengeZweck, nutzlast: string): string {
  return createHmac("sha256", authEnv().AUTH_COOKIE_SECRET)
    .update(`${zweck}.${nutzlast}`)
    .digest("base64url");
}

/**
 * Erzeugt eine frische Challenge und den Cookie-Wert dazu. `merken` wandert
 * unverändert mit und kommt beim Prüfen zurück.
 */
export function neueChallenge<T extends object = Record<string, never>>(
  zweck: ChallengeZweck,
  merken?: T,
): { challenge: string; bytes: Uint8Array<ArrayBuffer>; cookie: string } {
  // Zwei Darstellungen derselben Zufallszahl, und beide werden gebraucht:
  // `bytes` geht an @simplewebauthn (bekommt es eine Zeichenkette, kodiert es
  // sie ein zweites Mal, und die Prüfung schlägt fehl), `challenge` ist die
  // base64url-Fassung, die der Browser später zurückschickt.
  const roh = randomBytes(32);
  const bytes = new Uint8Array(new ArrayBuffer(roh.length));
  bytes.set(roh);
  const challenge = roh.toString("base64url");
  const inhalt: Inhalt & Partial<T> = {
    challenge,
    ablauf: Date.now() + LEBENSDAUER_MS,
    ...(merken ?? ({} as T)),
  };
  const nutzlast = Buffer.from(JSON.stringify(inhalt)).toString("base64url");
  return { challenge, bytes, cookie: `${nutzlast}.${signatur(zweck, nutzlast)}` };
}

/**
 * Gibt Challenge und Mitgeführtes zurück, wenn das Cookie von uns stammt, zum
 * Zweck passt und noch lebt – sonst `null`. Der Signaturvergleich läuft in
 * konstanter Zeit.
 */
export function pruefeChallenge<T extends object = Record<string, never>>(
  zweck: ChallengeZweck,
  cookie: string | undefined,
): ({ challenge: string } & T) | null {
  if (!cookie) return null;

  const trenner = cookie.lastIndexOf(".");
  if (trenner < 1) return null;
  const nutzlast = cookie.slice(0, trenner);
  const gelieferteSignatur = cookie.slice(trenner + 1);

  const erwartet = Buffer.from(signatur(zweck, nutzlast));
  const geliefert = Buffer.from(gelieferteSignatur);
  if (erwartet.length !== geliefert.length) return null;
  if (!timingSafeEqual(erwartet, geliefert)) return null;

  let inhalt: (Inhalt & T) | null = null;
  try {
    inhalt = JSON.parse(Buffer.from(nutzlast, "base64url").toString()) as Inhalt & T;
  } catch {
    return null;
  }

  if (!inhalt?.challenge || typeof inhalt.ablauf !== "number") return null;
  if (inhalt.ablauf < Date.now()) return null;

  return inhalt;
}
