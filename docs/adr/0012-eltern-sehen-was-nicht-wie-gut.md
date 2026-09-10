# ADR 0012: Eltern sehen, **was** gelernt wird – nicht, **wie gut** es läuft

Status: **vorgeschlagen** · Datum: 2026-09-10 · Bezug: docs/konzept.md §11, §12, §15
Schneidet die RLS-Matrix aus [ADR 0004](0004-datenmodell-rls.md) D4 neu und setzt
[ADR 0006](0006-student-als-mandant.md) D2 fort („Das Kind ist der Mandant").
Tickets: T-03 (braucht die Entscheidung für `homework_task`), F-17 (Aufräumen der
bestehenden Policies).

## Kontext

### 1. Der Auslöser

T-03 legt `homework_task` an. [ADR 0004](0004-datenmodell-rls.md) D4 sieht dafür vor:

> `homework_task` (Status, Versuche, Zeit) – Eltern lesen Status/Zeit, nie den Verlauf
> → getrennt von `tutor_message`.

Beim Schreiben der Policy fiel die Frage an, ob das noch die gewollte Richtung ist.

### 2. Was heute tatsächlich gilt

Eine Inventur der Policies (`src/db/policies/*.sql`) zeigt, wie weit das Leserecht der
Eltern reicht:

| Bereich                     | Eltern lesen heute                                    |
| --------------------------- | ----------------------------------------------------- |
| Identität, Geräte, Sessions | Profil, Passkeys, angemeldete Geräte                  |
| Kurrikulum                  | Schuljahr, Fach, Thema, Lernziel, Vorläufer, Lehrwerk |
| Vokabeln                    | `vocab_set`, `vocab_item`, `vocab_set_item`           |
| **Lernstand**               | **`card`, `review`**                                  |
| Kalender                    | `calendar_event`                                      |
| Tutor                       | nichts (ADR 0004 D3)                                  |

Der scharfe Fall ist `review`. Die Tabelle ist das Protokoll **jeder einzelnen
Vokabelantwort**: `rating` und `response_ms`, Zeile für Zeile. Ein Elternteil darf heute
technisch nachlesen, bei welchem Wort das Kind gezögert hat und wie lange. Eine
Oberfläche dafür gibt es nicht – das Recht steht trotzdem in der Datenbank, und Rechte,
die existieren, werden irgendwann benutzt.

### 3. Was auf dem Spiel steht

Der Mechanismus, der dieses Produkt trägt, ist die Bereitschaft eines 14-Jährigen zu
sagen: **„Ich versteh das nicht."** Der Hinweisleiter (§4a), der Verständnischeck, die
Diagnosefrage „wo hakt es" – alles hängt daran, dass ehrlich geantwortet wird.

Wahrgenommene Beobachtung kippt genau das. Nicht weil Kinder faul wären, sondern weil
sich das Motiv verschiebt: von „ich will das kapieren" zu „es soll gut aussehen". Bei
Karten ist das trivial machbar – man tippt „Kann ich", und die Statistik ist schön. Ein
Kind, das sich beobachtet fühlt, **spielt die Metrik, statt zu lernen**, und der Tutor
bekommt Fehlinformation genau dort, wo er Wahrheit braucht.

### 4. Das Prinzip gibt es schon – es wurde nur nicht zu Ende gedacht

§15 lehnt ausdrücklich ab: Streaks im Header, Bestenlisten, Lob ohne Grund,
Dringlichkeits- und Kaufelemente. Die gemeinsame Begründung ist immer dieselbe: **kein
Druck von außen**.

Ein Eltern-Dashboard mit Fortschrittszahlen gehört in dieselbe Kategorie – nur mit einem
Gesicht dran, das dem Kind jeden Tag am Abendbrottisch gegenübersitzt. Diese
Entscheidung erfindet nichts Neues; sie wendet eine bestehende Regel konsequent an.

### 5. Der Zeitpunkt ist günstig

Die Elternansicht steht laut §12 erst in **V4**. Es ist nichts darauf gebaut. Später
wäre es das Zurücknehmen einer gelieferten Funktion.

## Die entscheidende Festlegung

> **Eltern sehen, _was_ gelernt wird. Nicht, _wie gut_ es läuft.**

Der Vokabelsatz zur Unité 3 ist Material – wer das Kind abfragen will, braucht die
Liste. Dass beim dritten Wort dreimal „Nochmal" kam, ist Lernstand und gehört dem Kind.

Der brauchbare Test dahinter: **Kann ein Elternteil mit dieser Information etwas tun –
oder nur nachfragen, warum die Zahl so niedrig ist?** „Am 25. ist die Französischarbeit"
verändert die Wochenplanung. „58 % Sicherheit" verändert nichts, außer die Stimmung.

## Entscheidung

### D1 · Organisatorisches bleibt bei den Eltern

Vollzugriff wie bisher, weil es die Rolle aus [ADR 0005](0005-anmeldung-kind-zuerst.md)/
[ADR 0006](0006-student-als-mandant.md) ist – **Anker, nicht Aufsicht**:

- `calendar_event` – Familienlogistik. Ein Termin am 25. betrifft den Haushalt.
- `student`, `student_credential`, `student_session` – Konto, Wiederherstellung, Geräte.
- `school_year`, `subject`, `school_year_subject`, `school_year_textbook` – Organisation;
  Eltern legen sie oft selbst an.
- Noten (später `exam_attempt`) – kennen Eltern ohnehin aus der Schule. Sie in tutr zu
  verbergen wäre Theater, kein Datenschutz.

### D2 · „Was gelernt wird" bleibt lesbar

`topic`, `learning_objective`, `objective_prerequisite`, `vocab_set`, `vocab_item`,
`vocab_set_item`, später `material`: Eltern **lesen** weiter.

Das ist Material und Stoffplan, kein Leistungsurteil. Ein Elternteil, das abfragen oder
den Stoff überblicken will, braucht es – und es enthält keine Aussage darüber, wie gut
das Kind ist.

### D3 · Lernstand und Protokoll gehören dem Kind

**Kein Eltern-Zugriff** auf:

- `card` – der FSRS-Zustand je Karte
- `review` – jede Antwort, jede Antwortzeit
- `objective_mastery` (kommt mit M-03) – Abdeckung und Sicherheit
- `homework_task` – Status, Versuche, Zeit je Aufgabe
- `tutor_session_summary` – der Zweizeiler aus §4a

Damit ändert sich ADR 0004 D4 an zwei Stellen: `card`/`review`/`objective_mastery`
verlieren die Elternzeile, und `homework_task`/`tutor_session_summary` wechseln von
„lesen" auf „kein Zugriff".

`tutor_session` und `tutor_message` waren schon gesperrt (ADR 0004 D3) und bleiben es.

### D4 · Teilen geht vom Kind aus, nicht von einem Dashboard

Wo Eltern etwas sehen sollen, das unter D3 fällt, entscheidet das Kind – „zeig das
meinen Eltern" an einer konkreten Stelle, nicht als Dauerfreigabe.

Das ist die Umkehrung der üblichen Richtung und der eigentliche Punkt dieses ADR:
Begleitung ist nicht Überwachung. Sie kann vom Kind ausgehen, und dann wirkt sie, weil
sie freiwillig ist. In der Datenbank heißt das später eine ausdrückliche Freigabe je
Gegenstand, nicht eine Policy, die alles öffnet. **In diesem ADR wird das nicht gebaut** –
hier steht nur die Richtung, damit niemand später ein Dashboard als Abkürzung baut.

### D5 · Ein Lebenszeichen, mehr nicht

Ein Elternteil, das tutr eingerichtet hat, darf wissen, **ob** es benutzt wird – nicht,
**wie gut**. Falls das je gebraucht wird: ein Datum („zuletzt aktiv: gestern"), keine
Zeitreihe, keine Zahl über Leistung.

Ausdrücklich **nicht Teil dieses Tickets**, nur die Grenze für den Fall, dass die Frage
kommt.

## Konsequenzen

**Gut:**

- Der Kernmechanismus ist geschützt: Ehrlich „ich versteh das nicht" zu sagen, hat keinen
  Preis mehr.
- §15 gilt konsequent – dieselbe Begründung wie bei Streaks und Bestenlisten.
- Datenminimierung: Weniger Leserechte sind bei Daten Minderjähriger auch rechtlich die
  ruhigere Position.
- Weniger zu bauen. Die V4-Elternansicht schrumpft auf Termine, Konto und Noten – und wird
  dadurch überhaupt erst in einem Zug lieferbar.

**Preis, offen benannt:**

- **Jüngere Kinder verlieren etwas.** Bei Jahrgang 5 ist elterliche Begleitung real
  hilfreich, und D4 (Kind teilt aktiv) setzt voraus, dass das Kind daran denkt. Wenn sich
  das im Gebrauch als Lücke zeigt, ist die Antwort ein besserer Teilen-Weg – **nicht** ein
  Dashboard durch die Hintertür.
- **Ein Aufräum-Ticket entsteht** (F-17): `card_parent` und `review_parent` müssen aus
  `0050-vocab.sql` verschwinden. Bis dahin bleibt die Inkonsistenz bestehen und ist im
  Backlog vermerkt.
- **ADR 0004 D4 ist nicht mehr allein maßgeblich.** Wer die Matrix liest, muss dieses ADR
  daneben legen. Deshalb steht der Verweis im Kopf von ADR 0004.

## Abgelehnte Alternativen

**Alles lassen wie in ADR 0004 D4.** Der Weg des geringsten Widerstands, und für das
Elternteil, das bezahlt, der erwartbare. Verworfen: Der Preis wird nicht vom Elternteil
bezahlt, sondern vom Kind – in Form der Bereitschaft, eine Wissenslücke zuzugeben. Genau
die ist der Rohstoff dieses Produkts.

**Auch Termine und Noten sperren.** Konsequent aus Sicht der Autonomie. Verworfen: Ein
Termin ist Familienlogistik, keine Leistungsaussage, und Noten kennen Eltern ohnehin über
die Schule. Beides zu verbergen wäre Symbolpolitik ohne Schutzwirkung – und würde die
Eltern zu Recht gegen das Werkzeug aufbringen.

**Eltern-Dashboard mit Mastery, aber „nur grün/gelb/rot".** Klingt schonender.
Verworfen: Die Vergröberung ändert nichts am Mechanismus – ein rotes Feld am Abendbrottisch
wirkt wie eine schlechte Note, und das Kind optimiert weiter die Anzeige statt sein
Verständnis.

**Einwilligung als Leserecht auslegen.** Das Elternteil trägt die Einwilligung
(`parent_student.consent_at`, ADR 0005). Daraus folgt aber kein Anspruch, alles zu lesen:
Einwilligung in eine Verarbeitung ist etwas anderes als Zugriff auf ihr Ergebnis. Der
Rechtsgrund trägt die Verarbeitung, nicht die Einsicht.
