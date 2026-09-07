// @vitest-environment node
import { describe, expect, test } from "vitest";

import { hashToken, SESSION_DAYS, sessionCookieOptions } from "./student-session";

/**
 * Die Datenbankwege dieses Moduls deckt `src/db/schema/auth.test.ts` ab.
 * Hier steht das, was ohne Datenbank prüfbar ist – und was falsch zu haben
 * teuer wäre.
 */
describe("Gerätesitzung des Kindes", () => {
  test("speichert nie das Token selbst", () => {
    const token = "geheimes-token";
    const hash = hashToken(token);
    expect(hash).not.toContain(token);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toBe(hashToken("anderes-token"));
  });

  test("der Hash ist URL-sicher – er landet in SQL und in Logs", () => {
    expect(hashToken("x")).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("das Cookie ist httpOnly und same-site", () => {
    const options = sessionCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("das Fenster ist die in ADR 0005 beschlossene Länge", () => {
    expect(SESSION_DAYS).toBe(30);
    expect(sessionCookieOptions().maxAge).toBe(30 * 24 * 60 * 60);
  });
});
