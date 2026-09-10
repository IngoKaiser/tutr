# ADR 0010: Der Tutor streamt über einen Route Handler, Stufe 1 ohne Kontextpaket

Status: **vorgeschlagen** · Datum: 2026-09-10 · Bezug: docs/konzept.md §4, §10, §11, §15
Weicht bewusst von der Stack-Regel „Route Handler nur für Uploads, Webhooks, Cron"
(CLAUDE.md) ab und begründet das in D1.
Setzt [ADR 0004](0004-datenmodell-rls.md) D3/D4 um, verschiebt aber eine der dort
vorgesehenen Tabellen (D2 hier).
Tickets: T-01 (schmal, dieser ADR), T-02 (schmal), T-02a, S-03. T-01 (voll) und
T-02 (voll) erben die offenen Enden aus „Konsequenzen".

## Kontext

`docs/roadmap.md` Stufe 1 des Tutors ist knapp beschrieben:

> Ein Chatfenster. Kontext-Chip mit Fach (Thema optional). Zwei Einstiege: freie Frage
> und „Verstehen". Schema `tutor_session`/`tutor_message` **mit RLS von Anfang an**.
> Sprachwächter aktiv. Antworten aus Allgemeinwissen, ausdrücklich als solches
> gekennzeichnet. Rate Limit.

Das ist der erste Ort im Projekt, an dem ein Kind eine **freie Eingabe** an ein
Sprachmodell schickt. Bisher gab es genau einen KI-Aufruf (V-03b, Vokabelerkennung aus
einem Foto): ein Bild rein, ein Zod-Schema raus, fertig. Ein Chat bricht mit allen drei
Eigenschaften dieses Aufrufs — er ist lang, er ist zustandsbehaftet, und seine Antwort
ist Fließtext statt einer Struktur. Vier Fragen fallen dabei zusammen.

### 1. Server Actions können nicht streamen

Alles Schreibende im Projekt läuft über Server Actions; die Stack-Regel in CLAUDE.md
ist eindeutig und hat sich über zehn Tickets bewährt. Eine Server Action gibt aber
einen **Wert** zurück, keine `Response` — und damit keinen `ReadableStream`. Wer den
Aufruf trotzdem in eine Server Action legt, bekommt die vollständige Antwort am Stück.

Gemessen an der Vokabelerkennung (V-03b, Sonnet, ~8000 Ausgabetoken erlaubt, real
1–3 s) und an der Länge einer Erklärung für Jahrgang 8 (300–600 Ausgabetoken) heißt
„am Stück" hier **5 bis 10 Sekunden Stille**. §15 verlangt für Wartezeiten über
3 Sekunden benannte, wahre Schritte statt eines Spinners — nur gibt es bei einem
einzigen Modellaufruf keine wahren Zwischenschritte zu benennen. „Material gelesen ·
Lernziele zugeordnet" wäre in Stufe 1 schlicht gelogen, weil kein Material gelesen
wird (siehe D5).

### 2. ADR 0004 D4 sieht drei Tabellen vor, Stufe 1 füllt zwei

[ADR 0004](0004-datenmodell-rls.md) D4 legt fest, wie „Eltern sehen nie
`tutor_sessions`" strukturell erzwungen wird: `tutor_session` und `tutor_message`
bekommen **keine** Eltern-Policy, und was Eltern sehen dürfen, steht in einer eigenen
Tabelle `tutor_session_summary`. Die Begründung ist unverändert richtig — Postgres
kennt keine spaltenweise Sichtbarkeit innerhalb einer Policy.

Stufe 1 kennt aber weder einen Sessionabschluss noch eine Elternsicht auf den Tutor.
Der Zweizeiler, den §4a beschreibt („5 Aufgaben, 4 selbst gelöst, 1 mit Lösung"),
entsteht erst mit dem Hausaufgaben-Einstieg (T-03).

### 3. Sprachwächter und Streaming vertragen sich nur halb

§15 nennt den Sprachrutscher als ersten der beiden beobachteten Fehler, die tutr per
Test ausschließt: Der Astra-Tutor begrüßte auf Englisch in einer deutschen Lektion.
T-02a verlangt „Systemprompt-Sprache + Unit-Test, dass Tutor-Antworten deutsch sind".

Ein Unit-Test kann die API nicht anrufen. Und wer streamt, kann die fertige Antwort
nicht mehr prüfen und verwerfen — die ersten Wörter stehen längst auf dem Schirm des
Kindes. Prävention und Kontrolle fallen hier auseinander.

### 4. Ab dem ersten Tutor-Klick kostet jede Frage Geld

Bisher kostete nur der Foto-Import, und den löst man ein paar Mal pro Woche aus. Ein
Chatfenster lädt zum Klicken ein. Überschlag für Sonnet, eine Antwort mit ~1000
Eingabe- und ~600 Ausgabetoken:

```
1000 · $3/M  +  600 · $15/M  ≈  $0,003 + $0,009  ≈  1,1 Cent je Antwort
```

Konzept §11 veranschlagt „~5–15 €/Monat bei täglicher Einzelnutzung". 15 € sind bei
diesem Preis rund 1300 Antworten im Monat, also gut 40 am Tag. Ohne Deckel ist ein
festhängender Client oder ein gelangweilter Nachmittag teurer als der Rest des
Betriebs zusammen. Das Projekt hat keinen Redis, kein Upstash und keine
Rate-Limit-Bibliothek.

## Entscheidung

### D1 · Genau ein Route Handler, streamend — die Abweichung wird hier dokumentiert, nicht stillschweigend genommen

`POST /api/tutor` als Route Handler (`src/app/api/tutor/route.ts`), der die
Modellantwort als Textstream zurückgibt. Das ist eine Abweichung von der Stack-Regel
in CLAUDE.md, und sie gilt **nur** für diesen einen Endpunkt: Alles andere am Tutor —
Session anlegen, umbenennen, löschen — bleibt Server Action.

Die Regel existiert, um einen wildwachsenden REST-Zweig neben den Server Actions zu
verhindern. Dieser Endpunkt ist kein REST-Zweig, sondern die einzige Stelle im
Projekt, an der die Antwort **während** ihrer Entstehung gebraucht wird. Er trägt
deshalb im Dateikopf einen Verweis auf diesen ADR.

Was eine Server Action geschenkt bekommt, muss der Handler selbst tragen:

| Was          | Wie                                                                                 |
| ------------ | ----------------------------------------------------------------------------------- |
| Wer fragt    | `loginStatus()` — derselbe Weg wie überall, kein eigener Auth-Pfad                  |
| Nur das Kind | `actor.role === "student"`; ein Elternteil bekommt 403, nicht bloß eine leere Liste |
| Deckel       | `rateLimit()` **vor** dem Modellaufruf (D4)                                         |
| Schreiben    | `withActor()`, nicht direktes `db.*`                                                |

**Die Reihenfolge des Schreibens ist Teil der Entscheidung**, weil sie sonst beim
Bauen zufällig ausfällt:

1. Session anlegen, falls es noch keine gibt.
2. **Nutzernachricht schreiben, bevor das Modell gefragt wird.** Bricht der Stream ab
   — Netz weg, Tab zu, Modell fällt aus — steht die Frage trotzdem im Verlauf. Anders
   herum entstünde ein Loch, das aussieht, als hätte das Kind nie gefragt.
3. Streamen.
4. Antwort **nach** dem Stream als eine Zeile schreiben, mit der Zahl der verbrauchten
   Token. Ein abgebrochener Stream hinterlässt eine Frage ohne Antwort — ein ehrlicher
   Zustand, den die Oberfläche als „abgebrochen" zeigen kann.

Kein Persistieren einzelner Token-Häppchen. Der Verlauf ist eine Liste von Nachrichten,
kein Ereignisprotokoll.

### D2 · Zwei Tabellen jetzt, die dritte, wenn sie etwas zu tragen hat

`tutor_session` und `tutor_message` entstehen mit T-02, mit RLS von Anfang an.
`tutor_session_summary` **nicht**.

ADR 0004 D4 bleibt vollständig gültig — das hier ist eine Aussage über die
Reihenfolge, kein Widerspruch. Eine Tabelle, die niemand schreibt, ist ein Versprechen
an die Elternsicht, das nichts einlöst: Der Elternteil bekäme eine Policy und eine
leere Liste, und niemand sähe dem Schema an, dass das Absicht ist. `tutor_session_summary`
kommt mit **T-03**, wo §4a den Zweizeiler definiert, der hineingehört.

Bis dahin gilt für Eltern schlicht: kein Zugriff auf den Tutor, keine Policy, kein
Eintrag in der Oberfläche.

Schnitt der beiden Tabellen:

```sql
tutor_session (id, student_id, subject_id, topic_id?, title, entry_point, ...)
  foreign key (subject_id, student_id) references subject (id, student_id)
  foreign key (topic_id,  subject_id)  references topic   (id, subject_id)   -- nur wenn gesetzt

tutor_message (id, student_id, session_id, role, content, token_count?, language_ok?, ...)
  foreign key (session_id, student_id) references tutor_session (id, student_id)
```

Beide zusammengesetzten Fremdschlüssel sind dasselbe Muster wie bei `calendar_event`
(K-01) und `vocab_set_item` (V-05): Der Mandant hängt am Schlüssel, nicht an der
Anwendungslogik. Der zweite erzwingt §15 Fehler 2 — eine Session über ein Thema, das
zu einem anderen Fach gehört, scheitert an der Datenbank.

`entry_point` ist ein Enum mit allen sieben Einstiegen aus §4 (`freie_frage`,
`verstehen`, `vorschau`, `hausaufgabe`, `pruefung`, `nachbereitung`, `vertiefen`),
auch wenn Stufe 1 nur die ersten beiden anbietet. Ein Enum später zu erweitern ist eine
Migration; die Werte jetzt vollständig aufzuschreiben kostet nichts und hält die
spätere Zuordnung sauber.

### D3 · Der Sprachwächter wirkt vorbeugend, prüft nachträglich und blockiert nie

Drei Stellen statt einer, weil keine allein reicht:

1. **Systemprompt (Laufzeit, Prävention).** Die Sprache wird fixiert: Antwort immer auf
   Deutsch. Ausnahme sind Fremdsprachenfächer — dort ist die Zielsprache in Beispielen,
   Zitaten und Vokabeln erlaubt, die **Erklärung drumherum** bleibt deutsch. Ob ein
   Fach eine Zielsprache hat, sagt `subject.language` (seit F-16a vorhanden, seit V-06a
   in Gebrauch). Kein Rätselraten am Fachnamen.
2. **`istDeutsch(text)` (Test-Instrument).** Ein reiner, API-freier Detektor in
   `src/lib/tutor/language-guard.ts`, unit-getestet gegen feste Beispiele — deutsche
   Antwort, englische Antwort, deutsche Antwort mit französischen Vokabeln darin (darf
   **nicht** anschlagen). Das ist der Unit-Test, den T-02a verlangt.
3. **Nachträgliche Markierung (Laufzeit, Messung).** Nach dem Streamende läuft derselbe
   Detektor über die gespeicherte Antwort und setzt `tutor_message.language_ok`. Bei
   `false` wird nichts weggeworfen und nichts vor dem Kind versteckt — der Text stand
   schon da. Aber der Rutscher ist gezählt und auffindbar, statt unbemerkt zu bleiben.

**Was hier ausdrücklich nicht passiert:** Streaming und „prüfen, dann ausliefern"
schließen einander aus. Wer beides will, muss auf das Streaming verzichten. Diese
Entscheidung nimmt bewusst das schwächere Laufzeitversprechen und gleicht es mit
Messbarkeit aus. Zeigt sich die Markierung im Betrieb häufiger als selten, ist das das
Signal, D1 noch einmal aufzumachen — nicht, den Detektor zu verschärfen.

Zusätzlich ein Integrationstest gegen die echte API hinter `RUN_AI_TESTS=1`, nach dem
Vorbild von `RUN_DB_TESTS=1`: standardmäßig übersprungen, in CI aus, von Hand
ausführbar. Er stellt drei Fragen (deutsches Fach, Fremdsprachenfach, englisch
gestellte Frage) und prüft die Antworten mit demselben Detektor. Ein Unit-Test allein
belegt nur, dass der Detektor funktioniert, nicht dass das Modell sich benimmt.

### D4 · Der Deckel zählt in Postgres, keine neue Abhängigkeit

Eine Tabelle `ai_usage (student_id, endpoint, created_at, token_count?)`, eine Zeile
je Modellaufruf, mit RLS wie alles andere. Der Deckel ist eine Abfrage über ein
gleitendes Fenster:

```sql
select count(*) from ai_usage
where student_id = app.student_id()
  and endpoint = 'tutor'
  and created_at > now() - interval '1 hour'
```

Zwei Fenster, hergeleitet aus der Rechnung oben (1,1 Cent je Antwort):

| Fenster  | Grenze | Worst case | Warum                                                                                                                              |
| -------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1 Stunde | 20     | 22 Cent    | Fängt die Schleife ab — ein hängender Client, ein Kind, das den Knopf entdeckt                                                     |
| 1 Tag    | 60     | 66 Cent    | ≈ 20 €/Monat im theoretischen Dauervollausschlag, real ein Bruchteil. Über den 40 Antworten/Tag aus §11, also im Alltag unsichtbar |

Beim Überschreiten: **429 mit einem deutschen Satz**, der sagt, wann es weitergeht —
nicht „Rate limit exceeded". Der Deckel ist ein Kostenschutz, kein pädagogisches
Mittel; er darf nicht wie eine Strafe klingen.

Aufgeräumt wird beim Schreiben (`delete from ai_usage where created_at < now() -
interval '7 days'`), nicht per Cron. Die Tabelle bleibt dadurch klein, ohne dass ein
weiterer beweglicher Teil entsteht.

**Warum nicht Upstash/Redis:** neue Abhängigkeit, neuer Dienst, neue Secrets, neue
Ausfallquelle — für einen Zähler, den Postgres in einer Zeile beantwortet. CLAUDE.md
verlangt für jede neue Dependency ohnehin eine Rückfrage; hier gibt es keinen Grund,
sie zu stellen. **Warum keine Zählerspalte an `student`:** kein gleitendes Fenster, und
der Reset bräuchte einen Job.

### D5 · Stufe 1 antwortet aus Allgemeinwissen — und der Server sagt das, nicht das Modell

Kein Kontextpaket, keine Schichten, kein Prompt Caching. Das ist T-01 (voll) und
Stufe 2. Stufe 1 hat auch schlicht nichts zu lesen: Material (M-01) gibt es nicht,
Lehrwerke (L-01) sind nicht erfasst, und Themen existieren nur im Seed.

Die Kennzeichnung „Allgemeinwissen" verlangt §10 und die Roadmap. Sie wird **nicht**
dem Modell überlassen und **nicht** aus einem Zod-Feld gelesen — Structured Output und
Streaming schließen sich aus (D1). Stattdessen setzt die Oberfläche unter jede Antwort
einen **festen, serverseitig gesetzten Hinweis**:

> Allgemeinwissen — noch ohne dein Material und dein Lehrwerk.

Das ist die stärkere Lösung, nicht die schwächere: Der Hinweis ist wahr, weil in
Stufe 1 gar keine andere Quelle existieren _kann_. Er hängt nicht davon ab, ob das
Modell sich an eine Anweisung erinnert. Sobald Schichten dazukommen, tritt er einer
echten Quellenangabe je Antwort den Platz ab.

### D6 · Der Chip zeigt das Fach; das Thema bleibt leer, bis es Themen gibt

`tutor_session.subject_id` ist `not null`, `topic_id` ist `null`-bar. Der Kontext-Chip
aus §15 zeigt in Stufe 1 nur das Fach.

Das ist keine Sparmaßnahme, sondern die Reihenfolge: Es gibt keine Themen-Oberfläche.
Ein Chip, der ein Thema verlangt, bräuchte erst eine Ansicht zum Anlegen und Wählen —
und damit ein Ticket, das die Roadmap bewusst nach hinten legt. Die Spalte und ihr
zusammengesetzter Fremdschlüssel entstehen aber jetzt, damit das Thema später nur noch
gesetzt werden muss.

Ein Fach ist Pflicht, weil ohne Fach weder Sprache (D3) noch spätere Schichten
bestimmbar sind. Hat ein Kind noch kein Fach, führt der Tutor auf „Fächer", statt eine
Session ohne Bezug anzulegen.

## Konsequenzen

**Gut:**

- Die Antwort erscheint, sobald das erste Wort da ist. Kein Spinner, keine erfundenen
  Zwischenschritte.
- Die Abweichung von der Stack-Regel steht an genau einer Stelle und ist nachlesbar.
- Der Sprachrutscher aus §15 ist nicht nur bekämpft, sondern **gezählt**.
- Der Kostendeckel liegt vor dem ersten echten Nutzer, nicht nach der ersten Rechnung.
- Beide Tabellen tragen den Mandanten im Schlüssel; die Fachbindung eines Themas
  scheitert an der Datenbank, nicht an einer Prüfung im Code.

**Preis, offen benannt:**

- **Ein Route Handler mehr Angriffsfläche.** Auth, Rollenprüfung und Rate Limit stehen
  dort von Hand; eine Server Action hätte das erste geschenkt. Der E2E-Test muss den
  Endpunkt deshalb auch direkt ansprechen, nicht nur über die Oberfläche.
- **Keine Vorabprüfung der Antwort.** Ein Sprachrutscher wird sichtbar, bevor er
  markiert ist. Das ist der bewusst gezahlte Preis für Streaming.
- **Kein Structured Output am Tutor.** Die Projektregel „alle Modellantworten gegen ein
  Zod-Schema" gilt für den Chat nicht. Sie gilt weiterhin für jeden Import und jede
  Generierung — und der Chat gibt nichts aus, was strukturiert weiterverarbeitet wird.
- **`ai_usage` wächst mit jeder Frage.** Bei 60 Zeilen am Tag und sieben Tagen
  Aufbewahrung sind das gut 400 Zeilen — unkritisch, aber es ist eine Tabelle mehr,
  die aufgeräumt werden will.

**Offen für T-01 (voll) / Stufe 2:**

- Kontextpaket pro Thema, Schichten mit Quellenangabe, Prompt Caching.
- Einstiegs-Router: Stufe 1 hat zwei Einstiege als Chips, keine Erkennung aus dem Text.
- `tutor_session.title` wird in Stufe 1 aus der ersten Frage gekürzt, nicht vom Modell
  vergeben (§15 „Chatverlauf mit Titeln" in voller Form ist Stufe 2).
- `tutor_session_summary` mit T-03.
- „Erklär es anders", Verständnischeck, Anschlussfragen-Chips — alle T-02 (voll).

## Abgelehnte Alternativen

**Server Action, Antwort am Stück.** Bleibt auf der Stack-Regel, halber Bauaufwand, und
Structured Output könnte die Quellen-Kennzeichnung per Zod erzwingen statt per Bitte an
das Modell. Verworfen wegen der 5–10 Sekunden Stille: Das ist bei einem Chat kein
Schönheitsfehler, sondern der Unterschied zwischen „lebt" und „hängt" — besonders für
die Zielgruppe. D5 löst die Kennzeichnung ohnehin besser, ohne das Modell zu fragen.

**Streaming über eine Server Action mit `useOptimistic`/Polling.** Hätte die Regel
formal gewahrt, wäre aber ein Nachbau von Streaming aus Bausteinen, die dafür nicht
gedacht sind — mehr Code, mehr Zustände, mehr Fehlerfälle als der Route Handler, den
die Plattform anbietet.

**Antwort erst prüfen, dann ausliefern (Sprachwächter als Torwächter).** Setzt voraus,
dass die vollständige Antwort vorliegt — schließt Streaming aus. Wäre die richtige Wahl,
wenn ein Sprachrutscher gefährlich wäre; er ist peinlich und messbar, und die Messung
reicht als erste Fassung.

**`tutor_session_summary` jetzt mit anlegen.** Hätte ADR 0004 D4 vollständig abgebildet.
Verworfen: Eine Tabelle, die niemand schreibt, und eine Eltern-Policy, die nur Leere
freigibt, täuschen eine Funktion vor. Der RLS-Metatest verlangt für jede Tabelle eine
Policy — er würde erfüllt, ohne dass jemand etwas davon hat.

**Rate Limit über Upstash Redis.** Der übliche Weg auf Vercel und für ein gleitendes
Fenster gebaut. Verworfen: neue Abhängigkeit, neuer Dienst, neue Secrets, für einen
Zähler, den Postgres beantwortet. Wird interessant, wenn tutr mehrere Familien bedient
— dann steht die Entscheidung neu an.
