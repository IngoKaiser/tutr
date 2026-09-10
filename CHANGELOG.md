# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach SemVer. Jedes Ticket trägt sich unter **Unreleased** ein; beim Release wird der Block umbenannt.

## [Unreleased]

### Changed

- **Ladezeiten der angemeldeten Seiten.** Ein Aufbau von `/faecher/vokabeln` kostete über
  **dreißig Netzwerkrunden** zur Datenbank. Zwei Ursachen, beide behoben:
  `loginStatus()` lief viermal je Seite (Layout, Seite und zwei Loader mit je
  `requireActor()`) – jetzt einmal, dedupliziert über Reacts `cache()` innerhalb einer
  Anfrage. Und jede Transaktion begann mit vier einzelnen Anweisungen (`set local role`
  plus dreimal `set_config`), jede eine eigene Runde – jetzt eine einzige Anweisung.
  Gegen die Produktivdatenbank gemessen: 167 ms → 103 ms je `withActor()`-Aufruf, die
  Abfragefolge einer Seite 493 ms → 202 ms. `set_config('role', …)` ist gleichbedeutend
  mit `set local role`; dass RLS unverändert greift, belegen die 96 Policy-Tests

### Added

- **T-02b/T-02d: der Tutor lässt sich besprechen und liest vor.** Ein Mikrofonknopf am
  Eingabefeld diktiert (Web Speech API): Gesprochenes läuft **live ins Feld**, nicht direkt in
  den Chat – gelesen, korrigiert, dann abgeschickt. Erkennung im Deutschen ist bei Fachbegriffen
  und Zahlen mittelmäßig; der Korrekturschritt ist deshalb Absicht, kein Zwischenschritt
  ([ADR 0011](docs/adr/0011-sprache-im-tutor.md) D1). Solange das Mikrofon offen ist, steht
  „tutr hört zu …" da – kein stilles Mithören. Und **vor der ersten Nutzung** ein klarer Satz
  darüber, dass die Aufnahme zur Erkennung an den Browser-Hersteller geht (Chrome → Google,
  Safari → Apple) und nirgends gespeichert wird; Konzept §11 nennt die API „kostenlos" und
  übergeht diesen Datenweg.
  Jede Tutor-Antwort bekommt einen **„Vorlesen"**-Knopf, dazu einen Schalter
  „Vorlesen: an/aus" (Standard aus, gemerkt) – dann werden neue Antworten von selbst
  vorgelesen. Tippen oder Diktieren stoppt das Laufende. Es sprechen die **Systemstimmen** über
  `speechSynthesis`, lokale bevorzugt: kein Dienst, kein Schlüssel, keine Kosten, nichts
  verlässt das Gerät. Damit steht die gesprochene Schleife – reden, lesen, vorgelesen bekommen.
  Ein Echtzeit-Sprachdialog bleibt bewusst vertagt (ADR 0011 D3). Unterstützt der Browser eine
  der beiden APIs nicht, erscheint der jeweilige Knopf gar nicht erst.
- **T-02: der Tutor-Chat, schmale Fassung.** Die Seite „Tutor" ist echt (statt der Attrappe aus
  F-07): ein Chatfenster mit Kontext-Chip (Fach), zwei Einstiegen – **freie Frage** und
  **„Verstehen"** – und einer **streamenden** Antwort, Wort für Wort statt Spinner. Der Verlauf
  liegt in `tutor_session`/`tutor_message` mit RLS **von Anfang an** und **nur fürs Kind**: Für
  Eltern gibt es keine Policy, also keinen Zugriff – strukturell, nicht nur in der Oberfläche
  ([ADR 0004](docs/adr/0004-datenmodell-rls.md) D3, [ADR 0010](docs/adr/0010-tutor-architektur.md)
  D2). Die Zusammenfassung für Eltern (`tutor_session_summary`) kommt erst mit T-03, wo sie etwas
  zu tragen hat. Jede Antwort trägt einen festen Hinweis „Allgemeinwissen — noch ohne dein
  Material und dein Lehrwerk" – den setzt der Server, nicht das Modell (ADR 0010 D5). Frühere
  Gespräche bleiben über eine Liste erreichbar. Der eine streamende Endpunkt
  (`POST /api/tutor`) ist die einzige dokumentierte Ausnahme von der Server-Action-Regel
  (ADR 0010 D1).
- **T-02a: Sprachwächter.** Der Systemprompt fixiert Deutsch; in Fremdsprachenfächern sind
  Zielsprache in Beispielen und Vokabeln erlaubt, die Erklärung drumherum bleibt deutsch
  (`subject.language` entscheidet, nicht der Fachname). Nach dem Streamen prüft ein reiner,
  API-freier Detektor (`istDeutsch()`, Funktionswort-Heuristik) die Antwort und schreibt das
  Ergebnis an `tutor_message.language_ok` – **gemessen, nicht blockiert** (Streaming und
  Vorabprüfung schließen sich aus, ADR 0010 D3). Der Astra-Fehler („Hey! Cool that you're
  here…" in einer deutschen Lektion) ist damit per Test ausgeschlossen.
- **S-03b: Kostendeckel für KI-Endpunkte.** Ab dem ersten Tutor-Klick kostet jede Frage Geld
  (~1,1 ct). `ai_usage` zählt die Aufrufe je Kind über ein gleitendes Fenster – **20 pro
  Stunde, 60 pro Tag** –, geprüft **vor** dem Modellaufruf. Beim Überschreiten eine 429 mit
  einem deutschen Satz, der sagt, _wann es weitergeht_, nicht „Rate limit exceeded". Zähler in
  Postgres, kein Redis; aufgeräumt wird beim Schreiben (ADR 0010 D4).
- **K-01: Prüfungskalender, Termine von Hand.** Neue Seite „Prüfungen" (statt der Attrappe aus
  F-07): Termin anlegen (Fach, Art, Titel, Datum), Liste in drei Fenstern – **kommend** (nächste
  vier Wochen), **später im Schuljahr**, **vergangen & abgesagt** (Historie). Bearbeiten an Ort
  und Stelle; **Absagen** ist ein Statuswechsel, kein Löschen – der Termin rutscht in die
  Historie und lässt sich wieder planen; **Löschen** entfernt ihn endgültig, mit Rückfrage.
  Termine hängen am aktiven Schuljahr; **beide Rollen** dürfen eintragen und ändern (ADR 0004 D4),
  anders als bei Themen und Vokabeln. Fachbindung über einen zusammengesetzten Fremdschlüssel
  (§15 Fehler 2) – ein Termin mit dem Fach eines fremden Kindes scheitert an der Datenbank; der
  Fach-Fremdschlüssel steht auf `restrict`, also zählt „Fach löschen" jetzt auch offene Termine
  in seinen Riegel. Die Zeitfenster-Logik (`splitByHorizon`, „heute" in UTC) liegt rein und
  unit-getestet in `lib/calendar/upcoming.ts`. Import per Foto/Datei (K-02–K-04) und die
  Themen-Verknüpfung mit Countdown-Seite (P-01) kommen später.
- **V-03d: Vokabeln ohne Set sind erreichbar.** `deleteSet()` bewahrt seit V-03a die Vokabeln –
  aber es gab keinen Zustand „Vokabel ohne Set" in der Oberfläche: ein Weg hinein, keiner hinaus.
  Produktiv aufgefallen: 60 von 83 Vokabeln hingen im Nichts, ihre Karten kamen trotzdem täglich
  im Üben. Jetzt: je Fach ein „Ohne Set · N Vokabeln"-Eintrag auf der Vokabelseite, dahinter eine
  Liste zum Bearbeiten, **einem Set zuordnen** oder ganz **löschen** (samt Lernstand). Und
  Set-Löschen fragt, wenn Vokabeln dadurch in keinem Set mehr stecken würden: „Nur das Set" oder
  „Set und N Vokabeln". Die Sortier- und „prüfen"-Logik der Liste ist nach `lib/vocab/review-list.ts`
  gezogen und wird jetzt von beiden Ansichten geteilt.
- **V-06a: die Übungszahl stimmt, die Richtung heißt richtig.** `/ueben` zählt jetzt **Vokabeln
  statt Karten** – Ingos „Englisch" zeigt 83 fällig, nicht mehr 166 (das war 83 × 2 Richtungen).
  „Gemischt" fragt jede fällige Vokabel je Runde genau einmal (die früher fällige Karte, bei
  Gleichstand die vorwärts-Richtung); die angezeigte Zahl entspricht so der Zahl der Fragen.
  Der Richtungsumschalter beschriftet sich aus `subject.language`: „EN → DE" / „DE → EN" statt
  fest getipptem „FR → DE". Ein Fach ohne Zielsprache (Mathe, Geschichte) hat keine
  Rückrichtung – dann erscheint der Umschalter gar nicht.

- **F-16a: Fächerverwaltung.** Der Blocker aus `docs/roadmap.md` Stufe 0 ist behoben – ein Kind
  legt Fach und Schuljahr jetzt selbst an, ohne Elternteil ([ADR 0009](docs/adr/0009-schuljahr-als-sichtfenster.md)).
  Vorher stand `insert into subject` nur im Seed-Skript, und selbst mit Formular hätte nur ein
  Elternteil schreiben dürfen – ein Kind ohne Elternkonto (ADR 0006 D1) kam dadurch nie zu einem
  Fach. Neue Seite unter „Fächer": anlegen (Name + optionale Sprache), umbenennen, löschen (mit
  Riegel – ein Fach mit Themen oder Vokabelsets lässt sich nicht löschen). Das Schuljahr entsteht
  mit der Registrierung, in derselben Transaktion wie das Profil
- **Schuljahr als Sichtfenster, Fach als Lernraum** (ADR 0009 D2–D4): Fächer bleiben über Jahre
  dieselbe Zeile (Französisch bleibt Französisch), welche Fächer _dieses Jahr_ laufen, sagt die
  neue Zuordnungstabelle `school_year_subject`. Sets, Themen und Arbeiten sind jahresgebunden
  (`vocab_set.school_year_id`, neu) – der Lernstand (`vocab_item`, `card`, `review`) bleibt
  ausdrücklich zeitlos, das schärft ADR 0004 D6, statt sie zu brechen
- `subject.language` (nullable, ISO-639-1): steuert erst ab V-06a die Richtungswahl beim Üben,
  kommt aber schon mit F-16a, weil das Anlege-Formular hier entsteht
- **V-03c: Foto-Import als Minigalerie.** Mehrere fotografierte Seiten stehen jetzt als Kacheln
  nebeneinander, jede mit eigenem Zustand (wartet · wird verkleinert · wird gelesen · fertig ·
  nicht geklappt) statt eines gemeinsamen Fortschrittstexts für alle Bilder. Scheitert eins,
  bleiben die anderen mit ihrer Bilanz stehen und lassen sich einzeln über „Nochmal" wiederholen –
  vorher warf ein `return` in der Bildschleife die Bilanz bereits erfolgreicher Bilder weg, sobald
  ein späteres scheiterte. Ausgangspunkt: ein echter Doppelseiten-Import aus einem Englisch-Lehrwerk,
  bei dem 60 von 114 Vokabeln sauber in der Datenbank standen, die Oberfläche aber nur „nicht
  geklappt" zeigte, ohne zu sagen, welche Seite gemeint war oder warum
- `classifyPhotoImportError()` (`src/lib/vocab/photo.ts`): ordnet einen gescheiterten
  Bilderkennungs-Aufruf einer verständlichen, nach Ursache unterschiedenen Meldung zu
  (Zeitüberschreitung, Verbindungsabbruch, Rate Limit, Server- vs. Anfragefehler). Vorher stand in
  `addFromPhoto()` ein `catch {}` **ohne Bindung** mit dem Kommentar „gehört ins Serverlog" – es
  wurde nirgends geloggt, und als ein echter Import zur Hälfte scheiterte, ließ sich die Ursache
  im Nachhinein nicht mehr rekonstruieren. Jetzt geht die Ursache ins Serverlog, eine passende
  deutsche Meldung auf den Bildschirm

### Fixed

- **Übungssession: spürbare Verzögerung nach jeder Antwort.** `submitAnswer()` rief
  `revalidatePath("/ueben")` bei jeder einzelnen Antwort auf – `loadDueBySubject()` ist aber eine
  Aggregation über alle Karten, und Next rendert die Übersicht dafür komplett neu. Der
  „Weiter"-Knopf blieb so lange deaktiviert, bis das durch war: rund drei Sekunden zwischen
  Antwort und Rückmeldung, obwohl `submitAnswer()` selbst nur eine Zeile schreibt. Gefunden beim
  eigenen Testen des Nutzers. Die Zahlen der Übersicht frischen jetzt einmal auf, wenn die Session
  verlassen wird (`refreshDueOverview()`), nicht mehr nach jeder Karte – der Fortschritt in der
  Kopfzeile kam ohnehin schon aus dem clientseitigen Sitzungszustand, nicht aus dieser Abfrage

- `docs/roadmap.md`: Arbeitsreihenfolge in die Breite statt in die Tiefe – von jedem Bereich (Tutor, Hausaufgabe, Kalender, Material, Prüfen, Heute) erst eine schmale, aber echte Fassung, dann Runde für Runde vertiefen. Ordnet Konzept §12 neu, ohne der Spezifikation zu widersprechen. Trägt jetzt, weil der prüfungskritische Weg (Vokabeln) fertig ist. Enthält je Bereich eine Reifeleiter in drei Stufen und benennt ausdrücklich, **was sich nicht reduzieren lässt** – Hinweisleiter vor jeder Lösung, Sprachwächter, RLS auf `tutor_sessions`, Kontext-Chip, Quellenangabe, Rate Limits: Regeln, die zur ersten Fassung eines Bereichs gehören, nicht zu einer Härtungsrunde danach
- **F-16** als Blocker aufgenommen: `insert into subject` steht heute nur im Seed-Skript, `school_year` ebenso. Nach der Registrierung ist die Fachauswahl deshalb leer – kein Set, keine Vokabeln, kein Üben, kein Termin, kein Thema. Muss vor allem Weiteren kommen

- `docs/deploy.md`: Beim Prüfen des Mailwegs nie `@example.com` verwenden, sondern `delivered@resend.dev`. Resend weist `example.com` ausdrücklich ab – aber erst beim Senden der Nachricht, nicht schon bei der Empfängerprüfung, sodass ein Test dagegen wie ein kaputtes SMTP-Setup aussieht. Beim ersten Deploy hat genau das über eine Stunde Fehlersuche gekostet: Port, Passwort und Verschlüsselung wurden nacheinander verdächtigt, während nur die Testadresse falsch war

### Added

- Vercel Web Analytics (`@vercel/analytics`): aggregierte Seitenaufrufe ohne Cookies, ohne Bezug zu einem Kind-Profil oder Lernstand – eine grobe Antwort auf „wird die App benutzt", keine Kennung einzelner Personen
- `docs/deploy.md`: Abschnitt zu Preview-Deployments. Vercel legt für jeden Branch/PR automatisch ein eigenes Deployment an – bisher zeigten sie auf dieselbe Datenbank wie Production, mit demselben Risiko wie vor F-13, nur eine Ebene höher. Preview bekommt jetzt eigene Werte, die auf das ohnehin vorhandene zweite (Test-)Supabase-Projekt zeigen
- `docs/deploy.md`: Secret/Config-Typ je Variable dokumentiert. Die beiden `NEXT_PUBLIC_`-Werte sind öffentlich **by design** (ADR 0003: „öffentlich, im Client-Bundle, RLS greift") – Vercels Warnung ist zutreffend und harmlos, `Secret` brächte dort keinen Schutz, nähme aber die Möglichkeit nachzusehen
- `docs/deploy.md`: Abschnitt 6 überarbeitet. Der Eltern-Anmeldelink lief über Supabase Auths eingebauten Mailversand mit einem sehr niedrigen Stundenlimit – reproduziert mit einem direkten Aufruf gegen `/auth/v1/otp` (`500 Error sending confirmation email`), unabhängig von Resend und unabhängig von unserer App. Der dokumentierte Fix ersetzt den eingebauten Versand durch Resend als SMTP-Relay, das ohnehin schon verifiziert ist

### Fixed

- Die Passkey-Anmeldung startete die WebAuthn-Zeremonie auch auf Geräten ohne Passkey – das Betriebssystem zeigte dann seinen eigenen Dialog („QR-Code scannen", „Sicherheitsschlüssel verwenden"), lauter Wege, die jemand ohne Profil nicht gehen kann (F-14). Ob ein Passkey existiert, **lässt sich nicht abfragen**: WebAuthn verrät das absichtlich nie, sonst könnte jede Seite das Vorhandensein eines Kontos ausspähen. Stattdessen eine Notiz im Browser, gesetzt nach Registrierung und Anmeldung – ist sie nicht da, führt der Weg zu „Profil anlegen" statt in den Systemdialog. Mit sichtbarem Ausweg „Ich habe hier schon einen Passkey", weil die Notiz nach gelöschten Browserdaten irren darf, aber niemanden aussperren soll
- Nachtrag zu F-14: Die Notiz entscheidet jetzt beim **Klick**, nicht beim Rendern. Der erste Anlauf tauschte den Knopf „Mit Face ID anmelden" gegen einen Link „Profil anlegen" aus – weil `localStorage` auf dem Server nicht existiert, geschah das erst nach der Hydration, und die Anmeldeseite sprang für alle sichtbar um. Gefunden hat es die CI: Ein E2E-Test fand den Knopf mal, mal nicht, je nachdem ob er der Umschaltung zuvorkam. Der Knopf steht jetzt immer; die Notiz steuert, was ein Druck darauf auslöst. Zwei Tests decken beide Wege ab
- Eine Kind-Rolle hatte **keinen Weg, sich abzumelden**: Der „Abmelden"-Knopf im Kopfbereich hing an `email`, die für die Kind-Rolle immer leer bleibt (nur Eltern melden sich über Supabase an). Einzige Alternative war „Konto löschen" unter `/einstellungen` – unwiderruflich, kein Ersatz für ein einfaches Abmelden. Gefunden beim Testen auf `mytutr.de`
- Der Fehlertext nach einem gescheiterten Passkey-Login war irreführend. WebAuthn unterscheidet aus Datenschutzgründen nicht zwischen „bewusst abgebrochen" und „kein passender Passkey auf diesem Gerät, das Betriebssystem hat trotzdem seinen Systemdialog gezeigt (QR-Code, Sicherheitsschlüssel) und der Rückweg lief über Abbrechen" – beides wirft `NotAllowedError`. Vorher stand in beiden Fällen „Abgebrochen.", was im zweiten – häufigeren – Fall nach einem eigenen Fehler klang statt nach „hier fehlt noch ein Profil". Direkt unter dem Fehler steht jetzt ein Link zur Registrierung, nicht nur als kleiner Hinweis weiter oben

### Added

- Deploy-Vorbereitung für `mytutr.de` (D-01): `robots.txt` mit `Disallow: /` und `X-Robots-Tag: noindex, nofollow` in den Antwort-Headern. Die App ist keine Website, sondern das Lernkonto eines Kindes – Vorname, Jahrgang, Vokabeln, Lernstand. Der Header ergänzt die `robots.txt`, weil er auch für Antworten gilt, die kein HTML sind, und für Crawler, die die Datei gar nicht erst lesen
- `docs/deploy.md`: die Schritte in der Reihenfolge, in der sie stehen müssen. Der wichtigste Punkt ist die Domain **vor** der ersten Passkey-Registrierung: `passkey.ts` leitet die WebAuthn-`rpID` aus dem Host-Header ab (damit Vorschau-Deployments funktionieren), ein Passkey gilt deshalb nur für genau die Domain, auf der er angelegt wurde. `mytutr.de` als primäre Domain, `www` leitet dorthin weiter
- Festgehalten, was **nicht** nach Vercel gehört: `MIGRATION_DATABASE_URL` und `TUTR_APP_DB_PASSWORD`. Das sind die Zugangsdaten der Rolle `postgres`, die RLS umgeht; Migrationen laufen vom Entwicklungsrechner, damit der mächtigste Schlüssel nicht auf der Hosting-Plattform liegt

- Foto und Kamera für den Vokabelimport (V-03b, ADR 0007 D1/D6): ein Eingabefeld, zwei Knöpfe – „Kamera" mit `capture="environment"`, „Bild auswählen" ohne. Mehrere Bilder auf einmal, weil eine Vokabelliste oft über eine Doppelseite läuft. **Das Foto wird nirgends gespeichert** (D6): kein Storage, keine Spalte, keine Datei; es lebt nur für die Dauer des einen Aufrufs
- Erster KI-Aufruf im Projekt: Sonnet mit Structured Output über `zodOutputFormat()` und `messages.parse()`, Schema in `src/ai/schemas/`, Prompt als Funktion in `src/ai/prompts/` – genau die Aufteilung, die CLAUDE.md verlangt. `aiEnv()` und `anthropicConfigured()` als schmale Ausschnitte nach dem Muster von `dbEnv()`/`authEnv()`: Ein fehlender Schlüssel legt den Foto-Weg lahm, nicht die Anmeldung
- Das Bild wird **im Browser** auf 1568 px verkleinert, bevor es zur Server Action geht. Drei Gründe: Server Actions nehmen standardmäßig 1 MB, Handyfotos wiegen 2–5 MB; die Erkennung rechnet ohnehin auf diese Kantenlänge herunter; und das Neu-Zeichnen über ein Canvas überträgt die EXIF-Daten nicht mit – Aufnahmeort und Gerät bleiben auf dem Telefon. Ohne neue Abhängigkeit
- Ein Bild je Server-Aufruf statt aller auf einmal – nur so stimmt „Bild 2 von 3", und CLAUDE.md verlangt für KI-Läufe über 3 s benannte, wahre Schritte statt eines Spinners
- `addRows()` blieb **unverändert**: Der Foto-Weg erzeugt dieselben Zeilen wie das Einfügen, `confidence: "niedrig"` wird zu `unsicher: true`. Die Auszahlung von ADR 0007s „drei Türen in denselben Raum" – kein eigener Einfügepfad, keine eigene Duplikaterkennung, keine eigene Ansicht
- `vocab_item.recognition_uncertain`: die Konfidenz der Bilderkennung als gespeicherte Spalte. Wird beim Bearbeiten der Zeile zurückgesetzt – wer sie aufgeklappt und gespeichert hat, hat daraufgeschaut

### Fixed

- **E2E lief gegen die Produktivdatenbank** (F-13). `playwright.config.ts` reichte kein `DATABASE_URL` an den Testserver durch, also lud `next dev` die `.env.local` – und damit die echte Datenbank. Jeder lokale Testlauf schrieb dorthin. Aufgefallen erst nach dem ersten Deploy auf `mytutr.de`: zwölf „Testkind…"-Zeilen aus `passkey.spec.ts` lagen samt Passkeys und Sitzungen neben den echten Daten. Die Tests waren nie falsch – sie zeigten auf die falsche Datenbank
- `TEST_DATABASE_URL` wird jetzt aus `.env.test.local` an den Testserver durchgereicht. Next.js überschreibt bereits gesetzte Umgebungsvariablen nicht mit Werten aus `.env`-Dateien, der Wert gewinnt also gegen `.env.local`. Ist keine Test-Datenbank konfiguriert, bleibt er leer – dann überspringen sich die DB-Specs selbst, statt still auf die echte Datenbank auszuweichen
- `tests/e2e/test-db.ts`: eine Stelle, an der steht, mit welcher Datenbank die Tests reden. Vorher lud jede Spec für sich `.env.local` und griff auf `MIGRATION_DATABASE_URL` zu – dreimal dieselbe Entscheidung, dreimal die falsche
- `passkey.spec.ts` räumt die angelegten Kinder per `afterAll` wieder ab, auch wenn der Test vorher scheitert; `student` kaskadiert auf Passkey und Sitzung. Es war die einzige Spec ohne Aufräumen – `recovery.spec.ts`, `deletion.spec.ts` und `vokabelverwaltung.spec.ts` taten das schon
- Nachgemessen statt angenommen: voller E2E-Lauf (68 grün), danach Produktivdatenbank auf 0 in allen geprüften Tabellen, Test-Datenbank nur mit Seed-Daten, 0 Testkind-Reste
- `engines.node` von `>=22` auf `22.x` verengt. Vercel warnte im Build-Log bei jedem Deploy: Ein offenes `>=`-Feld lässt die Plattform beim nächsten Node-Major automatisch mitziehen, ohne dass jemand es angestoßen hätte – genau die Art Überraschung, die einen produktiven Deploy unbemerkt bricht. `22.x` folgt Patch- und Minor-Updates innerhalb Node 22, springt aber nicht mit auf 23

- **ADR 0007 hatte behauptet, die Konfidenz-Markierung brauche keine Spalte** („ein Zustand der Ansicht nach dem Import"). Ein Testlauf gegen die echte Bilderkennung zeigt das Gegenteil: Bei einer Zeile mit am Blattrand abgeschnittener Übersetzung (`la trousse` / `das Fed`) meldete die Erkennung korrekt „niedrig", aber die Liste konnte das nicht mehr sehen – das Feld ist gefüllt, es gibt keine Dublette, die Zeile sieht vollständig aus. Niedrige Konfidenz ist eine Tatsache aus dem Moment des Imports, keine Eigenschaft der Zeile. Nachtrag im ADR, Spalte ergänzt; die Zusammenfassung („2 zu prüfen") und der Zähler in der Liste stimmen jetzt überein
- Gegen die echte API gefunden: `output_format` wird mit 400 abgewiesen („This field is deprecated"), richtig ist `output_config.format`. Die Doc-Kommentare im SDK zeigen an mehreren Stellen noch das alte Feld – deshalb steht der Grund als Kommentar an der Aufrufstelle

- Fachgebundenes Üben (V-06, ADR 0008 D3): `/ueben` zeigt einen Block je Fach mit fälligen Karten statt einer Zahl über alles – kein fachübergreifendes Üben mehr, weder als Voreinstellung noch als Möglichkeit. Kein eigener Auswahl-Bildschirm davor: Bei realistisch ein bis drei fälligen Fächern steht der Startknopf direkt neben der Zahl
- `loadDueBySubject()` leitet das Fach für **beide** Kartenquellen ab, nicht nur für Vokabeln: `coalesce(vocab_item.subject_id, topic.subject_id)` – für Vokabelkarten über V-05, für Karten aus Lernzielen (M-03, noch nicht gebaut) über `learning_objective → topic → subject`. `card` bekommt dafür keine eigene Spalte (ADR 0008 D1), die Abfrage ist schon richtig, bevor M-03 existiert
- Die Falschantworten für Multiple Choice brauchten am Ende keine eigene Fach-Regel: `loadSessionCards()` filtert jetzt auf `subjectId`, der Vorrat einer Session ist dadurch von selbst einsprachig – genau die Vereinfachung, die ADR 0008 D3 versprochen hat

### Fixed

- Ein Fund beim Testen, keiner an der Anwendung: `practice.spec.ts` wählte das Kind („Mia") über eine `<select>`, deren Änderung eine Server Action hinter `useTransition` auslöst – `selectOption()` wartet darauf nicht, eine anschließende Navigation konnte also vor dem Setzen des Cookies passieren und zeigte Bens leeren Stand statt Mias. Vorher unauffällig, weil „0 fällig" ebenfalls auf die Prüfung `/\d+ fällig/` passte; seit dem Block je Fach zeigt ein leeres Fach gar keinen Block mehr, und der Fehlgriff wurde sichtbar. Der Test wartet jetzt auf das tatsächliche Setzen des Cookies, nicht nur auf den Klick

- Fachbindung im Vokabelmodell (V-05, ADR 0008 D1/D2): `vocab_item.subject_id` (`not null`, FK gegen `subject`) statt einer Ableitung über die Sets, in denen eine Vokabel steckt – die Ableitung war über n:m mehrdeutig und für eine Vokabel ohne Set (seit `deleteSet()` möglich) gar nicht vorhanden. `vocab_set_item.subject_id` bindet zusätzlich beide Seiten (Set und Vokabel) gegen dieselbe Fach-Spalte, mit demselben Kniff wie bei `student_id`: Eine französische Vokabel in einem spanischen Set ist damit strukturell unmöglich, kein Anwendungscode nötig, der das prüfen müsste
- Die Duplikaterkennung beim Einfügen (V-03a) ist dadurch ein einzelner Vergleich auf `subject_id` statt eines Joins über `vocab_set_item`/`vocab_set` – und findet jetzt auch Vokabeln, die in keinem Set mehr stecken
- Migration mit hartem Backfill: bricht ab, statt zu raten, wenn eine Vokabel in Sets verschiedener Fächer steckt oder in gar keinem Set. Nachgemessen gegen die echte Produktiv-DB: 14 Vokabeln, 0 ohne Set, 0 fachübergreifend – der Backfill lief ohne eine der beiden Ausnahmen durch
- ADR 0008 auf **akzeptiert** gesetzt; D1/D2 sind mit V-05 umgesetzt, D3 (fachgebundenes Üben) folgt mit V-06

### Fixed

- `drizzle-kit generate` hatte die neue `subject_id`-Spalte direkt als `not null` erzeugt – auf einer gefüllten Tabelle wäre das am ersten Bestandsschutz gescheitert. Die Migration wurde um Backfill und zwei Härte-Prüfungen ergänzt
- Dieselbe generierte Migration hätte mit „no unique constraint matching given keys" abgebrochen: Die neuen Unique-Constraints, auf die die zusammengesetzten Fremdschlüssel zeigen, standen nach den Fremdschlüsseln selbst. Beim Testlauf gegen die Test-DB gefunden (die Migration wurde dafür einmal zurückgesetzt und mit korrigierter Reihenfolge erneut angewendet), nicht angenommen

- Rücklink im `PageHeader` – jede Seite unterhalb eines Fußleisten-Bereichs trägt jetzt einen Weg eine Ebene höher („‹ Vokabelsets", „‹ Fächer"). Die Fußleiste kennt nur die fünf Bereiche und keine Tiefe darunter; aus der Vokabelliste kam man vorher nur über den Umweg /faecher wieder heraus. Ein echter Link auf die Elternseite, kein Browser-Zurück: In der installierten PWA gibt es keine Browserleiste, und der Link benennt das Ziel, nicht die Richtung. Die Regel steht am Baustein selbst, weil sie zweimal vergessen worden ist (erst der Ausstieg aus der Übung, dann dieser)
- ADR 0008 (Vorschlag): **Ein Fach ist ein Raum, kein Filter.** Kein fachübergreifendes Üben – nicht als Voreinstellung, sondern als Unmöglichkeit. Das Fach wird abgeleitet, wo die Ableitung eindeutig ist (n:1), und gespeichert, wo sie es nicht ist (n:m); das ergibt genau eine neue Spalte (`vocab_item.subject_id`) und schärft ADR 0006 D7, statt ihm zu widersprechen. Tickets V-05 (Fachbindung im Modell) und V-06 (fachgebundenes Üben) geschnitten

### Fixed

- Duplikaterkennung beim Einfügen war fachblind: Sie verglich gegen **alle** Vokabeln des Kindes, sodass englisch `sport/Sport` und französisch `sport/Sport` als derselbe Eintrag gegolten hätten – die vorhandene Vokabel wäre stillschweigend ins neue Set verknüpft worden und hinge damit an zwei Fächern. Sie vergleicht jetzt nur noch innerhalb desselben Fachs (ADR 0007 D4, gerahmt durch ADR 0008 D4)
- „Jahrgang 8 · 8c" aus der Kopfzeile der Fächer-Seite entfernt. Das war fest getippter Text aus der F-07-Attrappe, nicht die Klasse eines Kindes: Gefragt wird sie bei der Anmeldung gar nicht (ADR 0005, Nachtrag), gelesen wird sie nirgends. Ein erfundenes Fach erkennt man als Platzhalter, eine erfundene Klasse sieht aus wie ein gespeichertes persönliches Datum – bei einer App, die ausdrücklich wenig speichert, der falsche Eindruck

- Sets und Vokabelverwaltung (V-03a, ADR 0007 D2–D4): `/faecher/vokabeln` listet die Sets nach Fach, legt sie an und löscht sie; `/faecher/vokabeln/[setId]` ist die Liste einer Vokabelsammlung. Hängt unter **Fächer**, nicht unter „Üben" – Vokabeln pflegen ist Material eines Fachs, das Üben eine eigene Sache
- Einfügen aus der Zwischenablage mit Trennzeichen-Erkennung (`src/lib/vocab/paste.ts`): Tab, Semikolon, Gedankenstrich, Bindestrich, Komma – in dieser Reihenfolge, damit „la fenêtre, das Fenster" nicht am Komma innerhalb einer Vokabel zerbricht. Eine Zeile ohne erkennbares Trennzeichen wird nicht verworfen, sondern als unfertige Zeile angelegt: Sie steht oben in der Liste und lässt sich dort vervollständigen
- Duplikaterkennung (`src/lib/vocab/duplicates.ts`, D4): gleiches Wort **und** gleiche Übersetzung → nur verknüpfen, kein zweiter Eintrag und kein zweiter Lernstand; gleiches Wort mit anderer Übersetzung → nicht automatisch zusammenführen, sondern zum Prüfen markieren. Die Erkennung läuft automatisch, die Entscheidung nicht
- Keine Tabelle und kein eigener Review-Screen (D2): eine vertikale Liste, unsichere Zeilen oben, Antippen klappt zum Bearbeiten auf. Dieselbe Ansicht dient dem Import-Tag wie der Korrektur drei Wochen später. „Unsicher" ist keine Spalte, sondern beim Lesen abgeleitet (leeres Feld, oder dasselbe Wort mit verschiedenen Übersetzungen im Set) – ADR 0006 D7
- Set löschen nimmt **nur das Set** mit: `vocab_set_item` kaskadiert, `vocab_item`, `card` und `review` bleiben. Der E2E-Test zählt die Vokabeln danach direkt in der Datenbank nach – im UI wären sie einfach unsichtbar, was den Unterschied zwischen „erhalten" und „gelöscht" verwischt
- ADR 0007 D3 gegen die echte Datenbank geprüft statt angenommen: Nach dem Ändern einer Übersetzung sind beide Karten der Vokabel byte-gleich – gleicher `state`, gleiches `due_at`, sogar gleiches `updated_at`. Der dort genannte Randfall (Wort und Übersetzung exakt vertauscht → Karten tauschen ihre FSRS-Zustände) ist bewusst **nicht** gebaut und an der Stelle im Code vermerkt: Der Lernstand bleibt dann an der ursprünglichen Richtung hängen, statt der Vokabel zu folgen
- Zwei Funde, beide erst beim Entwerfen des E2E-Tests: (1) Das Einfügen klassifizierte gegen eine Momentaufnahme des Bestands vom Beginn des Durchlaufs – dieselbe Zeile zweimal im selben Text (auf der Buchseite in zwei Abschnitten) wäre doppelt angelegt worden. (2) Bei zwei erlaubten Einträgen zum selben Wort („aller/gehen" und „aller/fahren", D4) nahm die Erkennung immer den ersten – dieselbe Liste ein zweites Mal einzufügen hätte einen dritten Eintrag erzeugt. Der E2E-Test scheitert nachweislich, wenn man den ersten Fix zurücknimmt

- Vokabel-Übungssession (V-02-Nachtrag, gefunden beim eigenen Testen des Nutzers): Rückmelde-Stufe nach jeder Antwort – bei Multiple Choice die angeklickte Option markiert, bei Tippen die eigene Eingabe neben der korrekten Schreibweise, Farben aus dem `Stack`-Baustein (grün/blau/amber, nie Rot). „Weiter" wechselt zur nächsten Karte, kein Auto-Sprung nach einer Zeit – ohne die Rückmeldung war Multiple Choice nicht von Raten zu unterscheiden
- Ausstiegsknopf während der Übung, zurück zur Übersicht. Kein Datenverlust: Jede beantwortete Karte ist beim Absenden schon gespeichert, verloren geht nur die Reihenfolge der noch nicht drangekommenen Karten dieser einen Runde
- Kopfzeile zeigt während der Übung den echten Sitzungsfortschritt („3 von 21") statt der beim Seitenaufruf eingefrorenen Zahl, die während des Übens nie nachzog – dieselbe Zahl konnte „0 fällig" zeigen, während noch echte Karten liefen
- „Session starten"/„Session beenden" durch „Loslegen"/„Zur Übersicht" ersetzt – Denglisch in der Oberfläche, wo Prosa Deutsch sein soll (ADR 0006 D10 gilt für Bezeichner, nicht für UI-Text)
- Backlog-Korrektur: „Set-Modus" (§6 M4 – ein Set unabhängig von der Fälligkeit üben) war beim ersten Zuschnitt von V-04 verlorengegangen, jetzt nachgetragen

- Vokabel-Übungssession (V-02, ADR 0007 D5): `/ueben` zeigt echte fällige Zahlen statt der F-07-Attrappe und lässt eine Session laufen. Reine Warteschlangen-Logik in `src/lib/vocab/session.ts` – drei Stapel (Kann ich/Übe ich/Nochmal), Zufalls-Reihenfolge je Start, Geschwister-Abstand (dieselbe Vokabel nicht direkt nach sich selbst), Terminierung „alles einmal Kann ich war", nicht „Warteschlange leer". „Nochmal … dann 8" als Eskalation gelesen: jede weitere falsche Antwort derselben Karte reiht sie erst nach 8 Karten wieder ein, nicht nur die zweite
- Multiple Choice, solange eine Karte nicht gefestigt ist (`neu`/`lernen`/`erneut_lernen`), Tippen erst ab `wiederholen` – gegen eine echte `ts-fsrs`-Instanz geprüft statt angenommen: Eine frische Karte ist nach der ersten Antwort schon `lernen`, auch nach einer falschen; eine ursprüngliche „neu → MC"-Regel hätte die Karte, die gerade nicht saß, beim Wiedervorlegen auf Tippen hochgestuft
- Antwortbewertung in `src/lib/vocab/answer.ts`: exakt → richtig; fehlender Artikel oder falsche/fehlende Akzente → fast; Tippfehlertoleranz wächst mit der Wortlänge (0/1/2 Fehler bei ≤4/≤8/>8 Zeichen). Bei Multiple Choice ist die Antwortzeit das dritte Signal für „Übe ich" (unsichtbar, CLAUDE.md §15 verbietet Dringlichkeitselemente); beim Tippen übernimmt die Antwortqualität selbst diese Rolle, keine Uhr nötig
- **Der Server bewertet jede Antwort, nie der Client**: `submitAnswer()` bekommt die getippte oder angeklickte Antwort, nie ein fertiges „richtig"/„falsch" – ein manipulierter Aufruf könnte sonst jede Karte als „Kann ich" durchwinken. Erwartete Antwort und FSRS-Zustand kommen frisch aus der Datenbank, nie vom Client übernommen
- Zwei echte Funde beim Testen: (1) `tx.execute()` liefert ein `jsonb`-Feld als String, nicht als geparstes Objekt – `fsrsCardStateSchema` bekommt ein `z.preprocess()`, das beide Formen akzeptiert. (2) Der Dev-Actor-Bypass prüfte den Ansichts-Umschalter-Cookie gar nicht (`switcher` blieb immer `false`, `<ActorSwitch>` wurde nicht gerendert) – ohne den Fix in `lib/auth/actor.ts` hätte kein E2E-Test den Kind-Schreibpfad erreichen können, den die Vokabel-Policies verlangen
- Seed-Daten erweitert: ein Vokabelset zu Unité 3 mit zwölf Alltagsverben, beide Richtungen als Karten – sonst hätte V-02 nichts zum Üben
- ADR 0007 (Vokabeleingabe und -pflege): drei Eingabewege statt vier (Foto/Kamera sind einer), eine Liste statt Tabelle und Review-Screen für die Durchsicht nach dem Import, eine Korrektur am Inhalt rührt den FSRS-Zustand nicht an. V-03 dafür in V-03a (Sets/Verwaltung) und V-03b (Foto/Kamera) geteilt

- Vokabel-Schema (V-01, Konzept §6 M4/§8): `vocab_set`, `vocab_item`, `vocab_set_item` (n:m, „eine Vokabel in mehreren Sets"), dazu `card` und `review`. `card` ist bewusst **generisch**, nicht `vocab_card` – §8 modelliert Card/Review für alle Kartentypen, nicht nur Vokabeln; M-03 („Karten-Generierung aus Material") bekommt `objective_id` als zweite, schon vorhandene Quelle statt einer Migration. Zwei Check-Constraints statt Anwendungscode: genau eine Quelle je Karte (`vocab_item_id` xor `objective_id`), Richtung (`vorwaerts`/`rueckwaerts`) nur bei einer Vokabelkarte
- `card.fsrs_state` als JSONB (ADR 0004 D5 – bereits vorher entschieden, nicht neu). `due_at` und `state` sind echte, indizierbare Spiegel-Spalten daneben, geschrieben ausschließlich zusammen mit dem JSONB-Feld in `src/lib/vocab/fsrs.ts` – der einzigen Stelle im Code, die alle drei anfasst. Ein Zod-Schema in `src/db/types/fsrs.ts` validiert beim Lesen
- `src/lib/vocab/fsrs.ts`: Übersetzung zwischen `ts-fsrs` und den deutschen ASCII-Enum-Werten der Datenbank (`card_state`, `review_rating`) – `ts-fsrs` kennt nur seine eigenen numerischen Enums. `newCardColumns()`, `applyReview()`
- RLS wie `topic`/`learning_objective` (ADR 0004 D4, Zeile bereits vorher für `card, review, vocab_*` festgelegt): Kind liest und schreibt, Eltern lesen nur – Übungsfortschritt ist Tagesgeschäft des Kindes
- Ein echter Fund beim Testen: Ein rohes JS-Objekt als Parameter für eine `jsonb`-Spalte in der `sql`-Vorlage wirft „argument must be of type string" – dieselbe Klasse Fehler wie der JS-Array-in-`text[]`-Fund aus F-06, nur diesmal mit Objekten statt Arrays. Fix: `JSON.stringify(...)` explizit, mit `::jsonb` gecastet

### Changed

- **Das Kind ist der Mandant** (F-11, ADR 0006). `family` und `parent_user` entfallen, `family_id` verschwindet aus allen 14 Tabellen; an ihre Stelle treten `student` (Mandant), `parent_account` (Identität und späterer Abo-Anker) und `parent_student` (Beziehung, Einwilligung je Kind). Auslöser war die Frage, was passiert, wenn zwei Kinder dieselbe Elternadresse eintragen – im Container-Modell landen sie in zwei Familien, und ein Elternkonto konnte strukturell nur in einer sein. Nachgemessen trugen 8 der 14 Tabellen ohnehin schon `student_id` neben `family_id`
- Die Policies werden dadurch **kürzer**: Vorher unterschieden sich die Rollen darin, welche Spalte sie vergleichen, und Kind-Policies brauchten zusätzlich `student_id = app.student_id()`. Jetzt vergleichen beide dieselbe Spalte, und die Rolle entscheidet nur über lesen oder schreiben. Der Actor trägt dafür immer eine `studentId` – auch als Elternteil, denn eine Elternansicht zeigt ein Kind zur Zeit
- **Gegenseitige Rekursion zwischen zwei Policies**, gefunden vom ersten Testlauf gegen die echte Datenbank: Die Policy auf `parent_account` las `parent_student`, deren Policy wieder `parent_account` – Postgres bricht mit „infinite recursion detected in policy" ab. Gelöst über `security definer`-Helfer, die eine Beziehung auflösen, ohne erneut durch RLS zu gehen; jeder ist auf genau eine Frage beschränkt und gibt nur IDs zurück
- **Der Elternbeitritt wäre ein Einfallstor gewesen.** `parent_account_id = app.parent_id()` prüft nur die eigene Seite der Beziehung – ein angemeldetes Elternteil hätte sich mit einem beliebigen Kind verknüpfen können, wenn es dessen UUID kennt. `app.parent_may_link()` verlangt jetzt, dass die von Supabase **bestätigte** Adresse des Kontos die ist, die das Kind selbst hinterlegt hat. In der Datenbank, nicht im Anwendungscode; ein Test reproduziert den Angriff
- Ein Login legt nichts mehr an. Vorher entstand bei jedem ersten Eltern-Login eine Familie – seit ADR 0005 wären das leere Geisterdaten neben den echten. Ein angemeldetes Elternteil ohne verknüpftes Kind sieht jetzt einen leeren Zustand statt einer Umleitung auf die Anmeldeseite, auf der es sich ja gerade angemeldet hat
- **Migrationshistorie einmalig zurückgesetzt** (ADR 0006 D9): drei Migrationen werden zu einer `0000`, beide Datenbanken frisch aufgebaut. Zulässig, weil nachgemessen: ausschließlich Seed-Daten, 0 Passkeys, 0 Sessions, kein Deploy. Die CLAUDE.md-Regel ist geschärft statt gebrochen – **ab dem ersten Deploy (D-01) nie wieder**
- Bezeichner in Schema, Policies und Tests durchgängig englisch (ADR 0006 D10). Die Regel gab es seit ADR 0004 D8, sie stand nur im Daten-ADR und nie in `CLAUDE.md` – deshalb ist die Anwendungsschicht deutsch gewachsen. Sie steht jetzt in `CLAUDE.md`; der Rest der Anwendung folgt als F-12
- Policy-Dateien neu geschnitten (6 → 4), `zeitstempel` liegt statt viermal einmal in `columns.ts`, `ADR 0004` trägt einen Überholungshinweis auf D1–D4
- **Sprachbereinigung (F-12):** Bezeichner in der gesamten Anwendung durchgängig englisch, Prosa (Kommentare, Fehlermeldungen, UI-Texte) weiterhin deutsch. 43 Dateien, gemessen vollständig – von 121 deutschen/denglischen Deklarationen auf 0. Routen (`/anmelden`, `/registrieren`, `/pruefungen`), Formular-Labels und URL-Parameter (`weiter`, `fehler`) bleiben deutsch, sie sind sichtbare Oberfläche
- Dabei ein Fund, der ohne den systematischen Durchgang übersehen worden wäre: Der Session-Cookie des Kindes hieß `tutr_kind`, der E2E-Test für die Wiederherstellung löschte und prüfte danach ein Cookie desselben Namens – beim Umbenennen der Konstante (`SESSION_COOKIE` → `tutr_student`) wären beide Seiten stillschweigend auseinandergelaufen und der Test hätte grün geblieben, ohne je ein echtes Cookie zu finden. Jetzt zeigt der Test explizit auf den Wert aus `student-session.ts`
- Mehrere Dateien umbenannt, damit auch der Dateiname zur Sprache passt: `anmelde-formular.tsx` → `magic-link-form.tsx`, `anmelde-fehler.tsx` → `login-error.tsx`, `passkey-anmeldung.tsx` → `passkey-login.tsx`, `registrier-formular.tsx` → `registration-form.tsx`, `bausteine.tsx` → `primitives.tsx`, `mail/einwilligung.ts` → `mail/consent.ts`, `supabase/konfiguration.ts` → `supabase/config.ts`, `tests/e2e/anmeldung.spec.ts` → `login.spec.ts`

### Added

- Kontolöschung (F-06e, ADR 0006 D5/D6): Ein Kind löscht sein eigenes Konto, ein Elternteil löscht das gerade gewählte Kind, ein Elternteil löscht das eigene Konto (die Kinder bleiben unberührt). Alle drei über eine einzige neue Policy `student_delete` (beide Rollen dürfen die Zeile löschen, auf die ihr eigener Actor-Kontext zeigt – die Datenbank unterscheidet die Wege nicht, nur die Anwendung tut es), `parent_account_own` deckte das Elternkonto bereits ab. Kein Aufräumcode: Alles kaskadiert über bestehende `on delete cascade`-Fremdschlüssel auf `student.id`, gemessen an einer echten Löschung mit Schuljahr, Fach, Thema, Lernziel und Passkey
- Bestätigung durch Eintippen des Vornamens bei den beiden Kind-löschenden Wegen (D5). „Elternkonto löschen" bekommt nur eine zweistufige Bestätigung ohne Eintippen: Der Beitritt (D8) ist bedingungslos, das Konto entstünde bei erneuter Anmeldung mit derselben Adresse automatisch wieder, sofern ein Kind sie weiter einträgt – „löschen" heißt hier ehrlich „löschen und abmelden", nicht endgültige Trennung
- Benachrichtigungsmail (D6) beim Selbstlöschen eines Kindes an jedes verknüpfte Elternteil, mit einer neuen `security definer`-Funktion `app.linked_students()`: Geschwister sehen einander nicht, das löschende Kind kann also selbst nicht beantworten, wer bei seinem Elternteil noch übrig bleibt. Aufgerufen in derselben Transaktion wie das `delete` – die Kaskade hat das gelöschte Kind zu diesem Zeitpunkt schon entfernt, kein manuelles Ausschließen nötig. Gilt nur für den Weg, den D6 nennt: Löscht ein Elternteil ein Kind, weiß es bereits davon
- Bewusste Lücke, kein Versehen: Ein Kind, dessen Elternteil das Konto löscht, wird nicht benachrichtigt – es gibt keinen Kanal zu ihm (pseudonyme Profile), und eine Nachricht dort zu hinterlegen wäre keine harte Löschung mehr. Der Bestätigungsdialog beim Elternteil sagt das ausdrücklich, statt es zu verschweigen. Nachtrag in ADR 0006
- Bestätigungsseite `/konto-geloescht` statt eines wortlosen Rauswurfs – nötig, weil `logout()` die Session schon beendet hat, bevor der Redirect dorthin zeigt; ohne Ausnahme im Proxy-Matcher (wie bei `/wiederherstellen`) landete die Seite selbst wieder auf `/anmelden`, ein echter Fund beim Bauen
- E2E-Test für die Konsequenz aus Sicht eines Geräts, das nichts von der Löschung weiß: Ein echt registriertes Wegwerf-Kind mit echtem Passkey, die Zeile direkt per Migrationsrolle gelöscht, derselbe Passkey versucht sich erneut anzumelden – der virtuelle Authenticator bietet ihn an, der Server antwortet „Dieser Passkey gehört zu keinem Profil." Die beiden Elternteil-Wege sind dagegen nur an der Bestätigungsfläche geprüft (öffnen, falscher Name sperrt, abbrechen – nie wirklich löschen): Der Dev-Actor-Bypass zeigt in jedem E2E-Lauf dasselbe Seed-Elternteil, ein echter Klick nähme jedem anderen Spec-File seine Grundlage
- Wiederherstellung nach Passkey-Verlust (F-06d): Ein angemeldetes Elternteil erzeugt in den Einstellungen einen Link für das gerade gewählte Kind – zwei Stunden gültig, einmal einlösbar. Einlösen ist keine Anmeldung, sondern eine weitere Passkey-Registrierung für ein bestehendes Kind, auf dem neuen Gerät; das alte entfernt das Elternteil danach in der Geräteliste (F-06b). Verbraucht wird der Token erst nach erfolgreicher WebAuthn-Zeremonie – ein vorab öffnender Scanner kann sie nicht abschließen, das verlangt einen echten Authenticator
- Vierte Anmeldeschleuse `tutr.recovery_token_hash`, rein lesend. Verbraucht wird der Token über eine eigene `security definer`-Funktion `app.redeem_recovery_token()`, die Prüfen und Löschen in einem UPDATE erledigt – zwei gleichzeitige Einlöseversuche mit demselben Token können damit nicht beide gewinnen. Bewusst **keine** UPDATE-Policy für die Rolle „student": RLS schränkt nicht spaltenweise ein, eine solche Policy gäbe dem Kind nebenbei die Fähigkeit, sein ganzes Profil zu ändern – eine Entscheidung, die F-06c trifft, nicht dieses Ticket
- Der Link ist bewusst kein `<a>` – ein Klick soll ihn kopieren, nicht das Elternteil selbst auf die Einrichtungsseite des Kindes schicken. Kopier-Knopf mit `navigator.clipboard`, und ein ehrlicher Rückfall: Schlägt das Kopieren fehl (kein sicherer Kontext, z. B. Aufruf über eine bloße IP im lokalen Netz), wird der Text stattdessen markiert – kein Haken, der dann lügen würde
- Nur der Weg über ein angemeldetes Elternteil ist gebaut. Der zweite in ADR 0006 D4 vorgesehene Weg – Adresse eintippen, ganz ohne Elternkonto, per Mail – ist als F-06f vertagt: Er braucht eine verifizierte Resend-Domain (sonst nicht zustellbar, also auch nicht End-to-End prüfbar) und eine Ratenbegrenzung, die es im Projekt noch nirgends gibt
- Zwei echte Testfunde beim Bauen: (1) Der neue „Neues Gerät einrichten"-Block zeigte anfangs denselben `trailing`-Text „von {Name}" wie der Passkeys-Block – ein Playwright-Test mit `getByText` schlug im Strict Mode fehl, weil der Text jetzt zweimal vorkam. (2) Zwei parallel laufende E2E-Tests erzeugten unabhängig voneinander einen Wiederherstellungslink für dasselbe Seed-Kind und überschrieben sich gegenseitig den Token (ADR 0006 D4: „ein neuer Link überschreibt den alten") – die Zeremonie-Tests laufen jetzt gegen ein direkt in der Datenbank angelegtes Wegwerf-Kind statt gegen ein Seed-Kind, das andere Testdateien als unberührt voraussetzen
- `recoveryCandidate()` und `redeemRecoveryToken()` bekommen dieselbe `databaseConfigured()`-Absicherung wie die Einstellungsseite (F-06b) – sonst hinge `/wiederherstellen` bei fehlender `DATABASE_URL` genauso lautlos

- Elternbeitritt (F-06b): Fordert ein Elternteil zum ersten Mal einen Magic Link an und die von Supabase bestätigte Adresse passt zu einem oder mehreren Kindern, entstehen `parent_account` und alle passenden `parent_student`-Verknüpfungen automatisch, in einer Transaktion – kein zweiter Klick, kein separates „Einverstanden". Der Magic-Link-Login an dieser Adresse _ist_ die Handlung, die laut ADR 0006 D8 verknüpft; `consent_at` wird deshalb sofort gesetzt. Passt die Adresse zu keinem Kind, entsteht kein Konto (D1) – das Elternteil sieht denselben leeren Zustand wie ein Konto ohne Kinder, kein eigenes Datenbankfeld dafür (D7)
- Neue `security definer`-Funktion `app.students_by_parent_email()` löst dabei ein weiteres Henne-Ei-Problem: Ohne bestehendes Elternkonto liefert RLS auf `student` nichts, also lässt sich nicht herausfinden, welche Kinder eine Adresse eingetragen haben. Eng geschnitten – nur `id`, `first_name`, `grade_level`, keine sensiblen Daten – und nur mit der serverseitig bestätigten Adresse aufgerufen, nie mit einer vom Client gelieferten
- Kind-Umschalter im Kopfbereich für Eltern mit mehr als einem Kind (Cookie + Server Action, analog zum bestehenden Ansichts-Umschalter), plus eine schmale Einstellungsseite (`/einstellungen`) mit Kindliste und Geräteliste – Passkeys und aktive Sitzungen als zwei getrennte Listen, weil sie sich nicht verlässlich einander zuordnen lassen (ein Passkey trägt keinen Gerätenamen, eine Sitzung nur den rohen User-Agent-String)
- Ein echter Bug, den erst der volle E2E-Test aufgedeckt hat: Der Dev-Actor-Bypass (`TUTR_E2E_ACTOR`) gab immer einen fest verdrahteten Actor zurück und ignorierte das Kind-Umschalter-Cookie vollständig – der Umschalter wäre sichtbar gewesen, hätte aber nichts bewirkt. Ein erster Test, der nur „Umschalter zeigt beide Kinder an" prüfte, wäre grün geblieben; erst ein Test, der tatsächlich umschaltet und das Ergebnis liest, hat es gefunden
- Und ein zweiter, den erst die CI zeigte, weil lokal `.env.local` den Unterschied verdeckte: Die E2E-Umgebung läuft ohne `DATABASE_URL` (`SKIP_ENV_VALIDATION=1`, keine echte Verbindung nötig – bis F-06b brauchte keine Seite unter dem Dev-Actor-Bypass eine). `/einstellungen` ist die erste, die es tut, und ein ungeprüfter `postgres(undefined, …)`-Aufruf hing dort nicht mit einem Fehler, sondern mit einem 30-Sekunden-Navigationstimeout. Neue `databaseConfigured()` in `env.ts`, analog zu `supabaseConfig()`, schützt jetzt alle drei Server Actions der Einstellungsseite
- Anmeldung des Kindes (F-06): Selbstanlage des Profils, Passkey-Registrierung, Einwilligungsmail an die Eltern, rollierende Session über 30 Tage. `/registrieren` fragt Vorname, Jahrgang und Elternadresse; danach ist die App sofort nutzbar. Wiederkommen ist ein Tipp auf „Mit Face ID anmelden" – ohne Benutzername, ohne E-Mail
- Die Klasse wird bei der Anmeldung **nicht** gefragt, anders als in ADR 0005 zuerst vorgesehen. Ihr einziger Verbraucher ist der Gruppenfilter beim Klausurplan-Import (K-03), und maßgeblich steht sie dort am Schuljahr – an `student` wäre sie nur ein Startwert. Der erste Bildschirm bleibt dafür um ein Feld kürzer
- Zwei Fehler, die erst der virtuelle Authenticator im E2E-Test zeigte, und beide hätten die Anmeldung komplett blockiert: (1) Die Challenge wurde doppelt base64url-kodiert – `@simplewebauthn` behandelt eine _Zeichenkette_ als Rohbytes und kodiert sie ein zweites Mal, also müssen die Bytes selbst hinein und die base64url-Fassung ins Cookie. (2) Eine JS-Liste in einem Drizzle-`sql`-Literal wird zur Wertliste `($1)` ausgerollt statt als Array gebunden, was `transports` (`text[]`) mit „malformed array literal" quittierte – die drei Inserts der Registrierung laufen jetzt über den Query-Builder
- `RESEND_API_KEY` und `RESEND_FROM` haben ein eigenes schmales `mailEnv()`, `AUTH_COOKIE_SECRET` ein `authEnv()` – wie `dbEnv()` und aus demselben Grund: Weder Anmeldung noch Mailversand sollen daran scheitern, dass ein `ANTHROPIC_API_KEY` fehlt. `sendeMail()` wirft jetzt nie, denn nach ADR 0005 hält die Einwilligungsmail ausdrücklich niemanden auf
- Die Entwicklungsumgebung sagt auf `/registrieren` laut, dass Resend ohne verifizierte Domain nur an die Adresse des eigenen Kontos ausliefert. Sonst fällt es erst auf, wenn eine echte Elternadresse ins Leere läuft
- „Abmelden" beendet jetzt beide Wege. Ein Browser kann eine Eltern- und eine Kind-Session tragen; vorher hätte der Knopf sichtbar nichts getan
- Auf der Anmeldeseite steht der Weg des Kindes oben und königsblau, der Elternweg darunter und leise – zwei gleich starke Knöpfe hätten keine Rangfolge. Ein E2E-Test prüft diese Reihenfolge über die Position, nicht nur über die Existenz
- `eslint.config.mjs` ignoriert `playwright-report/` und `test-results/`. Sie stehen in `.gitignore`, aber ESLint 9 liest die nicht – ohne das scheitert `npm run check`, sobald jemand die E2E-Tests mit dem HTML-Reporter laufen lässt

- `src/db/index.ts` baut die Verbindung erst beim ersten Zugriff auf (`getSql()` / `getDb()` statt Modul-Konstanten). Vorher scheiterte jeder Import einer Datei, die davon abhängt, ohne gesetzte `DATABASE_URL` – in CI, im Build und in Tests, die die Datenbank nicht anfassen
- `npm run db:doctor` meldet ein abweichendes Passwort ohne Längenangabe – CodeQL hatte die Ausgabe der Zeichenzahl zu Recht als Klartext-Logging eines Geheimnisses gemeldet
- `npm run db:test` setzt `--testTimeout=30000`. Zwei Tests liefen in CI in die voreingestellte 5-Sekunden-Grenze, lokal nie. Ursache ist Latenz, nicht Nebenläufigkeit: Die CI-Runner stehen laut Runner-Log in `northcentralus`, die Test-Datenbank in Frankfurt, und jede `withActor`-Transaktion kostet rund sechs Rundreisen (Rolle setzen, drei Session-Variablen, Abfrage, Commit). Lokal gemessen ~21 ms pro Rundreise, über den Atlantik ein Vielfaches. Ein erster Versuch über `--no-file-parallelism` war eine Fehldiagnose und ist zurückgenommen – dieselben zwei Tests scheiterten sequenziell mit exakt derselben Grenze
- Anmeldung und Rollenwahl getrennt: Der Dev-Actor umging bisher die **ganze** Anmeldung, obwohl nur die Rollenwahl fehlte – `/heute` war ohne Session erreichbar. Jetzt verlangt der Proxy in **jeder** Umgebung eine Anmeldung; der Umschalter sitzt dahinter und wechselt nur die _Sicht_ eines angemeldeten Elternteils auf ein Kind der eigenen Familie (nötig, solange F-06 fehlt und ein Kind sich gar nicht anmelden kann). Damit läuft der echte Anmeldeweg bei jeder Entwicklungssitzung mit
- Playwright nutzt dafür eine ausdrückliche Test-Umgehung `TUTR_E2E_ACTOR`, doppelt abgesichert (nicht Produktion **und** Variable gesetzt) und nur gesetzt in `playwright.config.ts`. Sie verschwindet mit F-10, sobald sich die Tests echt anmelden können
- Proxy und Actor-Auflösung stürzen nicht mehr ab, wenn Supabase nicht konfiguriert ist. Mit `SKIP_ENV_VALIDATION=1` liefert `clientEnv()` undefinierte Werte, `createServerClient` warf – und weil der Proxy bei jeder Anfrage läuft, lag die ganze App still. Genau das ließ die E2E-Tests in CI scheitern, lokal aber nicht, weil dort `.env.local` liegt. Jetzt entscheidet die Umgebung: außerhalb der Produktion durchlassen (dort übernimmt der Dev-Actor), produktiv zur Anmeldung leiten statt stillschweigend durchzulassen
- `/auth/callback` nimmt keine `token_hash`-Links mehr an. Der Zweig war ein GET, das einen Einmal-Token einlöst – also genau der Weg, über den Mailprogramme Links vorab verbrauchen. Er hätte die Zwischenseite ausgehebelt, sobald irgendetwas darauf verlinkt. Eingelöst wird jetzt nur noch an einer Stelle, hinter einer abgeschickten Form. CodeQL hatte die Stelle als `js/user-controlled-bypass` gemeldet; der eigentliche Fund war größer als die Meldung
- Zwischenseite `/anmelden/bestaetigen` löst das Problem, dass der Anmeldelink erst beim zweiten Versuch funktionierte: Mailprogramme öffnen Links vorab und verbrauchen dabei den Einmal-Token. Die Seite tut beim Laden **nichts** – eingelöst wird erst beim Drücken des Knopfes, also durch eine abgeschickte Form. Ein Vorab-Öffner macht nur GET-Anfragen und kann sie nicht auslösen. Das ist auch Supabase' eigene Empfehlung für diesen Fall. Verlangt die umgestellten E-Mail-Vorlagen (Token-Hash statt ConfirmationURL)
- Anmeldefehler erklären sich jetzt selbst: Supabase übergibt den Grund im **Hash-Fragment** (`#error_code=otp_expired`), das den Server nie erreicht – der Callback sah nur „kein Code" und warf wortlos auf die Anmeldeseite zurück. Eine kleine Client-Komponente liest Fragment und Query aus und zeigt eine deutsche Erklärung, inklusive des häufigsten Falls: Mailprogramme öffnen den Link vorab und verbrauchen dabei den Einmal-Token
- Der Callback löst zusätzlich `token_hash`-Links selbst ein (`verifyOtp`), nicht nur PKCE-`code`. Damit funktionieren die Standard-Vorlagen weiter _und_ die von Supabase für SSR empfohlenen Token-Hash-Vorlagen, die dem Vorab-Öffnen durch Mail-Scanner besser standhalten. Das `weiter`-Ziel wird auf app-interne Pfade begrenzt, damit daraus keine offene Weiterleitung wird
- Anmeldung für Eltern (F-05): Magic Link über Supabase Auth, Session-Auffrischung in `src/proxy.ts` – in Next 16 heißt die Datei so, `middleware.ts` ist veraltet. Anmeldeseite mit konkreter Fehlermeldung statt stillem „Schau ins Postfach", Rückweg über `/auth/callback`, Abmelden im Kopfbereich. Der Dev-Actor bleibt Rückfall, aber nur außerhalb der Produktion
- Neue Policy `parent_user_selbst` (`src/db/policies/0040-auth.sql`) löst ein Henne-Ei-Problem: Nach dem Login ist die Auth-ID bekannt, die Familie aber nicht – während die Policies auf `parent_user` bereits `family_id` verlangen. Statt einer Ausnahme von der `withActor()`-Regel gibt es einen weiteren Helper `app.auth_user_id()` und eine eng geschnittene Policy: nur SELECT, nur die eigene Zeile. Sechs Tests grenzen sie ein
- Erster Login legt Familie und Elternkonto an. In der Entwicklung dockt er stattdessen an die Seed-Familie an, damit nicht zwei Welten nebeneinander stehen – der Dev-Umschalter zeigt ja auf sie
- Playwright läuft jetzt gegen `next dev` statt gegen den Produktions-Build: Dort ist der Dev-Actor hart aus, der Proxy hätte jeden Test auf `/anmelden` umgeleitet. Eine echte Anmeldung im Test bräuchte serverseitig erzeugte Magic Links und CI-Secrets – als F-10 vermerkt. Build-Fehler fängt weiterhin der eigene Build-Schritt
- **ADR 0005** kehrt die Anmeldelogik um: Das Kind meldet sich selbst an (Passkey, Selbstanlage des Profils), die Einwilligungsmail geht danach an die Eltern und blockiert nichts. Der Auslöser war ein Alltagsfall – zeigt die Tochter die App einer Freundin, müsste erst ein Erwachsener drei Schritte gehen. Die tragende Beobachtung: Eltern-zuerst prüft die Elternschaft kein bisschen besser als Kind-zuerst, in beiden Fällen tippt jemand eine Adresse ein. Damit entfällt der Einladungs-Mechanismus samt Tabelle, Ablauf, Einmaligkeit und Oberfläche – der neue Weg ist weniger Code als der alte. Die Elternadresse bleibt Pflicht, aber als Wiederherstellungsanker, nicht wegen der Einwilligung
- Tickets entsprechend neu geschnitten: **F-06a entfällt** (ersetzt die zuvor hier vermerkte Aufteilung), F-06 wird die Kind-Anmeldung, neu ist **F-06b** für den Elternbeitritt zu einer bestehenden Familie. Das Datenmodell bleibt unverändert – `family` ist der Mandantenschlüssel, den jede Policy vergleicht, auch bei genau einem Kind
- Beispieldaten (F-04e): `npm run db:seed` legt zwei Familien an – Familie A mit Kind und Geschwisterkind, Familie B als Gegenprobe – dazu aktive Schuljahre, sechs Fächer, zwei Themen mit Lernzielen und einem fachübergreifenden Vorläufer sowie ein kuratiertes Lehrwerk mit Kapiteln. Idempotent und eng begrenzt: löscht ausschließlich die eigenen festen IDs. Sieben Tests belegen, dass die Daten unter den echten Policies das zeigen, was sie sollen
- Die festen IDs liegen in `src/db/seed-ids.ts` und werden von Seed **und** Dev-Actor benutzt. Vorher hatte `dev-actor.ts` eigene Konstanten – eine Doppelung, die stillschweigend hätte auseinanderlaufen können. Statt eines Tests dagegen gibt es die Doppelung nicht mehr
- Testabgrenzung korrigiert: Kuratierte Zeilen (`family_id is null`) sind für alle Familien sichtbar – ihr Zweck. Tests, die alle Lehrwerke auflisteten, sahen deshalb auch die Fixtures anderer Testdateien. Die Abfragen grenzen jetzt auf die eigenen IDs ein
- F-04g (Kurrikulum-Pack-Schema) nach Meilenstein 2 verschoben, direkt vor T-05 – dort, wo ein echtes Bildungsplan-PDF die Form bestimmen kann
- App-Shell (F-07): fünf Bereiche als Route-Group `(app)` mit gemeinsamem Layout und Mobile-Navigation (`useSelectedLayoutSegment` für den aktiven Zustand), `/` leitet auf `/heute`. Designsprache umgesetzt – Designtokens in `globals.css` als Tailwind-4-`@theme` für beide Themes, Familjen Grotesk (Bedienung) und Newsreader (Inhalt) über `next/font/google`. Wiederverwendbare Bausteine in `src/components/shell/bausteine.tsx`: Lernpfad-Leiste, Mastery als zwei Zahlen, Kontext-Chip, Vokabelstapel. Web-App-Manifest als Metadata-Route mit Icons. 11 E2E-Tests
- Dev-Actor (`src/lib/dev-actor.ts`) überbrückt F-05/F-06: Die Shell muss wissen, _ob_ Elternteil oder Kind davorsitzt, nicht _wie_ angemeldet wurde. In Produktion über `NODE_ENV` hart deaktiviert; der Umschalter läuft über eine Server Action, damit die Prüfung serverseitig passiert. Client-sichere Konstanten liegen getrennt in `dev-actor-shared.ts`, sonst zöge `next/headers` das Server-Modul ins Client-Bundle
- Service Worker aus F-07 herausgelöst (→ F-09): `@serwist/next` arbeitet über ein Webpack-Plugin, `next build` läuft in Next 16.3.4 mit Turbopack (nachgemessen). Die Alternativen kosten eine neue Dependency; da offline erst ab V-02 etwas zu cachen ist, wird die Entscheidung dorthin vertagt
- Regeln festgeschrieben (F-04f): CLAUDE.md bekommt die Actor-Regel (jeder DB-Zugriff durch `withActor()`, direkter `db.*`-Zugriff nur in Migrationen/Seeds/Cron und dort begründet) und eine aktuelle Befehlsliste (`db:migrate:test`, `db:test`, `db:doctor` fehlten). `src/db/policies/README.md` beschreibt jetzt die Checkliste je neuer Tabelle und die drei Policy-Muster inklusive der Begründung, warum kuratiert-oder-eigen zwei Policies braucht
- Reihenfolge in Meilenstein 0 geändert: **F-07 (App-Shell) vor F-05/F-06 (Auth)**. Die Shell hängt nicht an echter Authentifizierung – ein Dev-Actor mit Eltern/Kind-Umschalter liefert genau das, was `withActor()` erwartet. Damit wird das Datenmodell sichtbar überprüfbar und die Teile, die Iteration mit der Nutzerin brauchen, kommen früher. F-04e (Seed) rutscht hinter F-07, weil die Policy-Tests ihre Fixtures selbst bauen
- Schema Lehrwerk-Registry (F-04d): `textbook`, `chapter`, `school_year_textbook` in `src/db/schema/textbook.ts`, `school_profile` in `src/db/schema/school-profile.ts`. Erstmals das kuratiert-oder-eigen-Muster (ADR 0004 D7): `family_id` nullable, NULL = kuratiert. Pro Schuljahr und Fach genau ein Lehrwerk (§8 `lehrwerke{fach→id}` als Join-Tabelle mit Unique-Constraint). Enum `textbook_source` unterscheidet Foto / manuell / Claude-Vorwissen / Verlags-PDF – nötig, weil Claudes Vorschläge laut §10 in der UI markiert werden müssen. 29 Tests
- **Sicherheitskorrektur in ADR 0004 D7:** Die dort skizzierte einzelne Policy `using (family_id is null or family_id = app.family_id())` war angreifbar – bei `UPDATE` passiert eine kuratierte Zeile den `USING`-Filter, und dasselbe Update kann ihr `family_id` auf die eigene Familie setzen. Eine Familie hätte geteilte Referenzdaten für alle anderen kapern können. Jetzt zwei getrennte Policies (Lesen: kuratiert oder eigen; Schreiben: nur eigen, in `USING` _und_ `WITH CHECK`). Die Lücke wurde vor dem Fix reproduziert und der Fix danach gegengeprüft
- ADR 0004 D4: `school_profile` stand in der Matrix fälschlich bei den familieneigenen Tabellen und folgt jetzt D7 – mehrere Familien können dieselbe Schule besuchen
- F-04d halbiert: `curriculum_pack`/`curriculum_node` haben vor dem 25. 9. keinen Konsumenten (erst T-05, Meilenstein 2) und würden ohne ein echtes Bildungsplan-PDF geraten. Als F-04g direkt vor T-05 vertagt
- Schema Schuljahr/Fach/Thema/Lernziel (F-04c): `school_year`, `subject`, `topic`, `learning_objective`, `objective_prerequisite` in `src/db/schema/curriculum.ts` mit drei neuen Enums (`school_year_status`, `topic_status`, `pathway_stage`, `self_assessment_level`). Fachbindung als DB-Constraint (§15 Fehler 2, ADR 0004 D3): `topic` referenziert `subject` über einen zusammengesetzten Fremdschlüssel auf `(id, student_id)`, ein Insert mit fachfremdem Fach scheitert an der Datenbank statt an Anwendungscode – per Test bewiesen. Genau ein `aktiv`-Schuljahr pro Schüler als partieller Unique-Index (§9). Zeitscheibe endet bei `topic` (ADR 0004 D6): `card`/`review`/`vocab_*` bekommen `school_year_id` bewusst nicht. `objective_prerequisite` als Selbstreferenz mit CHECK gegen Zirkularität (ein Lernziel kann nicht sein eigener Vorläufer sein). `learning_objective.title` und die drei Niveaubeschreibungs-Spalten (`description_grundlegend/regel/erhoeht`) sind Ergänzungen über die reine §8-Feldliste hinaus. `topic.source`/`curriculum_node_ref`/`textbook_ref` und `school_year.school_profile_id`/`curriculum_pack_id` bewusst ohne Fremdschlüssel, bis F-04d die Referenzdaten anlegt. 21 Policy- und Constraint-Tests
- `drizzle.config.ts` schließt jetzt auch `objective_prerequisite`-lange Fremdschlüsselnamen ein: zwei Constraint-Namen überschritten Postgres' 63-Zeichen-Grenze für Identifier und wurden explizit gekürzt benannt (`objective_prerequisite_student_fk`, `objective_prerequisite_prerequisite_fk`)
- Naming-Korrektur (vor F-04c): Bezeichner durchgängig englisch statt eines einzigen deutschen Ausreißers. `student.vorname/jahrgang/klasse` → `first_name/grade_level/class_name`; geplant `thema` → `topic`, `lehrwerk` → `textbook`, `kapitel` → `chapter` (ADR 0004 D8, CLAUDE.md-Kernkette). Migrationshistorie neu erzeugt (Produktiv-DB war noch leer, kein Datenverlust). Domänen-_Werte_ (Enum-Werte wie `erhoeht`) bleiben unverändert deutsch – nur Bezeichner ändern sich. Nebenbei: `drizzle.config.ts` schließt `*.test.ts` per Extglob vom Schema-Scan aus (drizzle-kit unioniert sonst alle `*.ts`-Treffer ohne Ausschluss-Semantik und versucht Testdateien als Schema zu laden)
- Schema Familie/Identität (F-04b): `family`, `parent_user`, `student` in `src/db/schema/family.ts` mit `family_id` und zusammengesetzten Fremdschlüsseln (ADR 0004 D2), erste Drizzle-Migration, Policies in `src/db/policies/0010-family.sql` und sieben Policy-Tests – Eltern sehen die ganze Familie, ein Kind nur sein eigenes Profil und ändert es nicht. Kind-Profile bleiben pseudonym (Vorname, Jahrgang, Klasse)
- `npm run db:migrate` wendet Migrationen **und** Policies an (vorher nur Policies); `db:migrate:test` macht dasselbe für die Test-Datenbank. Die Rolle `tutr_app` bekommt ihr Passwort nur beim Anlegen – ein `alter role ... password` vor jedem Lauf ließ den Pooler die nächste Anmeldung sporadisch mit 28P01 abweisen und war die Ursache eines flaky CI-Jobs. Rotation jetzt bewusst über `-- --rotate-password`
- RLS-Fundament (F-04a): Laufzeit-Rolle `tutr_app` (NOBYPASSRLS) und Helper `app.family_id()` / `app.student_id()` / `app.actor_role()` in `src/db/policies/0000-setup.sql`; `withActor()` in `src/db/actor.ts` setzt Rolle und Request-Kontext per `SET LOCAL`; Runner `scripts/db-apply-sql.mts` (`npm run db:policies`, in `db:migrate` verdrahtet); Test-Datenbank-Anbindung mit Wächter gegen Läufe auf dem Produktivprojekt; Tests für Fail-closed, Familientrennung und Transaktionsende; RLS-Metatest über alle Tabellen in `public`; CI-Job für die DB-Tests; `npm run db:doctor` prüft Rolle, Port, `sslmode` und Passwort einer Umgebung, ohne Geheimnisse auszugeben
- ADR 0004 (F-03): Datenmodell und RLS-Strategie – Actor-Kontext über eigene DB-Rolle `tutr_app` statt `auth.uid()` (Kind hat keinen Auth-Account, ADR 0002), `family_id` per zusammengesetztem Fremdschlüssel, Fachbindung als DB-Constraint (§15), Join-Tabellen statt ID-Arrays, Eltern-Sicht über getrennte Zusammenfassungstabellen, RLS-Metatest. Am Projekt gemessen: PG 17.6, `SET LOCAL ROLE` und Custom-GUCs über den Transaction Pooler bestätigt
- Tickets F-04a–f (Schema in Sessions geschnitten) und L-01 (Lehrwerk pro Fach erfassen)
- Supabase-Anbindung (F-02): Projekt in Frankfurt (`eu-central-1`), Browser- und Server-Client (`src/lib/supabase/`), Drizzle-Verbindung über postgres.js (`src/db/index.ts`, `prepare:false` für den Transaction Pooler), `drizzle.config.ts`, `dbEnv()` in `src/lib/env.ts`, Verbindungstest `npm run db:check` (grün)
- Projektgerüst: Next.js 16, TypeScript strict, Tailwind 4
- CLAUDE.md mit Domänen-, Stack- und Prozessregeln; Slash-Commands und Subagenten unter `.claude/`
- Tests: Vitest + Testing Library, Playwright (mobile + desktop), erstes Modul `src/lib/grades.ts`
- Git-Hooks (lint-staged, typecheck + Tests, Conventional Commits)
- CI (lint, typecheck, tests, build, e2e) und Security-Pipeline (gitleaks, npm audit, CodeQL), Dependabot
- Security-Header, Zod-validierte Umgebungsvariablen
- Docs: Konzept v2, Backlog, ADR 0001/0002/0003, SECURITY.md, SETUP.md
- Konzept §15: Ergänzungen aus Astra-Walkthrough (Selbsteinschätzung, Hook-Szenario, Zielnote, Prüfungsvorbereitungs-Seite, Anschlussfragen, Spracheingabe in V2); Tickets P-01, T-02a/b

### Changed

- Supabase auf das neue API-Key-System umgestellt (ADR 0003): `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`; betrifft `src/lib/env.ts`, `.env.example`, `docs/SETUP.md`
- Datenmodell-ADR verschiebt sich auf 0004 (F-03), da 0003 nun die API-Keys dokumentiert
- `tsconfig.json` schließt iCloud-Sync-Dubletten (`* 2.ts` u. ä.) vom Typecheck aus, damit `npm run check` lokal im iCloud-Ordner grün bleibt
- Dependabot-Major-PRs (eslint 10, TypeScript 7, @types/node 26) geschlossen; als Ticket F-08 vertagt
- Playwright-Setup deckt jetzt WebKit (iOS-Safari) ab, nicht nur Chromium – CI und `scripts/bootstrap.sh`
- GitHub Actions auf aktuelle Majors gehoben (`checkout`/`setup-node`/`upload-artifact` v7, `codeql-action` v4), weg von Node-20-Runnern
- `gitleaks-action` v2 → v3

### Fixed

- CI-Job `e2e` schlug fehl, weil das `mobile`-Playwright-Projekt (iPhone 14 → WebKit) ohne installierten WebKit lief
- CI-Job `secrets` schlug beim ersten Push fehl (gitleaks-action v2, fehlerhafte Commit-Range)
- `.env.example` fehlte im Repo, obwohl `bootstrap.sh`/`SETUP.md` sie voraussetzen (+ `.gitignore`-Ausnahme)
- `.gitignore` ignoriert jetzt Playwright-Artefakte (`test-results/`, `playwright-report/` u. a.)
- `.prettierignore`: kaputte erste Zeile `-e .next` → `.next`

### Security

- `browserslist` per `overrides` auf 4.28.9 gehoben (2× High, GHSA-c83g-rgw3-j3cx / GHSA-73wf-gq98-2v4g); `@serwist/next` pinnt die verwundbare 4.28.6 fest
- GitHub-Repo auf public umgestellt; Secret Scanning + Push Protection und Branch-Ruleset für `main` aktiviert
