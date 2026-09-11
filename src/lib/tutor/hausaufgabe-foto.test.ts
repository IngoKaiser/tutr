import {
  APIConnectionError,
  APIConnectionTimeoutError,
  BadRequestError,
  InternalServerError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { classifyHomeworkPhotoError } from "./hausaufgabe-foto";

describe("classifyHomeworkPhotoError", () => {
  // Echte SDK-Fehlerklassen, nicht nachgebaute Objekte – wie bei
  // `lib/vocab/photo.test.ts`.

  it("erkennt eine Zeitüberschreitung als vorübergehend", () => {
    const { fehler, ursache } = classifyHomeworkPhotoError(new APIConnectionTimeoutError());
    expect(fehler).toMatch(/zu lange gebraucht/);
    expect(ursache).toBe("Zeitüberschreitung");
  });

  it("erkennt einen Verbindungsabbruch als vorübergehend", () => {
    const { fehler } = classifyHomeworkPhotoError(
      new APIConnectionError({ message: "fetch failed" }),
    );
    expect(fehler).toMatch(/Verbindung.*abgebrochen/);
  });

  it("erkennt ein Rate Limit und nennt den Status in der Ursache", () => {
    const { fehler, ursache } = classifyHomeworkPhotoError(
      new RateLimitError(429, { message: "rate limited" }, "429", new Headers()),
    );
    expect(fehler).toMatch(/überlastet/);
    expect(ursache).toBe("Rate Limit (429)");
  });

  it("behandelt einen 5xx-Fehler als vorübergehend, nicht als Bild-Problem", () => {
    const { fehler } = classifyHomeworkPhotoError(
      new InternalServerError(503, { message: "overloaded" }, "503", new Headers()),
    );
    expect(fehler).toMatch(/nicht erreichbar/);
  });

  it("behandelt einen 4xx-Fehler wie den generischen Fehlschlag – ohne „tippe die Zeilen“, das gibt es hier nicht", () => {
    const { fehler } = classifyHomeworkPhotoError(
      new BadRequestError(400, { message: "bad image" }, "400", new Headers()),
    );
    expect(fehler).toBe(
      "Die Bilderkennung hat nicht geklappt. Versuch es mit einem schärferen Foto noch einmal.",
    );
  });

  it("fängt einen unerwarteten Fehler auf, statt zu werfen", () => {
    const { fehler, ursache } = classifyHomeworkPhotoError(
      new Error("irgendwas Unvorhergesehenes"),
    );
    expect(fehler).toBe("Die Bilderkennung hat nicht geklappt. Versuch es noch einmal.");
    expect(ursache).toBe("Error: irgendwas Unvorhergesehenes");
  });

  it("kommt auch mit etwas zurecht, das gar kein Error ist", () => {
    const { ursache } = classifyHomeworkPhotoError("kaputt");
    expect(ursache).toBe("kaputt");
  });
});
