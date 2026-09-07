import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { authEnv } from "@/lib/env";

/**
 * Die WebAuthn-Challenge zwischen „Optionen holen" und „Antwort prüfen" (F-06).
 *
 * Sie muss irgendwo liegen, und die naheliegende Wahl wäre eine Tabelle. Ein
 * signiertes Cookie kommt hier ohne aus: Die Challenge ist ohnehin an genau
 * diesen Browser gebunden, sie lebt fünf Minuten, und sie hat keinen Wert,
 * der eine Zeile rechtfertigt.
 *
 * Signiert werden muss sie trotzdem. Ein httpOnly-Cookie schützt nur vor
 * JavaScript im Browser – wer HTTP-Anfragen selbst baut, setzt den
 * Cookie-Header frei. Eine selbst gewählte Challenge wiederum macht das
 * Wiedereinspielen einer mitgeschnittenen Antwort möglich. Die HMAC schließt
 * genau das: Nur eine Challenge, die dieser Server erzeugt hat, wird geprüft.
 */

const COOKIE_NAME = "tutr_webauthn";
const LEBENSDAUER_MS = 5 * 60 * 1000;

export type ChallengeZweck = "registrieren" | "anmelden";

export const challengeCookieName = COOKIE_NAME;
export const challengeMaxAge = LEBENSDAUER_MS / 1000;

function signatur(zweck: ChallengeZweck, challenge: string, ablauf: number): string {
  return createHmac("sha256", authEnv().AUTH_COOKIE_SECRET)
    .update(`${zweck}.${challenge}.${ablauf}`)
    .digest("base64url");
}

/** Erzeugt eine frische Challenge und den dazu passenden Cookie-Wert. */
export function neueChallenge(zweck: ChallengeZweck): { challenge: string; cookie: string } {
  // Base64url ohne Polsterung – genau das Format, das WebAuthn erwartet.
  const challenge = Buffer.from(randomUUID() + randomUUID()).toString("base64url");
  const ablauf = Date.now() + LEBENSDAUER_MS;
  return {
    challenge,
    cookie: `${zweck}.${challenge}.${ablauf}.${signatur(zweck, challenge, ablauf)}`,
  };
}

/**
 * Gibt die Challenge zurück, wenn das Cookie von uns stammt, zum Zweck passt
 * und noch lebt – sonst `null`. Der Vergleich läuft in konstanter Zeit.
 */
export function pruefeChallenge(zweck: ChallengeZweck, cookie: string | undefined): string | null {
  if (!cookie) return null;

  const teile = cookie.split(".");
  if (teile.length !== 4) return null;
  const [gelesenerZweck, challenge, ablaufText, gelieferteSignatur] = teile;

  if (gelesenerZweck !== zweck) return null;

  const ablauf = Number(ablaufText);
  if (!Number.isFinite(ablauf) || ablauf < Date.now()) return null;

  const erwartet = Buffer.from(signatur(zweck, challenge, ablauf));
  const geliefert = Buffer.from(gelieferteSignatur);
  if (erwartet.length !== geliefert.length) return null;
  if (!timingSafeEqual(erwartet, geliefert)) return null;

  return challenge;
}
