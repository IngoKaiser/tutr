import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegisterServiceWorker } from "./register-service-worker";

/**
 * F-09a (ADR 0015): Registrierung nur in Produktion, in Entwicklung aktiv
 * abräumen – kein E2E dafür, `public/sw.js` entsteht erst im `postbuild`
 * (siehe scripts/build-sw.mts), gegen `next dev` gibt es die Datei nie. Der
 * echte Registrierungs-/Precache-/Offline-Weg ist von Hand gegen einen
 * echten `next build && next start` geprüft (siehe docs/PLAN.md F-09a).
 */
describe("RegisterServiceWorker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("registriert in Produktion mit type: module unter /sw.js", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { serviceWorker: { register } });

    render(<RegisterServiceWorker />);
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith("/sw.js", { type: "module" });
  });

  it("räumt in Entwicklung eine bestehende Registrierung ab, statt neu zu registrieren", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const unregister = vi.fn().mockResolvedValue(true);
    const register = vi.fn();
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
    vi.stubGlobal("navigator", { serviceWorker: { register, getRegistrations } });

    render(<RegisterServiceWorker />);
    await Promise.resolve();
    await Promise.resolve();

    expect(getRegistrations).toHaveBeenCalled();
    expect(unregister).toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it("ohne Service-Worker-Unterstützung passiert nichts", () => {
    vi.stubGlobal("navigator", {});
    expect(() => render(<RegisterServiceWorker />)).not.toThrow();
  });
});
