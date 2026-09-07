// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";

import { createChallenge, verifyChallenge } from "./challenge";

/**
 * Der Zwischenstand liegt in einem signierten Cookie statt in einer Tabelle.
 * Was diese Tests belegen müssen, ist deshalb nicht „das Cookie kommt zurück",
 * sondern: Ein selbst gebasteltes Cookie wird nicht akzeptiert. Besonders die
 * mitgeführten IDs – wer sie wählen könnte, schriebe ein Kind-Profil mit
 * fremder ID.
 */
describe("Zwischenstand im signierten Cookie", () => {
  beforeAll(() => {
    process.env.AUTH_COOKIE_SECRET ??= "test-geheimnis-mindestens-32-zeichen-lang";
  });

  test("erkennt das eigene Cookie wieder", () => {
    const { challenge, cookie } = createChallenge("login");
    expect(verifyChallenge("login", cookie)?.challenge).toBe(challenge);
  });

  test("führt Mitgegebenes unverändert mit", () => {
    const { cookie } = createChallenge("register", { studentId: "s-1", firstName: "Mia" });
    const read = verifyChallenge<{ studentId: string; firstName: string }>("register", cookie);
    expect(read).toMatchObject({ studentId: "s-1", firstName: "Mia" });
  });

  test("zwei Aufrufe liefern verschiedene Challenges", () => {
    expect(createChallenge("login").challenge).not.toBe(createChallenge("login").challenge);
  });

  test("weist eine veränderte Nutzlast zurück", () => {
    const { cookie } = createChallenge("register", { studentId: "meins" });
    const [payload, signature] = [
      cookie.slice(0, cookie.lastIndexOf(".")),
      cookie.split(".").at(-1),
    ];

    const content = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      studentId: string;
    };
    content.studentId = "fremde-id";
    const tampered = Buffer.from(JSON.stringify(content)).toString("base64url");

    expect(verifyChallenge("register", `${tampered}.${signature}`)).toBeNull();
  });

  test("ein Cookie fürs Registrieren taugt nicht zum Anmelden", () => {
    const { cookie } = createChallenge("register");
    expect(verifyChallenge("login", cookie)).toBeNull();
  });

  test("weist ein abgelaufenes Cookie zurück", () => {
    // Fünf Minuten Lebensdauer sind fest verdrahtet. Ein Cookie mit gültiger
    // Signatur, aber vergangenem Ablauf lässt sich nur von außen nicht bauen –
    // deshalb hier über die Uhr.
    const real = Date.now;
    Date.now = () => real() - 10 * 60 * 1000;
    const { cookie } = createChallenge("login");
    Date.now = real;

    expect(verifyChallenge("login", cookie)).toBeNull();
  });

  test("weist Unsinn zurück, statt zu werfen", () => {
    for (const value of [undefined, "", ".", "a.b", "nicht-base64.signatur"]) {
      expect(verifyChallenge("login", value)).toBeNull();
    }
  });
});
