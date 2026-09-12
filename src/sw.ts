/// <reference lib="webworker" />

/**
 * Service Worker (F-09a, ADR 0010).
 *
 * Handgeschrieben, nicht über `serwist`s Laufzeitklasse – die schmale
 * Aufgabe hier (App-Shell vorcachen, damit ein Neuladen während der Übung
 * offline überlebt) braucht keine Strategie-Abstraktion, und `serwist`
 * liefert nur ESM, das Bündeln bräuchte einen eigenen Bundler (siehe ADR
 * 0010 Nachtrag). `@serwist/build` liefert nur das Vorcache-Manifest, sonst
 * nichts – das Verhalten steht hier, vollständig lesbar.
 *
 * `export {}` macht die Datei zu einem Modul, nicht zu einem globalen
 * Skript – nur so lässt sich `self` unten lokal auf `ServiceWorkerGlobalScope`
 * eintypen, ohne mit der Ambient-Deklaration aus `lib.webworker.d.ts` zu
 * kollidieren (bekanntes TS-Muster für Service Worker). Folge: Registrierung
 * im Client mit `{ type: "module" }`.
 */
export {};

declare const self: ServiceWorkerGlobalScope & {
  /** Von `@serwist/build`s `injectManifest()` textuell ersetzt. */
  __SW_MANIFEST: { url: string; revision: string | null }[];
};

/**
 * Von `scripts/build-sw.mts` textuell ersetzt, bevor `injectManifest()`
 * läuft – ein Cache je Next-Build (`BUILD_ID`), nie einer, der über einen
 * Deploy hinweg denselben Namen behält. Ohne das würde `activate` unten nie
 * etwas zum Aufräumen finden.
 */
const CACHE_NAME = "tutr-shell-__BUILD_ID__";
const CACHE_PREFIX = "tutr-shell-";

const PRECACHE_URLS = new Set(self.__SW_MANIFEST.map((entry) => entry.url));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([...PRECACHE_URLS])));
  // Sofort aktiv statt auf den nächsten Seitenaufruf zu warten – bei einem
  // Ein-Personen-Gerät ohne mehrere offene Tabs kein Risiko.
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
  void self.clients.claim();
});

/**
 * Cache-first, aber **nur** für vorgecachte App-Shell-Dateien (die
 * Next-Chunks aus `.next/static`). Alles andere (Seiten, Server Actions,
 * API-Antworten) geht unverändert übers Netz – dieser Service Worker
 * entscheidet nicht, ob eine Antwort aktuell ist, er hält nur die
 * Shell verfügbar. Die Offline-Antwortwarteschlange fürs eigentliche Üben
 * (F-09b) ist bewusst kein Service-Worker-Feature, siehe ADR 0010.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !PRECACHE_URLS.has(url.pathname)) return;

  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});
