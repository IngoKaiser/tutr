import { describe, expect, it } from "vitest";

import { normalizeRotation } from "./image";

/**
 * Nur der reine Teil (V-10): `prepareImageForUpload()` selbst braucht ein
 * echtes Canvas und `createImageBitmap` – beides fehlt in jsdom, deshalb wird
 * der Bildweg wie schon in V-03b nicht im Unit-Test geprüft, sondern von Hand
 * gegen die echte Bilderkennung.
 */
describe("normalizeRotation", () => {
  it("lässt die vier rechten Winkel unverändert", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(270)).toBe(270);
  });

  it("wickelt über 360° hinaus zurück (viermal ↻ ist wieder gerade)", () => {
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
  });

  it("kommt mit negativen Werten klar", () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(-360)).toBe(0);
  });

  it("rundet krumme Werte auf den nächsten rechten Winkel", () => {
    expect(normalizeRotation(40)).toBe(0);
    expect(normalizeRotation(50)).toBe(90);
  });
});
