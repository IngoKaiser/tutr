// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";

import { neueChallenge, pruefeChallenge } from "./challenge";

/**
 * Der Zwischenstand liegt in einem signierten Cookie statt in einer Tabelle.
 * Was diese Tests belegen müssen, ist deshalb nicht „das Cookie kommt zurück",
 * sondern: Ein selbst gebasteltes Cookie wird nicht akzeptiert. Besonders die
 * mitgeführten IDs – wer sie wählen könnte, schriebe ein Kind-Profil in eine
 * fremde Familie.
 */
describe("Zwischenstand im signierten Cookie", () => {
  beforeAll(() => {
    process.env.AUTH_COOKIE_SECRET ??= "test-geheimnis-mindestens-32-zeichen-lang";
  });

  test("erkennt das eigene Cookie wieder", () => {
    const { challenge, cookie } = neueChallenge("anmelden");
    expect(pruefeChallenge("anmelden", cookie)?.challenge).toBe(challenge);
  });

  test("führt Mitgegebenes unverändert mit", () => {
    const { cookie } = neueChallenge("registrieren", { familyId: "f-1", vorname: "Mia" });
    const gelesen = pruefeChallenge<{ familyId: string; vorname: string }>("registrieren", cookie);
    expect(gelesen).toMatchObject({ familyId: "f-1", vorname: "Mia" });
  });

  test("zwei Aufrufe liefern verschiedene Challenges", () => {
    expect(neueChallenge("anmelden").challenge).not.toBe(neueChallenge("anmelden").challenge);
  });

  test("weist eine veränderte Nutzlast zurück", () => {
    const { cookie } = neueChallenge("registrieren", { familyId: "meine" });
    const [nutzlast, signatur] = [
      cookie.slice(0, cookie.lastIndexOf(".")),
      cookie.split(".").at(-1),
    ];

    const inhalt = JSON.parse(Buffer.from(nutzlast, "base64url").toString()) as {
      familyId: string;
    };
    inhalt.familyId = "fremde-familie";
    const manipuliert = Buffer.from(JSON.stringify(inhalt)).toString("base64url");

    expect(pruefeChallenge("registrieren", `${manipuliert}.${signatur}`)).toBeNull();
  });

  test("ein Cookie fürs Registrieren taugt nicht zum Anmelden", () => {
    const { cookie } = neueChallenge("registrieren");
    expect(pruefeChallenge("anmelden", cookie)).toBeNull();
  });

  test("weist ein abgelaufenes Cookie zurück", () => {
    // Fünf Minuten Lebensdauer sind fest verdrahtet. Ein Cookie mit gültiger
    // Signatur, aber vergangenem Ablauf lässt sich nur von außen nicht bauen –
    // deshalb hier über die Uhr.
    const echt = Date.now;
    Date.now = () => echt() - 10 * 60 * 1000;
    const { cookie } = neueChallenge("anmelden");
    Date.now = echt;

    expect(pruefeChallenge("anmelden", cookie)).toBeNull();
  });

  test("weist Unsinn zurück, statt zu werfen", () => {
    for (const wert of [undefined, "", ".", "a.b", "nicht-base64.signatur"]) {
      expect(pruefeChallenge("anmelden", wert)).toBeNull();
    }
  });
});
