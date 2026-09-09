# Roadmap: erst das Skelett, dann die Tiefe

Stand: 9. September 2026 · Bezug: `docs/konzept.md` §12, `docs/PLAN.md`

## Warum dieses Dokument neben §12 steht

Konzept §12 ordnet die Arbeit **nach Reifegrad**: MVP fertig, dann V2, dann V3.
Jede Phase bringt wenige Bereiche zu Ende. Das ist eine legitime Reihenfolge –
und nicht die, die wir jetzt gehen.

Wir gehen stattdessen **in die Breite zuerst**: von jedem Bereich eine schmale,
aber _echte_ Fassung, dann Runde für Runde vertiefen. §12 bleibt unverändert als
Sicht der Spezifikation; dieses Dokument ist die Arbeitsreihenfolge.

**Warum das jetzt trägt:** Der prüfungskritische Weg ist fertig. Vokabeln
(V-01 bis V-06) funktionieren live – Sets, Einfügen, Foto-Erkennung,
fachgebundenes Üben. Vor einer Woche wäre Breite-zuerst riskant gewesen; jetzt
steht das, was am 25. September gebraucht wird.

**Was es kostet:** Jeder Bereich bleibt eine Weile erkennbar unfertig. Wer das
nicht aushält, sollte §12 folgen. Der Gewinn ist, dass sich früh zeigt, wie die
Teile zusammenspielen – und dass Rückmeldung aus echter Nutzung die Reihenfolge
bestimmt statt einer Vermutung von heute.

---

## Was sich **nicht** reduzieren lässt

Die größte Gefahr bei „erst schmal, dann tiefer" ist, Regeln für Politur zu
halten. Diese sechs gehören zur **ersten** Fassung ihres Bereichs – ohne sie
darf er nicht live gehen:

| Regel                                                                        | Wo verankert           | Warum nicht später                                                                                                                                                    |
| ---------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keine Lösung vor zwei dokumentierten Versuchen**                           | CLAUDE.md, §4a         | Ohne die Hinweisleiter ist die Hausaufgabenhilfe eine Abschreibmaschine. Das ist der ganze Unterschied zwischen tutr und einem Chatfenster                            |
| **Der Tutor antwortet auf Deutsch** (außer Zielsprache im Fremdsprachenfach) | CLAUDE.md, T-02a       | Wird per Test erzwungen. Ein Modell fällt sonst unbemerkt ins Englische                                                                                               |
| **Eltern sehen `tutor_sessions` nie**                                        | CLAUDE.md, ADR 0004 D4 | Muss in der RLS stehen, **bevor** die erste Zeile existiert. Nachträglich ist es ein Datenleck mit Historie                                                           |
| **Kontext-Chip „Fach › Thema" über der Eingabe**                             | §15                    | Ohne ihn weiß niemand, worüber gerade geredet wird – und der Tutor rät                                                                                                |
| **Quelle benennen** (eigenes Material > Lehrwerk > Pack > Allgemeinwissen)   | CLAUDE.md              | In Stufe 1 gibt es nur Allgemeinwissen – dann muss genau das dranstehen, statt so zu tun, als käme es aus dem Lehrwerk                                                |
| **Rate Limits auf KI-Endpunkten** (S-03)                                     | §11                    | Ab dem Moment, in dem ein KI-Aufruf hinter der Anmeldung erreichbar ist, kostet jeder Klick Geld. Gehört zur ersten Tutor-Fassung, nicht in eine Härtungsrunde danach |

---

## Stufe 0 · Der Blocker — behoben (F-16a, 9.9.2026)

**Es gab keinen Weg, ein Fach anzulegen.** `insert into subject` stand
ausschließlich im Seed-Skript, und selbst mit Formular hätte nur ein
Elternteil schreiben dürfen (ADR 0004 D4) – ein Kind ohne Elternkonto
(ADR 0006 D1) kam dadurch nie zu einem Fach.

F-16a schließt das: Das Kind legt Fach und Schuljahr selbst an
([ADR 0009](adr/0009-schuljahr-als-sichtfenster.md)), das Schuljahr entsteht
mit der Registrierung. Zugleich die Leitplanke gegen Sammelwut aus §9:
**Das Schuljahr bestimmt, was sichtbar ist, das Fach, was geübt wird** – Sets,
Themen und Arbeiten sind jahresgebunden, der Lernstand (Vokabeln, Karten,
Reviews) bleibt es ausdrücklich nicht.

Zurückgestellt als **F-16b**: Jahr umschalten, Historie ansehen, Sommer-
Rollover. Es gibt genau ein Schuljahr; ein Umschalter hätte bis August 2027
nichts zu tun.

---

## Die Reifeleitern

Jeder Bereich in drei Stufen: **schmal aber echt** → **nützlich** → **reif**.

### Tutor · Chat

| Stufe | Umfang                                                                                                                                                                                                                                                                          | Tickets                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **1** | Ein Chatfenster. Kontext-Chip mit Fach (Thema optional). Zwei Einstiege: freie Frage und „Verstehen". Schema `tutor_session`/`tutor_message` **mit RLS von Anfang an**. Sprachwächter aktiv. Antworten aus Allgemeinwissen, ausdrücklich als solches gekennzeichnet. Rate Limit | T-01 (schmal), T-02 (schmal), T-02a, S-03 |
| **2** | Kontextpaket pro Thema, Schichten mit Quellenangabe, „Erklär es anders", Verständnischeck, Anschlussfragen-Chips                                                                                                                                                                | T-01 (voll), T-02 (voll)                  |
| **3** | Einstiege Vorschau, Prüfungsvorbereitung, Nachbereitung · Prompt Caching · Spracheingabe                                                                                                                                                                                        | T-04, T-02b                               |

### Hausaufgabenhilfe

| Stufe | Umfang                                                                                                                                                                                  | Tickets       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **1** | Foto → Aufgabenliste (dieselbe Vision-Technik wie V-03b) → eine Aufgabe nach der anderen → **Hinweisleiter mit den zwei dokumentierten Versuchen**. Kein Mastery, keine Kartenerzeugung | T-03 (schmal) |
| **2** | Zuordnung zu Thema/Lernziel, Fehler werden zu Karten, Mastery-Update, Zusammenfassung am Ende                                                                                           | T-03 (voll)   |
| **3** | Buchangabe ohne Foto („S. 114, Nr. 5–7") über Lehrwerkwissen · Fachtabelle aus §4a je Fach                                                                                              | –             |

### Prüfungskalender

| Stufe | Umfang                                                                                                           | Tickets          |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ---------------- |
| **1** | Termin von Hand anlegen (Fach, Datum, Art), Liste der nächsten Wochen, bearbeiten, absagen                       | K-01             |
| **2** | Themen an einen Termin hängen (nur Themen desselben Fachs – DB-Constraint), Countdown auf „Heute", Prüfungsseite | P-01             |
| **3** | Klausurplan per Foto einlesen · CSV/XLSX/ICS · Lernplan-Slots                                                    | K-02, K-03, K-04 |

### Vokabeln — Stufe 1 steht

| Stufe | Umfang                                                                                                                             | Tickets     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **1** | ✅ Sets, Einfügen, Foto-Import, Duplikaterkennung, fachgebundenes Üben mit FSRS                                                    | V-01 … V-06 |
| **2** | **Set-Modus** – ein Set gezielt vor der Arbeit wiederholen, unabhängig von der Fälligkeit. Dazu Prüfungsmodus, Schwachstellen, Mix | V-04        |
| **3** | Offline üben · Anki-Export                                                                                                         | F-09        |

### Material & Karten

| Stufe | Umfang                                                                                                          | Tickets           |
| ----- | --------------------------------------------------------------------------------------------------------------- | ----------------- |
| **1** | Notiz, Link oder Buchangabe zu einem Thema – **ohne Storage**, damit der Bereich ohne neue Abhängigkeit startet | M-01 (schmal)     |
| **2** | Foto und PDF mit Storage, signierte URLs, Vision-Extraktion, Zuordnung zu Lernzielen                            | M-01 (voll), M-02 |
| **3** | Karten aus Material erzeugen – `card` ist seit V-01 generisch, das Schema trägt es bereits                      | M-03, M-04        |

### Heute

| Stufe | Umfang                                                                        | Tickets       |
| ----- | ----------------------------------------------------------------------------- | ------------- |
| **1** | Echte Zahlen statt der F-07-Attrappe: fällige Karten je Fach, nächster Termin | H-01 (schmal) |
| **2** | Countdown, Kamera-Knopf, Lernplan-Vorschlag                                   | H-01 (voll)   |
| **3** | Fortschritt und Motivation (§6 M8)                                            | –             |

---

## Vorgeschlagene Reihenfolge der nächsten Tickets

1. ~~**F-16a · Fächer und Schuljahr anlegen** — der Blocker.~~ Erledigt (9.9.2026)
2. **K-01 · Kalender, Termine von Hand** — klein, unabhängig, sofort nützlich (vier Arbeiten stehen an)
3. **T-01/T-02 schmal + T-02a + S-03 · Tutor-Chat** — der größte Brocken der Stufe 1. Rate Limit und Sprachwächter gehören dazu, nicht danach
4. **T-03 schmal · Hausaufgabe mit Hinweisleiter** — baut auf dem Vision-Weg aus V-03b auf
5. **H-01 schmal · Heute mit echten Daten** — verbindet, was dann existiert
6. **V-04 · Set-Modus** — der erste Vertiefungsschritt, und der mit dem größten Nutzen vor einer Arbeit

Danach entscheidet die Rückmeldung aus der echten Nutzung, nicht diese Liste.

## Zwei Dinge, die dabei mitlaufen müssen

**Kosten.** Ab Stufe 1 des Tutors löst jeder Klick einen bezahlten Modellaufruf
aus. S-03 begrenzt das; darüber hinaus lohnt früh ein Blick auf die tatsächliche
Nutzung, bevor Prompt Caching (Stufe 3) nachgerüstet wird.

**Der Prüfungstermin.** Am 25. September ist die Französischarbeit. Die
Vokabeln stehen – aber wenn in den Tagen davor etwas klemmt, hat das Vorrang vor
jeder Roadmap. Diese Reihenfolge ist ein Vorschlag, kein Vertrag.
