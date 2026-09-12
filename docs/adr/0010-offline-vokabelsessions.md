# ADR 0010: Offline-Vokabelsessions ohne Server-Bruch

Status: **akzeptiert** · Datum: 2026-09-12 · Bezug: docs/konzept.md §11, §6 M4 (V-02/V-04) · Ticket: F-09

## Kontext

§11 verlangt „PWA via `@serwist/next`; Offline-Shell + IndexedDB für Karten-Sessions" und,
im Auth-Abschnitt: „Karten-Sessions laufen auch ohne Netz; die Session bleibt gültig, Sync
bei Rückkehr." CLAUDE.md nennt `@serwist/next` als Stack-Entscheidung.

F-07 hat den Service Worker herausgelöst zu F-09, mit zwei offenen Punkten: erst sinnvoll,
wenn es etwas zu cachen gibt (V-02, jetzt gebaut), und eine Bundler-Frage, weil
„`@serwist/next` braucht Webpack, Next 16 baut mit Turbopack".

**Die Bundler-Frage ist inzwischen konkreter, nicht kleiner:** Next 16 macht Turbopack zum
**Standard-Bundler für `dev` und `build`**. Ein `webpack()`-Eintrag in `next.config.js` wird
von Turbopack schlicht **nicht erkannt** – keine Fehlermeldung, er läuft nur nie
(`node_modules/next/dist/docs/.../08-turbopack.md`: „Turbopack replaces webpack, so
`webpack()` configs are not recognized."). `@serwist/next` hängt sich exakt in diesen Hook.
Der einzige Weg zurück zu Webpack ist der komplette Umstieg über `next build --webpack` /
`next dev --webpack` – nicht ein Zusatz neben Turbopack, sondern ein Ersatz dafür.

Eine zweite, tiefere Frage liegt unter der ersten: V-02 hat festgelegt, dass **der Server
jede Antwort bewertet, nie der Client** (Manipulationsschutz – ein präparierter Aufruf
könnte sonst jede Karte als „Kann ich" durchwinken). Das steht scheinbar quer zu „läuft ohne
Netz": Ohne Netz gibt es keinen Server, der bewerten könnte. Diese Frage beantwortet dieser
ADR mit, nicht nur die Bundler-Frage – eine Entscheidung ohne die andere wäre nur die halbe
Arbeit.

## Entscheidung 1 – Bundler

### Option A: `next build --webpack` fürs Deployment, `next dev` bleibt Turbopack

Serwist funktioniert wie dokumentiert. Aber Entwicklung und Produktivbuild liefen dauerhaft
auf zwei verschiedenen Bundlern – Turbopack-exklusive Features (`import.meta.glob`,
`import.meta.env`) wären in der Entwicklung nutzbar, in Produktion ein Build-Fehler, der
erst beim Deploy auffällt, nicht in `npm run check`. Dazu dokumentierte
Verhaltensunterschiede (CSS-Modul-Reihenfolge, Dezimalpräzision bei Sass, keine
`sassOptions.functions`). Verwirft die eigentliche Motivation für Turbopack genau an der
Stelle, an der Korrektheit am meisten zählt: dem, was tatsächlich deployt wird.

### Option B: `--webpack` für beides, dev und build

Konsistent, aber ein vollständiger Rückschritt hinter den Next-16-Standard – langsamere
lokale Entwicklung, gegen CLAUDE.mds unbedingte Nennung von „Next.js 16".

### Option C: Serwist behalten, vom Next-Bundler entkoppeln (empfohlen)

Serwist selbst ist nicht an Webpack gebunden – `@serwist/next` ist nur einer von mehreren
Adaptern, gedacht für Projekte, die ihren Build ohnehin über Next laufen lassen. Ein
eigenständiges Build-Skript (`scripts/build-sw.mts`, aufgerufen aus `predev`/`prebuild`)
nutzt die niedrigere `@serwist/build`-API, um `public/sw.js` unabhängig von
Turbopack/Webpack zu erzeugen. `next dev`/`next build` bleiben unangetastet auf Turbopack.

Kosten: mehr Handarbeit als die Zero-Config-Integration – Precache-Manifest, Registrierung
im Client, Cache-Versionierung selbst verdrahten, statt sie aus dem Next-Build-Grafen
geschenkt zu bekommen. Das ist hier vertretbar, weil der Umfang laut CLAUDE.md ohnehin
schmal ist: „Offline nur für Karten-/Vokabel-Sessions", keine generische Offline-Shell für
die ganze App – die Precache-Liste ist damit kurz und von Hand pflegbar, keine automatisch
aus jedem Next-Chunk abgeleitete.

**Das weicht von CLAUDE.md/§11 wörtlich ab** („PWA über `@serwist/next`"). Bleibt im Geist
(Serwist bleibt das Werkzeug), nur der Next-spezifische Adapter entfällt – eine Abweichung,
die hiermit dokumentiert wird, keine stillschweigende. Vor der Umsetzung: exakte
`@serwist/build`-API gegen die zu diesem Zeitpunkt aktuell installierte Version prüfen,
nicht aus Trainingsdaten übernehmen (AGENTS.md).

### Option D: Serwist weglassen, Service Worker von Hand

Für den schmalen Umfang vermutlich sogar weniger Code als mit Serwist. Verworfen: Serwists
eigentlicher Wert ist die Cache-Invalidierung über ein Precache-Manifest mit
Content-Hashes und saubere Update-Zyklen – das von Hand nachzubauen ist genau die Art
Infrastruktur, die man sich nicht selbst schreibt, ohne einen Vorteil gegenüber Option C zu
gewinnen.

**Empfehlung: Option C.**

## Entscheidung 2 – Was „offline" hier konkret bedeutet

Der Session-Zustand (`session.ts`, `practice-session.tsx`) ist bereits vollständig
clientseitig – Warteschlange, Stapel, Fortschritt leben im Browser, unabhängig von der
Datenbank. Und `classifyMultipleChoice()`/`classifyTyped()`/`applyReview()`
(`outcome.ts`/`fsrs.ts`) sind **reine Funktionen ohne Datenbankzugriff** – dieselbe Logik,
die `submitAnswer()` serverseitig nutzt, liefe im Client identisch.

### Entscheidung

- **Offline heißt: eine bereits laufende Session übersteht einen Netzausfall – nicht: eine
  Session startet komplett offline neu.** Das deckt sich mit dem Wortlaut aus §11 („Session
  bleibt gültig, Sync bei Rückkehr"), nicht mit „Session beginnt offline".
- Eine Antwort, die offline gegeben wird, läuft durch **dieselben reinen Funktionen** wie
  online – für eine ehrliche Rückmeldung, kein Raten. Aber das Ergebnis ist eine
  **Vorschau**, keine Wahrheit: Jede Antwort landet mit `cardId, mode, given, responseMs,
gegebenAt` in einer IndexedDB-Warteschlange. Bei Rückkehr ruft der Client denselben
  `submitAnswer()`-Server-Action-Aufruf **sequenziell, in Eingabereihenfolge** nach – kein
  neuer Schreibweg, keine zweite Wahrheit über den FSRS-Zustand. Die Regel aus V-02 („Der
  Server bewertet jede Antwort selbst, nie der Client") gilt damit wörtlich weiter, nur
  zeitversetzt.
- **Sequenziell ist Pflicht, nicht Komfort:** Zwei Antworten auf dieselbe Karte in einer
  Session hängen ursächlich zusammen – der FSRS-Zustand nach Antwort 1 ist die Eingabe für
  Antwort 2 (`ts-fsrs` ist zustandsbehaftet). Parallele Zustellung würde diese Kette
  zerreißen.
- Der Service Worker bekommt dabei **keine** Sync-Logik – Precaching und Registrierung sind
  seine ganze Aufgabe. Die Warteschlange lebt in gewöhnlichem Anwendungscode (IndexedDB,
  `online`/`offline`-Events): Die Background-Sync-API wäre die naheliegende
  Plattform-Alternative, aber ohne Safari/iOS-Unterstützung kein tragfähiger Unterbau für
  ein Kind, das laut Konzept auf iPad/iPhone unterwegs ist.

### Bewusst außerhalb dieses Tickets

- **Kaltstart komplett offline** (keine bereits geladene Session, kein Cache fälliger
  Karten) – bräuchte proaktives Vorausladen der fälligen Karten, ein eigenes Ticket, falls
  der Bedarf real wird.
- **Konfliktauflösung bei zwei Geräten**, die gleichzeitig offline dieselbe Karte üben –
  letzter Sync gewinnt, keine Erkennung. Bei einem Kind mit typischerweise einem aktiven
  Gerät ein vertretbares Risiko – hier benannt, nicht stillschweigend in Kauf genommen.

## Konsequenzen

- Neue Abhängigkeiten: `@serwist/build` (Build-Zeit) und `serwist` (Laufzeit-Bibliothek für
  das Service-Worker-Skript selbst) – nicht `@serwist/next`.
- Ein neues Build-Skript vor `next dev`/`next build` (`predev`/`prebuild` in
  `package.json`) – eine zusätzliche Stelle, die beim Vergessen leise bricht (der Service
  Worker bleibt dann einfach veraltet). CI muss denselben Schritt fahren wie lokal.
- IndexedDB-Warteschlange ist neuer Code mit eigenem Testbedarf: Unit-Tests für die
  Warteschlangen-Logik ohne Browser, wo möglich; E2E für das echte Offline-Verhalten
  (Playwright kann Netzabbruch simulieren, `page.context().setOffline(true)`).
- Kein Konflikt mit RLS/`withActor()`: Der Sync-Weg ruft weiterhin genau die bestehende
  Server Action auf, keine neue Schreib-Route, keine neue Policy nötig.
- Widerspricht CLAUDE.mds wörtlicher Nennung von `@serwist/next` – siehe Option C oben.
  Diese Zeile in CLAUDE.md sollte bei Umsetzung auf „Serwist, Build entkoppelt vom
  Next-Bundler (ADR 0010)" präzisiert werden.

## Abgelehnte Alternativen

Siehe Optionen A, B und D oben.

## Nachtrag beim Bauen (F-09a)

**Kein `serwist`-Laufzeitpaket, kein Bundler.** Beim Entpacken der echten, aktuell
veröffentlichten `@serwist/build`-Quellen (nicht aus Trainingsdaten übernommen, AGENTS.md)
zeigte sich: `injectManifest()` kompiliert nichts, sie ersetzt nur die Textstelle
`self.__SW_MANIFEST` in einer bereits lauffähigen JS-Datei. `serwist`s Laufzeitklasse
(`Serwist`) liefert nur ESM ohne Bundle – sie im Service Worker zu nutzen, bräuchte einen
eigenen Bundler (z. B. esbuild), eine weitere neue Abhängigkeit, die dieser ADR nicht
vorgesehen hatte. Für den schmalen Umfang (siehe unten) genügt ein **handgeschriebenes**
`src/sw.ts` (Install/Activate/Fetch, ~40 Zeilen) ohne npm-Importe, kompiliert mit `tsc`
(bereits vorhanden) über ein eigenes `tsconfig.sw.json`. `@serwist/next` und das ungenutzte
`serwist` sind aus `package.json` entfernt, `@serwist/build` (Build-Zeit, `devDependencies`)
ist die einzige neue Abhängigkeit.

**Timing: `postbuild`, nicht `predev`/`prebuild`.** Das Vorcache-Manifest zeigt auf
`.next/static`, das erst nach `next build` existiert – `scripts/build-sw.mts` scheitert
absichtlich laut, wenn es vorher läuft. In der Entwicklung gibt es dadurch nie eine
`public/sw.js`; die Registrierung (`RegisterServiceWorker`) greift deshalb nur in
Produktion und räumt in jeder anderen Umgebung aktiv eine vorhandene Registrierung ab –
sonst würde ein einmal lokal gebauter Service Worker jede spätere `next dev`-Sitzung mit
veraltetem Cache überdecken, ein bekanntes PWA-Entwicklungsproblem.

**Bewusst kein Caching von Seiten/Navigationen, nur der App-Shell (JS/CSS).** Naheliegend
wäre gewesen, den Service Worker auch Seitenaufrufe (`request.mode === "navigate"`) cachen
zu lassen, damit ein Neuladen von z. B. `/ueben` offline überhaupt eine Antwort bekommt.
**Verworfen:** `/ueben` ist personalisiert und serverseitig gerendert (fällige Karten des
gerade aktiven Kindes) – ein Cache-Eintrag hinge nur an der URL, nicht am Sitzungs-Cookie,
das entscheidet, welches Kind gerade aktiv ist (ADR 0006). Zwei Geschwister auf demselben
Gerät könnten sich so gegenseitig den zwischengespeicherten Stand ausliefern lassen – genau
die Mandantentrennung, die ADR 0006/0004 über RLS erzwingen, wäre am Service Worker vorbei
umgangen. Der Vorcache bleibt deshalb auf nicht personalisierte, gemeinsam genutzte
Dateien beschränkt (`.next/static/chunks/*.{js,css}`). Konsequenz: **Ein vollständiges
Neuladen von `/ueben` while offline funktioniert weiterhin nicht** – „eine laufende Session
übersteht einen Netzausfall" (Entscheidung 2 oben) heißt technisch: der Tab bleibt offen,
der clientseitige Sitzungszustand (`session.ts`) läuft im Speicher weiter, nur `submitAnswer()`
braucht die Warteschlange aus F-09b. Das ist enger als ein erster Blick auf „Offline-Shell"
vermuten lässt, aber die einzige Lesart, die die Kind-Trennung nicht aufweicht.

**Ein Fund beim Testen, nicht an der Architektur:** `src/proxy.ts`s Ausnahmeliste enthielt
`manifest.webmanifest` und `robots.txt`, aber nicht `sw.js` – ein anonymer Abruf von
`/sw.js` wurde auf `/anmelden` umgeleitet (307), was `navigator.serviceWorker.register()`
zuverlässig scheitern lässt (eine Registrierung braucht eine echte Skript-Antwort von der
Skript-URL, keine Weiterleitung). Unsichtbar in der Entwicklung, weil der Dev-Actor-Bypass
den Proxy dort ohnehin überspringt – derselbe Mechanismus, der `robots.txt` schon einmal
betraf (siehe Kommentar dort). Erst gegen einen echten `next build && next start` sichtbar
geworden, dort auch behoben (`sw.js` in den Ausnahme-Matcher aufgenommen).

**Verifiziert gegen einen echten Build**, nicht nur angenommen: `next build && next start`,
Registrierung in Chromium über Playwright geprüft – Service Worker aktiviert, 19 Dateien
(716 KB) vorgecacht. Offline (`page.context().setOffline(true)`): ein Abruf einer
vorgecachten Chunk-URL liefert 200 aus dem Cache; ein Abruf von `/ueben` (nicht vorgecacht)
scheitert korrekt mit einem Netzwerkfehler – der Service Worker beantwortet also wirklich
nur, was er vorgecacht hat, nichts darüber hinaus.

## Nachtrag beim Bauen (F-09b)

**Keine `applyReview()`/FSRS-Vorschau nötig, entgegen der Annahme oben in Entscheidung 2.**
Beim Bauen zeigte sich: `session.ts`s `advance()` – die reine Warteschlange, die die laufende
Übung steuert – konsumiert ausschließlich den `Outcome` (richtig/fast/falsch) einer Antwort,
nie den FSRS-Zustand selbst. FSRS ist eine rein serverseitige Angelegenheit, die die laufende
Session nicht berührt. Die Offline-Vorschau (`previewOutcome()` in
`src/lib/vocab/answer-queue.ts`) braucht deshalb nur `classifyMultipleChoice()`/
`classifyTyped()`, nicht `applyReview()` – eine Funktion weniger zu duplizieren, und
`applyReview()` bleibt exklusiv dem echten `submitAnswer()`-Aufruf vorbehalten, der den
frischen `fsrs_state` erst beim Sync aus der Datenbank liest.

**Die Reihenfolge-Invarianz wird beim Senden erzwungen, nicht nur beim Nachliefern.** Steht
schon eine Antwort in der Warteschlange, geht jede weitere Antwort ebenfalls hinein – auch
wenn `navigator.onLine` in der Zwischenzeit wieder `true` ist. Ohne diese Regel könnte eine
frische Online-Antwort eine ältere, noch nicht zugestellte Antwort auf dieselbe Karte
überholen und den FSRS-Zustand serverseitig durcheinanderbringen (ts-fsrs ist
zustandsbehaftet). Ausgelöst wird der Sync-Versuch dreifach: beim Laden von `/ueben`, bei
jedem `online`-Ereignis, und direkt nach jedem neuen Eintrag in die Warteschlange – kein
Warten auf den nächsten Seitenaufruf.

**Kein neuer Speicher-Fake als Testabhängigkeit.** `flushAnswerQueue()` und
`previewOutcome()` sind rein und unit-getestet wie `session.ts`, mit einem
In-Memory-`AnswerQueueStore` statt `indexedDB` – jsdom (die Testumgebung dieses Projekts)
kennt kein IndexedDB, und ein Fake dafür (`fake-indexeddb`) hätte eine neue Abhängigkeit
gebraucht, die niemand angefragt hatte. Der echte `createIndexedDbAnswerQueue()`-Adapter ist
stattdessen per E2E gegen einen echten Chromium verifiziert (`page.context().setOffline()`,
IndexedDB-Zählung direkt in der Seite) – derselbe Weg wie beim Service Worker in F-09a.

**Bewusst weiterhin nicht gelöst** (siehe „Bewusst außerhalb dieses Tickets" oben, jetzt
konkret benannt): Zwei Tabs oder Geräte, die gleichzeitig ihre je eigene Warteschlange
leeren, oder ein Sync, der zwischen dem Schreiben in die Datenbank und dem Entfernen aus der
Warteschlange abbricht (dann würde die nächste Zustellung dieselbe Antwort doppelt senden –
`submitAnswer()` legt bei jedem Aufruf eine neue `review`-Zeile an, ohne Idempotenz-Schlüssel).
Beides bleibt F-09c, wie hier ursprünglich vorgesehen. Ebenfalls keine sichtbare Rückmeldung,
dass eine Antwort noch in der Warteschlange steht – die gezeigte Klassifikation ist ehrlich
(dieselbe Funktion wie der Server), nur ihre Persistenz ist verzögert; ein Hinweis dazu ist
§15-verträglich, aber F-09cs Aufgabe.

## Nachtrag beim Bauen (F-09c)

**Doppelte Zustellung bleibt bewusst ungelöst.** Vor dem Bauen noch einmal geprüft: Das
Zeitfenster für eine doppelte Zustellung ist ein Tab-Absturz zwischen dem erfolgreichen
Schreiben in die Datenbank und dem `remove()` aus der IndexedDB-Warteschlange – ein
Millisekunden-Fenster. Eine echte Lösung (eine Idempotenz-Spalte an `review`, geprüft von
`submitAnswer()` vor dem Anwenden) bräuchte eine Migration und eine RLS-Nachprüfung – eine
neue Tabellen-Spalte ist immer eine Entscheidung, kein Nebeneffekt. Für dieses seltene
Risiko unverhältnismäßig; bleibt hier benannt, keine stillschweigende Lücke.

**„Fehlerfälle beim Reconnect" bedeutete konkret: ein Rückgabewert, der zwei Dinge
verschluckte.** `submitAnswer()` gab bis hierhin `null` sowohl zurück, wenn keine Kind-Rolle
aktiv war (vorübergehend – kann sich ändern) als auch, wenn die Karte nicht mehr existierte
(endgültig – wird sich nie ändern). `flushAnswerQueue()` konnte beides nicht unterscheiden
und brach in beiden Fällen ab, um die Reihenfolge zu wahren – mit der Folge, dass eine
einzige inzwischen gelöschte Karte (z. B. weil das Set währenddessen gelöscht wurde) die
gesamte Warteschlange **für immer** blockiert hätte, nicht nur bis zum nächsten Sync-Versuch.
`AnswerResult` ist jetzt eine Vereinigung aus drei Zuständen (`ok`/`not_authorized`/
`not_found`), `flushAnswerQueue()` bekommt einen dritten `DeliveryResult`
(`"ok"`/`"retry"`/`"discard"`) statt eines bloßen Wahrheitswerts: `"retry"` bricht ab wie
bisher, `"discard"` entfernt den Eintrag und macht mit dem Rest weiter.

**Das sichtbare Signal lebt in `PracticeSession`, nicht in `ActiveCard`.** Die Warteschlange
betrifft das ganze Fenster, nicht nur die Karte, die einen Eintrag ausgelöst hat – „1 Antwort
wartet" soll auch auf der Übersicht stehen, wenn jemand zwischendurch „Zur Übersicht"
angetippt hat. `ActiveCard` bekommt stattdessen eine punktuelle, kontextuelle Ergänzung:
Direkt unter einer Rückmeldung, die über die Warteschlange ging, steht „Wird synchronisiert,
sobald wieder Netz da ist." – ruhig, keine Farbe, kein Alarm (§15), und nur dort, wo sie
gerade zutrifft.
