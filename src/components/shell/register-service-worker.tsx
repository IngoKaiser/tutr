"use client";

import { useEffect } from "react";

/**
 * Service-Worker-Registrierung (F-09a, ADR 0010).
 *
 * Nur in Produktion: `public/sw.js` entsteht ausschließlich im `postbuild`
 * (siehe `scripts/build-sw.mts`), gegen `next dev` existiert die Datei nie.
 * Registrierte man trotzdem, würde der Browser einen 404 als „leerer
 * Service Worker" interpretieren – kein Fehler, aber auch kein Nutzen, nur
 * Verwirrung beim Entwickeln.
 *
 * Der Rückweg ist genauso wichtig: Lief hier einmal `next start` gegen einen
 * echten Build, bleibt der Service Worker über einen Browser-Neustart
 * hinweg registriert – auch dann, wenn later wieder mit `next dev` (Turbopack)
 * gearbeitet wird. Ein alter Cache, der die neue Entwicklungsversion
 * überdeckt, ist genau die Art Fehler, die wie ein kaputtes Feature aussieht,
 * aber nur ein vergessener Service Worker ist. Deshalb räumt die
 * Entwicklungsumgebung aktiv auf, statt nur nichts Neues zu registrieren.
 *
 * `{ type: "module" }`: `sw.ts` ist ein Modul (siehe Kommentar dort), keine
 * klassische Skriptdatei.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { type: "module" }).catch(() => {
      // Kein Alarm, wenn die Registrierung scheitert (z. B. `public/sw.js`
      // fehlt, weil `postbuild` in dieser Umgebung nicht lief) – die App
      // funktioniert online unverändert, nur ohne Offline-Vorteil.
    });
  }, []);

  return null;
}
