// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";

import { neueChallenge, pruefeChallenge } from "./challenge";

/**
 * Die Challenge liegt in einem signierten Cookie statt in einer Tabelle. Was
 * diese Tests belegen müssen, ist deshalb nicht „das Cookie kommt zurück",
 * sondern: Ein selbst gebasteltes Cookie wird nicht akzeptiert.
 */
describe("WebAuthn-Challenge im signierten Cookie", () => {
  beforeAll(() => {
    process.env.AUTH_COOKIE_SECRET ??= "test-geheimnis-mindestens-32-zeichen-lang";
  });

  test("erkennt das eigene Cookie wieder", () => {
    const { challenge, cookie } = neueChallenge("registrieren");
    expect(pruefeChallenge("registrieren", cookie)).toBe(challenge);
  });

  test("zwei Aufrufe liefern verschiedene Challenges", () => {
    expect(neueChallenge("anmelden").challenge).not.toBe(neueChallenge("anmelden").challenge);
  });

  test("weist eine Challenge zurück, die nicht von uns stammt", () => {
    const { cookie } = neueChallenge("anmelden");
    const [, , ablauf, signatur] = cookie.split(".");
    const gefaelscht = ["anmelden", "selbst-ausgedacht", ablauf, signatur].join(".");
    expect(pruefeChallenge("anmelden", gefaelscht)).toBeNull();
  });

  test("weist eine veränderte Ablaufzeit zurück", () => {
    const { challenge, cookie } = neueChallenge("anmelden");
    const signatur = cookie.split(".")[3];
    const verlaengert = ["anmelden", challenge, String(Date.now() + 10 ** 9), signatur].join(".");
    expect(pruefeChallenge("anmelden", verlaengert)).toBeNull();
  });

  test("ein Cookie fürs Registrieren taugt nicht zum Anmelden", () => {
    const { cookie } = neueChallenge("registrieren");
    expect(pruefeChallenge("anmelden", cookie)).toBeNull();
  });

  test("weist ein abgelaufenes Cookie zurück", () => {
    // Fünf Minuten Lebensdauer sind fest verdrahtet, also von Hand nachbauen:
    // ein Cookie mit korrekter Signatur, aber vergangenem Ablauf.
    const { challenge } = neueChallenge("anmelden");
    const abgelaufen = ["anmelden", challenge, String(Date.now() - 1000), "egal"].join(".");
    expect(pruefeChallenge("anmelden", abgelaufen)).toBeNull();
  });

  test("weist Unsinn zurück, statt zu werfen", () => {
    for (const wert of [undefined, "", "a.b", "a.b.c.d.e"]) {
      expect(pruefeChallenge("anmelden", wert)).toBeNull();
    }
  });
});
