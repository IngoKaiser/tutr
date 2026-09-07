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
 * 2. Im Cookie stehen die IDs, unter denen gleich das Profil entsteht.
 *    Dürfte der Client sie wählen, könnte er ein Kind-Profil mit fremder ID
 *    schreiben – die INSERT-Policy prüft nur gegen den Actor-Kontext, und der
 *    käme dann aus seiner Eingabe.
 */

const COOKIE_NAME = "tutr_webauthn";
const LIFETIME_MS = 5 * 60 * 1000;

export type ChallengePurpose = "register" | "login";

export const challengeCookieName = COOKIE_NAME;
export const challengeMaxAge = LIFETIME_MS / 1000;

type Content = { challenge: string; expiresAt: number };

function sign(purpose: ChallengePurpose, payload: string): string {
  return createHmac("sha256", authEnv().AUTH_COOKIE_SECRET)
    .update(`${purpose}.${payload}`)
    .digest("base64url");
}

/**
 * Erzeugt eine frische Challenge und den Cookie-Wert dazu. `remember` wandert
 * unverändert mit und kommt beim Prüfen zurück.
 */
export function createChallenge<T extends object = Record<string, never>>(
  purpose: ChallengePurpose,
  remember?: T,
): { challenge: string; bytes: Uint8Array<ArrayBuffer>; cookie: string } {
  // Zwei Darstellungen derselben Zufallszahl, und beide werden gebraucht:
  // `bytes` geht an @simplewebauthn (bekommt es eine Zeichenkette, kodiert es
  // sie ein zweites Mal, und die Prüfung schlägt fehl), `challenge` ist die
  // base64url-Fassung, die der Browser später zurückschickt.
  const raw = randomBytes(32);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  bytes.set(raw);
  const challenge = raw.toString("base64url");
  const content: Content & Partial<T> = {
    challenge,
    expiresAt: Date.now() + LIFETIME_MS,
    ...(remember ?? ({} as T)),
  };
  const payload = Buffer.from(JSON.stringify(content)).toString("base64url");
  return { challenge, bytes, cookie: `${payload}.${sign(purpose, payload)}` };
}

/**
 * Gibt Challenge und Mitgeführtes zurück, wenn das Cookie von uns stammt, zum
 * Zweck passt und noch lebt – sonst `null`. Der Signaturvergleich läuft in
 * konstanter Zeit.
 */
export function verifyChallenge<T extends object = Record<string, never>>(
  purpose: ChallengePurpose,
  cookie: string | undefined,
): ({ challenge: string } & T) | null {
  if (!cookie) return null;

  const separator = cookie.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = cookie.slice(0, separator);
  const providedSignature = cookie.slice(separator + 1);

  const expected = Buffer.from(sign(purpose, payload));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  let content: (Content & T) | null = null;
  try {
    content = JSON.parse(Buffer.from(payload, "base64url").toString()) as Content & T;
  } catch {
    return null;
  }

  if (!content?.challenge || typeof content.expiresAt !== "number") return null;
  if (content.expiresAt < Date.now()) return null;

  return content;
}
